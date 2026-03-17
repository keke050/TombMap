#!/usr/bin/env python3
import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlencode
from urllib.request import urlopen

INPUT = Path("data/seed/tombs.json")
OUTPUT = Path("data/seed/tombs.json")
CACHE = Path("data/raw/geocode_cache.json")
REPORT = Path("data/raw/geocode_report.json")


def load_env_key():
    key = os.getenv("AMAP_WEB_KEY")
    if key:
        return key
    env_file = Path(".env.local")
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "AMAP_WEB_KEY":
            return value.strip().strip('"').strip("'")
    return None


KEY = load_env_key()


def load_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache):
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def request_json(url: str, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(urlopen(url, timeout=timeout).read().decode("utf-8"))
    except Exception:
        return None


def build_address(item: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], str, Optional[str]]:
    raw_address = (item.get("address") or "").strip()
    raw_city = (item.get("city") or "").strip()
    province = (item.get("province") or "").strip()
    county = (item.get("county") or "").strip()
    name = (item.get("name") or "").strip()

    def with_prefix(address: str) -> str:
        prefix = "".join([part for part in [province, raw_city, county] if part and part not in address])
        return f"{prefix}{address}" if prefix else address

    city = raw_city or province or ""
    if raw_address:
        return with_prefix(raw_address), city or None, raw_address, raw_city or None

    merged = "".join([part for part in [province, raw_city, county, name] if part])
    if merged:
        return merged, city or None, raw_address, raw_city or None
    return None, None, raw_address, raw_city or None


_SPECIFIC_ADDRESS_TOKENS = ("路", "街", "巷", "镇", "乡", "村", "号", "弄", "段", "山", "寺", "园", "景区", "公园")


def address_seems_specific(item: Dict[str, Any]) -> bool:
    address = (item.get("address") or "").strip()
    if not address:
        return False
    if len(address) >= 10:
        return True
    if any(token in address for token in _SPECIFIC_ADDRESS_TOKENS):
        return True
    if re.search(r"\d", address):
        return True
    # 太短、且看起来只是“省市区”组合时，避免落到城市中心点
    province = (item.get("province") or "").strip()
    city = (item.get("city") or "").strip()
    county = (item.get("county") or "").strip()
    merged = "".join([part for part in [province, city, county] if part])
    if merged and merged in address and len(address) <= len(merged) + 2:
        return False
    return len(address) >= 6


def geocode(address: str, city: Optional[str]) -> Optional[Tuple[float, float]]:
    params = {"key": KEY, "address": address, "city": city or ""}
    url = f"https://restapi.amap.com/v3/geocode/geo?{urlencode(params)}"
    data = request_json(url)
    if not data or data.get("status") != "1":
        return None
    geocodes = data.get("geocodes") or []
    if not geocodes:
        return None
    location = geocodes[0].get("location")
    if not location:
        return None
    lng, lat = location.split(",")
    return float(lat), float(lng)


def poi_search(keywords: str, city: Optional[str], citylimit: bool, offset: int = 10) -> List[Dict[str, Any]]:
    params = {
        "key": KEY,
        "keywords": keywords,
        "city": city or "",
        "citylimit": "true" if citylimit else "false",
        "offset": str(max(1, min(25, offset))),
        "page": "1",
        "extensions": "base",
    }
    url = f"https://restapi.amap.com/v3/place/text?{urlencode(params)}"
    data = request_json(url)
    if not data or data.get("status") != "1":
        return []
    return data.get("pois") or []


def normalize_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"[\s·•()（）\[\]【】,，.。/\\\\-]+", "", text)
    return text


def normalize_name(name: str) -> str:
    name = normalize_text(name)
    for suffix in ("古墓", "墓葬", "墓群", "墓", "陵", "陵园", "祠", "石刻", "遗址", "纪念馆", "纪念园"):
        if name.endswith(suffix) and len(name) > len(suffix) + 1:
            name = name[: -len(suffix)]
            break
    return name


def score_poi(item: Dict[str, Any], poi: Dict[str, Any]) -> int:
    target = normalize_name(item.get("name") or "")
    cand = normalize_name(poi.get("name") or "")
    if not target or not cand:
        return 0

    score = 0
    if cand == target:
        score += 120
    elif target in cand or cand in target:
        score += 80
    else:
        # 弱匹配：按 2~4 字连续片段命中加分
        for size in (4, 3, 2):
            if len(target) >= size and target[:size] in cand:
                score += 40
                break

    province = (item.get("province") or "").strip()
    city = (item.get("city") or "").strip()
    county = (item.get("county") or "").strip()
    addr = normalize_text(poi.get("address") or "")
    pname = normalize_text(poi.get("pname") or "")
    cname = normalize_text(poi.get("cityname") or "")
    adname = normalize_text(poi.get("adname") or "")
    where = addr + pname + cname + adname
    if county and normalize_text(county) in where:
        score += 25
    if city and normalize_text(city) in where:
        score += 15
    if province and normalize_text(province) in where:
        score += 8

    ptype = poi.get("type") or ""
    if any(token in ptype for token in ("陵", "墓", "遗址", "祠", "纪念", "文物", "景点")):
        score += 10

    return score


def build_keywords(item: Dict[str, Any]) -> str:
    name = (item.get("name") or "").strip()
    if not name:
        return ""
    province = (item.get("province") or "").strip()
    city = (item.get("city") or "").strip()
    county = (item.get("county") or "").strip()
    parts = [province, city, county, name]
    merged = "".join([p for p in parts if p])
    # 对没有“墓/陵”等关键词的名字，补一个弱提示，提升命中率
    if not any(token in name for token in ("墓", "陵")):
        merged = f"{merged} 墓"
    return merged


def matches_filters(item: Dict[str, Any], args: argparse.Namespace) -> bool:
    def contains(value: Optional[str], needle: Optional[str]) -> bool:
        if not needle:
            return True
        return needle in (value or "")

    if args.name and not contains(item.get("name"), args.name):
        return False
    if args.province and not (
        contains(item.get("province"), args.province) or contains(item.get("address"), args.province)
    ):
        return False
    if args.city and not (contains(item.get("city"), args.city) or contains(item.get("address"), args.city)):
        return False
    if args.county and not (
        contains(item.get("county"), args.county) or contains(item.get("address"), args.county)
    ):
        return False
    return True


def looks_like_noise_name(name: str) -> bool:
    name = (name or "").strip()
    if not name:
        return True
    # 避免数据污染（如 CSS/HTML 片段）导致浪费配额
    if any(ch in name for ch in ("{", "}", "<", ">", "/*", "*/")):
        return True
    if re.search(r"(cursor\s*:|pointer-events|amap://|\.tool-item#)", name):
        return True
    return False


def main():
    parser = argparse.ArgumentParser(description="补全墓葬坐标（高德地理编码 + 高德搜索 POI）")
    parser.add_argument("--input", default=str(INPUT), help="输入 JSON 文件路径")
    parser.add_argument("--output", default=str(OUTPUT), help="输出 JSON 文件路径")
    parser.add_argument("--ids-file", help="仅处理这些 ID（每行一个）")
    parser.add_argument("--mode", choices=("auto", "geocode", "poi"), default="auto", help="坐标来源策略")
    parser.add_argument("--poi-threshold", type=int, default=85, help="POI 命中分数阈值（越高越保守）")
    parser.add_argument("--poi-offset", type=int, default=10, help="POI 搜索返回条数（1~25）")
    parser.add_argument("--citylimit", action="store_true", help="POI 搜索限制在 city 内")
    parser.add_argument("--sleep", type=float, default=0.4, help="每次请求间隔（秒）")
    parser.add_argument("--limit", type=int, default=0, help="仅处理前 N 条（0 为不限制）")
    parser.add_argument("--checkpoint", type=int, default=0, help="每 N 次更新写回一次（0 为仅结束时写）")
    parser.add_argument("--dry-run", action="store_true", help="只生成报告/缓存，不写回输出 JSON")
    parser.add_argument("--force", action="store_true", help="即使已有坐标也重新计算（谨慎）")
    parser.add_argument("--province", help="仅处理指定省份（支持子串匹配）")
    parser.add_argument("--city", help="仅处理指定城市（支持子串匹配）")
    parser.add_argument("--county", help="仅处理指定区县（支持子串匹配）")
    parser.add_argument("--name", help="仅处理名称包含该关键词的条目")
    args = parser.parse_args()

    if not KEY:
        raise SystemExit("请设置 AMAP_WEB_KEY 环境变量。")

    input_path = Path(args.input)
    output_path = Path(args.output)
    items = json.loads(input_path.read_text(encoding="utf-8"))
    cache = load_cache()

    id_allow: Optional[Set[str]] = None
    if args.ids_file:
        ids_path = Path(args.ids_file)
        raw_ids = ids_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        id_allow = {line.strip() for line in raw_ids if line.strip() and not line.strip().startswith("#")}

    report: Dict[str, Any] = {
        "checked": 0,
        "filtered": 0,
        "updated": 0,
        "geo_applied": 0,
        "poi_applied": 0,
        "missing": 0,
        "skipped_noise": 0,
        "ambiguous": [],
        "filters": {
            "ids_file": args.ids_file,
            "province": args.province,
            "city": args.city,
            "county": args.county,
            "name": args.name,
            "limit": args.limit,
            "mode": args.mode,
            "poi_threshold": args.poi_threshold,
            "citylimit": args.citylimit,
        },
    }

    updated_since_checkpoint = 0

    def flush():
        nonlocal updated_since_checkpoint
        if not args.dry_run:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        save_cache(cache)
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        updated_since_checkpoint = 0

    for item in items:
        if id_allow is not None and (item.get("id") not in id_allow):
            report["filtered"] += 1
            continue
        if not matches_filters(item, args):
            report["filtered"] += 1
            continue
        if args.limit and report["checked"] >= args.limit:
            break

        report["checked"] += 1

        has_coords = item.get("lat") is not None and item.get("lng") is not None
        if has_coords and not args.force:
            continue

        if looks_like_noise_name(item.get("name") or ""):
            report["skipped_noise"] += 1
            continue

        address, city, raw_address, raw_city = build_address(item)
        if not address and not (item.get("name") or "").strip():
            report["missing"] += 1
            continue

        lat = lng = None

        # 1) 优先用缓存（兼容旧 key："{address}::{city}"）
        geo_cache_keys: List[str] = []
        if raw_address:
            geo_cache_keys.append(f"{raw_address}::{raw_city or ''}")
        if address:
            geo_cache_keys.append(f"{address}::{city or ''}")

        for key in geo_cache_keys:
            if key in cache:
                lat, lng = cache[key]
                break

        # 2) 地理编码（适合地址比较具体的条目）
        geo_used = False
        if lat is None or lng is None:
            if args.mode in ("auto", "geocode") and address and (args.mode == "geocode" or address_seems_specific(item)):
                result = geocode(address, city)
                if result:
                    lat, lng = result
                    for key in set(geo_cache_keys):
                        cache[key] = [lat, lng]
                    geo_used = True
                    time.sleep(args.sleep)

        # 3) POI 搜索（更像“高德搜索”，适合只知道名称/大概位置的条目）
        poi_used = False
        if (lat is None or lng is None) and args.mode in ("auto", "poi"):
            keywords = build_keywords(item)
            if keywords:
                poi_key = f"poi::{keywords}::{city or ''}"
                if poi_key in cache:
                    lat, lng = cache[poi_key]
                else:
                    pois = poi_search(keywords, city, citylimit=args.citylimit, offset=args.poi_offset)
                    scored = []
                    for poi in pois:
                        loc = poi.get("location") or ""
                        if not loc or "," not in loc:
                            continue
                        try:
                            cand_lng, cand_lat = loc.split(",")
                            cand_lat = float(cand_lat)
                            cand_lng = float(cand_lng)
                        except Exception:
                            continue
                        scored.append((score_poi(item, poi), cand_lat, cand_lng, poi))
                    scored.sort(key=lambda t: t[0], reverse=True)
                    if scored and scored[0][0] >= args.poi_threshold:
                        best_score, best_lat, best_lng, _ = scored[0]
                        lat, lng = best_lat, best_lng
                        cache[poi_key] = [lat, lng]
                        poi_used = True
                    elif scored:
                        # 记录前 3 个候选供人工核对
                        report["ambiguous"].append(
                            {
                                "id": item.get("id"),
                                "name": item.get("name"),
                                "province": item.get("province"),
                                "city": item.get("city"),
                                "county": item.get("county"),
                                "query": {"keywords": keywords, "city": city or "", "citylimit": args.citylimit},
                                "candidates": [
                                    {
                                        "score": s,
                                        "name": p.get("name"),
                                        "location": p.get("location"),
                                        "address": p.get("address"),
                                        "type": p.get("type"),
                                    }
                                    for s, _, _, p in scored[:3]
                                ],
                            }
                        )
                    time.sleep(args.sleep)

        if lat is None or lng is None:
            report["missing"] += 1
            continue

        item["lat"] = lat
        item["lng"] = lng
        report["updated"] += 1
        updated_since_checkpoint += 1
        if geo_used:
            report["geo_applied"] += 1
        if poi_used:
            report["poi_applied"] += 1

        if args.checkpoint and updated_since_checkpoint >= args.checkpoint:
            flush()

    flush()
    print(
        f"Checked {report['checked']} items, "
        f"updated {report['updated']} items "
        f"(geo {report['geo_applied']}, poi {report['poi_applied']}), "
        f"missing {report['missing']} items, "
        f"ambiguous {len(report['ambiguous'])} items."
    )


if __name__ == "__main__":
    main()
