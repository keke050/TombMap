#!/usr/bin/env python3
import argparse
import json
import math
import os
import time
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlencode
from urllib.request import urlopen

INPUT = Path("data/seed/tombs.json")
OUTPUT = Path("data/seed/tombs.json")
CACHE = Path("data/raw/geocode_cache.json")
REPORT = Path("data/raw/geocode_verify_report.json")


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


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    to_rad = math.radians
    dlat = to_rad(lat2 - lat1)
    dlng = to_rad(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def geocode(address: str, city: Optional[str]) -> Optional[Tuple[float, float]]:
    params = {"key": KEY, "address": address, "city": city or ""}
    url = f"https://restapi.amap.com/v3/geocode/geo?{urlencode(params)}"
    try:
        data = json.loads(urlopen(url).read().decode("utf-8"))
    except Exception:
        return None
    if data.get("status") != "1":
        return None
    geocodes = data.get("geocodes") or []
    if not geocodes:
        return None
    location = geocodes[0].get("location")
    if not location:
        return None
    lng, lat = location.split(",")
    return float(lat), float(lng)


def build_address(item: dict) -> Tuple[Optional[str], Optional[str], str, Optional[str]]:
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


def matches_filters(item: dict, args: argparse.Namespace) -> bool:
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
    if args.city and not (
        contains(item.get("city"), args.city) or contains(item.get("address"), args.city)
    ):
        return False
    if args.county and not (
        contains(item.get("county"), args.county) or contains(item.get("address"), args.county)
    ):
        return False
    if args.only_missing and item.get("lat") is not None and item.get("lng") is not None:
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="校对墓葬坐标（高德地理编码）")
    parser.add_argument("--input", help="输入 JSON 文件路径", default=str(INPUT))
    parser.add_argument("--output", help="输出 JSON 文件路径", default=str(OUTPUT))
    parser.add_argument("--apply", action="store_true", help="直接更新坐标到输出文件")
    parser.add_argument("--threshold-km", type=float, default=20, help="超过该距离判定为偏差")
    parser.add_argument("--sleep", type=float, default=0.4, help="每次请求间隔（秒）")
    parser.add_argument("--limit", type=int, default=0, help="仅处理前 N 条（0 为不限制）")
    parser.add_argument("--province", help="仅处理指定省份（支持子串匹配）")
    parser.add_argument("--city", help="仅处理指定城市（支持子串匹配）")
    parser.add_argument("--county", help="仅处理指定区县（支持子串匹配）")
    parser.add_argument("--name", help="仅处理名称包含该关键词的条目")
    parser.add_argument("--only-missing", action="store_true", help="仅补全缺失坐标")
    args = parser.parse_args()

    if not KEY:
        raise SystemExit("请设置 AMAP_WEB_KEY 环境变量。")

    input_path = Path(args.input)
    output_path = Path(args.output)
    items = json.loads(input_path.read_text(encoding="utf-8"))
    cache = load_cache()
    report = {
        "checked": 0,
        "updated": 0,
        "missing": 0,
        "filtered": 0,
        "mismatch": [],
        "filters": {
            "province": args.province,
            "city": args.city,
            "county": args.county,
            "name": args.name,
            "only_missing": args.only_missing,
            "limit": args.limit,
        },
    }

    for item in items:
        if not matches_filters(item, args):
            report["filtered"] += 1
            continue
        if args.limit and report["checked"] >= args.limit:
            break
        address, city, raw_address, raw_city = build_address(item)
        if not address:
            report["missing"] += 1
            continue
        cache_keys = []
        if raw_address:
            cache_keys.append(f"{raw_address}::{raw_city or ''}")
        cache_keys.append(f"{address}::{city or ''}")

        lat = lng = None
        for key in cache_keys:
            if key in cache:
                lat, lng = cache[key]
                break
        if lat is not None and lng is not None:
            for key in set(cache_keys):
                if key not in cache:
                    cache[key] = [lat, lng]
        else:
            result = geocode(address, city)
            if not result:
                report["missing"] += 1
                continue
            lat, lng = result
            for key in set(cache_keys):
                cache[key] = [lat, lng]
            time.sleep(args.sleep)

        report["checked"] += 1
        old_lat = item.get("lat")
        old_lng = item.get("lng")
        if old_lat is None or old_lng is None:
            if args.apply:
                item["lat"] = lat
                item["lng"] = lng
                report["updated"] += 1
            continue

        try:
            distance_km = haversine_km(float(old_lat), float(old_lng), lat, lng)
        except Exception:
            distance_km = args.threshold_km + 1
        if distance_km >= args.threshold_km:
            report["mismatch"].append(
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "province": item.get("province"),
                    "city": item.get("city"),
                    "county": item.get("county"),
                    "address": item.get("address"),
                    "old": [old_lat, old_lng],
                    "new": [lat, lng],
                    "distance_km": round(distance_km, 2),
                }
            )
            if args.apply:
                item["lat"] = lat
                item["lng"] = lng
                report["updated"] += 1

    if args.apply:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    save_cache(cache)
    print(
        f"Checked {report['checked']} items, "
        f"updated {report['updated']} items, "
        f"missing {report['missing']} items, "
        f"mismatch {len(report['mismatch'])} items."
    )


if __name__ == "__main__":
    main()
