#!/usr/bin/env python3
import argparse
import base64
import json
import math
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_BASE = "https://api.sinorelic.com"
OUTPUT = Path("data/raw/sinorelic_tombs.json")
PREFECTURE_FILE = Path("data/sources/prefecture_cities.json")
REQUEST_TIMEOUT = 30

LEVEL_KEYWORDS = {
    "national": ["国家级", "国家重点", "全国重点", "国保"],
    "provincial": ["省级", "省文物保护单位"],
    "city": ["市级", "市文物保护单位"],
    "county": ["县级", "区级", "旗级", "县文物保护单位", "区文物保护单位"],
}


def load_prefecture_cities() -> Dict[str, List[str]]:
    if not PREFECTURE_FILE.exists():
        return {}
    data = json.loads(PREFECTURE_FILE.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {}
    cleaned: Dict[str, List[str]] = {}
    for key, value in data.items():
        if not isinstance(key, str) or not isinstance(value, list):
            continue
        cleaned[key] = [str(item) for item in value if isinstance(item, str)]
    return cleaned


def load_province_names() -> List[str]:
    try:
        from scripts.ingest.provincial_docx_parse import PROVINCE_NAMES  # type: ignore

        return list(PROVINCE_NAMES)
    except Exception:
        fallback = [
            "北京市",
            "天津市",
            "上海市",
            "重庆市",
            "河北省",
            "山西省",
            "辽宁省",
            "吉林省",
            "黑龙江省",
            "江苏省",
            "浙江省",
            "安徽省",
            "福建省",
            "江西省",
            "山东省",
            "河南省",
            "湖北省",
            "湖南省",
            "广东省",
            "海南省",
            "四川省",
            "贵州省",
            "云南省",
            "陕西省",
            "甘肃省",
            "青海省",
            "台湾省",
            "内蒙古自治区",
            "广西壮族自治区",
            "西藏自治区",
            "宁夏回族自治区",
            "新疆维吾尔自治区",
            "香港特别行政区",
            "澳门特别行政区",
        ]
        return sorted(fallback, key=len, reverse=True)


PROVINCE_NAMES = load_province_names()
PROVINCE_CITIES = load_prefecture_cities()


def request_json(method: str, url: str, headers: Optional[Dict[str, str]] = None, body: Optional[bytes] = None):
    headers = headers or {}
    req = Request(url, data=body, headers=headers, method=method)
    with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return json.load(resp)


def request_json_with_retry(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    body: Optional[bytes] = None,
    retries: int = 3,
    backoff: float = 1.0,
):
    last_error = None
    for attempt in range(retries):
        try:
            return request_json(method, url, headers=headers, body=body)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt + 1 == retries:
                break
            time.sleep(backoff * (2**attempt))
    if last_error:
        raise last_error
    raise RuntimeError("Unknown request failure")


def build_pageinfo(page_index: int, page_size: int) -> str:
    payload = {
        "pageIndex": page_index,
        "pageSize": page_size,
        "sortField": "",
        "sortOrder": "",
        "filters": [],
    }
    return base64.b64encode(json.dumps(payload, ensure_ascii=False).encode("utf-8")).decode("utf-8")


def fetch_category_id() -> str:
    url = f"{API_BASE}/api/platformManager/v1/relicCategory/list"
    data = request_json_with_retry("GET", url)
    for item in data.get("data", []):
        name = item.get("name") or ""
        if "古墓葬" in name:
            return item.get("id")
    raise RuntimeError("Unable to locate relic category for 古墓葬")


def merge_headers(base: Optional[Dict[str, str]], extra: Optional[Dict[str, str]]) -> Dict[str, str]:
    merged: Dict[str, str] = {}
    if base:
        merged.update(base)
    if extra:
        for key, value in extra.items():
            if value:
                merged[key] = value
    return merged


def build_auth_headers(token: Optional[str], front_active_ent_id: Optional[str]) -> Optional[Dict[str, str]]:
    headers: Dict[str, str] = {}
    if token:
        headers["Authorization"] = token
    if front_active_ent_id:
        headers["FrontActiveEntId"] = front_active_ent_id
    return headers or None


def fetch_lite_page(
    page_index: int,
    page_size: int,
    category_ids: Optional[List[str]] = None,
    keywords: Optional[str] = None,
    auth_headers: Optional[Dict[str, str]] = None,
) -> Dict:
    url = f"{API_BASE}/api/portal/v1/search/relicPoint/lite"
    headers = merge_headers(
        {
            "Content-Type": "application/json",
            "pageInfo": build_pageinfo(page_index, page_size),
        },
        auth_headers,
    )
    payload: Dict[str, object] = {}
    if category_ids:
        payload["relicCategoryIdList"] = category_ids
    if keywords:
        payload["keywords"] = keywords
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return request_json_with_retry("POST", url, headers=headers, body=body)


def fetch_complex_search_page(
    page_index: int,
    page_size: int,
    keywords: str,
    auth_headers: Optional[Dict[str, str]] = None,
) -> Dict:
    url = f"{API_BASE}/api/portal/v1/search/complexInfo"
    headers = merge_headers(
        {
            "Content-Type": "application/json",
            "pageInfo": build_pageinfo(page_index, page_size),
        },
        auth_headers,
    )
    payload: Dict[str, object] = {"keywords": keywords}
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return request_json_with_retry("POST", url, headers=headers, body=body)

def fetch_detail(relic_point_id: str, auth_headers: Optional[Dict[str, str]] = None) -> Dict:
    url = f"{API_BASE}/api/portal/v1/relicPoint/{relic_point_id}"
    return request_json_with_retry("GET", url, headers=auth_headers)


def fetch_list_page(
    page_index: int,
    page_size: int,
    auth_headers: Optional[Dict[str, str]] = None,
) -> Dict:
    url = f"{API_BASE}/api/portal/v1/relicPoint/list"
    headers = merge_headers(
        {
            "pageInfo": build_pageinfo(page_index, page_size),
        },
        auth_headers,
    )
    return request_json_with_retry("GET", url, headers=headers)


def map_level(rank_name: Optional[str]) -> Optional[str]:
    if not rank_name:
        return None
    for level, tokens in LEVEL_KEYWORDS.items():
        if any(token in rank_name for token in tokens):
            return level
    return None


def extract_province(address: Optional[str]) -> Optional[str]:
    if not address:
        return None
    for name in PROVINCE_NAMES:
        if name in address:
            return name
    return None


def infer_city_from_address(address: Optional[str], province: Optional[str]) -> Optional[str]:
    if not address or not province:
        return None
    cities = PROVINCE_CITIES.get(province) or []
    for city in sorted(cities, key=len, reverse=True):
        if city in address:
            return city
    return None


def infer_province_from_city(city: Optional[str]) -> Optional[str]:
    if not city:
        return None
    for province, cities in PROVINCE_CITIES.items():
        if city in cities:
            return province
    return None


def extract_county(address: Optional[str], city: Optional[str]) -> Optional[str]:
    if not address:
        return None
    match = re.search(r"([\u4e00-\u9fa5]{1,8}(?:区|县|旗))", address)
    if not match:
        match = re.search(r"([\u4e00-\u9fa5]{1,8}市)", address)
    if not match:
        return None
    county = match.group(1)
    if city and county == city:
        return None
    return county


def extract_location(address: Optional[str], area_name: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    province = extract_province(address)
    city = infer_city_from_address(address, province) if address else None
    if not city and area_name:
        city = area_name
    if not province:
        province = infer_province_from_city(city)
    county = extract_county(address, city)
    return province, city, county


def normalize_relic_id(raw: str) -> Optional[str]:
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None
    if raw.startswith("sinorelic-"):
        raw = raw.replace("sinorelic-", "", 1)
    match = re.search(r"/relicPoint/(\d+)", raw)
    if match:
        return match.group(1)
    if raw.isdigit():
        return raw
    return None


def parse_extra_ids(text: str) -> List[str]:
    results: List[str] = []
    for token in re.split(r"[,\s]+", text.strip()):
        relic_id = normalize_relic_id(token)
        if relic_id:
            results.append(relic_id)
    return results


def merge_seed(existing: Optional[Dict], new: Optional[Dict]) -> Dict:
    merged = dict(existing or {})
    for key, value in (new or {}).items():
        if value is None:
            continue
        if key not in merged or merged[key] in (None, "", [], {}):
            merged[key] = value
    return merged


def seed_from_lite(item: Dict) -> Dict:
    return {
        "name": item.get("name") or item.get("complexName"),
        "lat": item.get("latitude"),
        "lng": item.get("longitude"),
        "image_url": item.get("logo") or item.get("cover"),
    }


def seed_from_complex(item: Dict) -> Dict:
    relation = item.get("relation") or {}
    relic = relation.get("relic") or {}
    area = relation.get("area") or {}
    relic_rank = relic.get("relicRank") or relation.get("relicRank") or {}
    relic_category = relic.get("relicCategory") or relation.get("relicCategory") or {}
    return {
        "name": relation.get("name") or relic.get("name") or item.get("title"),
        "address": relation.get("address") or relic.get("address"),
        "area_name": area.get("name"),
        "lat": relation.get("latitude") or relic.get("latitude"),
        "lng": relation.get("longitude") or relic.get("longitude"),
        "image_url": relation.get("cover") or relation.get("logo") or relic.get("cover") or relic.get("logo"),
        "rank_name": relic_rank.get("name"),
        "era": relic.get("era"),
        "category_name": relic_category.get("name"),
    }


def seed_from_list(item: Dict) -> Dict:
    relic = item.get("relic") or {}
    area = item.get("area") or {}
    relic_rank = relic.get("relicRank") or {}
    relic_category = relic.get("relicCategory") or {}
    cover = item.get("cover") if isinstance(item.get("cover"), dict) else {}
    cover_url = cover.get("url") if isinstance(cover, dict) else None
    return {
        "name": item.get("name") or item.get("complexName") or relic.get("name"),
        "address": item.get("address") or relic.get("address"),
        "area_name": area.get("name"),
        "lat": item.get("latitude"),
        "lng": item.get("longitude"),
        "image_url": cover_url,
        "rank_name": relic_rank.get("name"),
        "era": item.get("era") or relic.get("era"),
        "category_name": relic_category.get("name"),
    }


def seed_matches_keywords(seed: Dict, name_keywords: List[str]) -> bool:
    name = seed.get("name") or ""
    category_name = seed.get("category_name") or ""
    if "古墓葬" in category_name:
        return True
    return any(token in name for token in name_keywords)


def build_stub_item(relic_id: str, seed: Optional[Dict], reason: str) -> Dict:
    seed = seed or {}
    address = seed.get("address")
    area_name = seed.get("area_name")
    province, city, county = extract_location(address, area_name)
    image_url = seed.get("image_url")
    image_urls = [image_url] if image_url else []
    rank_name = seed.get("rank_name")
    note = f"sinorelic.com API; {reason}"
    return {
        "id": f"sinorelic-{relic_id}",
        "name": seed.get("name") or None,
        "person": None,
        "level": map_level(rank_name),
        "category": "古墓葬",
        "era": seed.get("era"),
        "province": province,
        "city": city,
        "county": county,
        "address": address,
        "lat": seed.get("lat"),
        "lng": seed.get("lng"),
        "image_urls": image_urls,
        "source": {
            "title": "华夏古迹图",
            "year": None,
            "note": note,
            "url": f"https://www.sinorelic.com/relicPoint/{relic_id}",
        },
    }


def build_item(
    relic_id: str,
    detail: Dict,
    name_keywords: List[str],
    seed: Optional[Dict] = None,
    force_include: bool = False,
) -> Tuple[Optional[Dict], Optional[str]]:
    data = detail.get("data") or {}
    if not data:
        if force_include or seed:
            return build_stub_item(relic_id, seed, "detail unavailable; included via search"), "detail_unavailable"
        return None, "detail_unavailable"

    relic = data.get("relic") or {}
    relic_category = relic.get("relicCategory") or {}
    category_name = relic_category.get("name") or ""
    name = data.get("name") or relic.get("name") or (seed or {}).get("name") or ""
    address = data.get("address") or relic.get("address") or (seed or {}).get("address")
    area = data.get("area") or {}
    area_name = area.get("name") or (seed or {}).get("area_name")
    relic_rank = relic.get("relicRank") or {}
    rank_name = relic_rank.get("name") or (seed or {}).get("rank_name")
    cover = data.get("cover") if isinstance(data.get("cover"), dict) else {}
    cover_url = cover.get("url") if isinstance(cover, dict) else None
    cover_url = cover_url or (seed or {}).get("image_url")
    image_urls = [cover_url] if cover_url else []

    if "古墓葬" not in category_name and not any(token in name for token in name_keywords):
        if force_include:
            fallback_seed = merge_seed(
                seed,
                {
                    "name": name or None,
                    "address": address,
                    "area_name": area_name,
                    "lat": data.get("latitude"),
                    "lng": data.get("longitude"),
                    "image_url": cover_url,
                    "rank_name": rank_name,
                    "era": data.get("era") or relic.get("era"),
                    "category_name": category_name,
                },
            )
            return build_stub_item(relic_id, fallback_seed, "filtered by category/name; included via search"), "filtered_out"
        return None, "filtered_out"

    province, city, county = extract_location(address, area_name)

    return (
        {
            "id": f"sinorelic-{data.get('id') or relic_id}",
            "name": name or None,
            "person": None,
            "level": map_level(rank_name),
            "category": "古墓葬",
            "era": data.get("era") or relic.get("era") or (seed or {}).get("era"),
            "province": province,
            "city": city,
            "county": county,
            "address": address,
            "lat": data.get("latitude") or (seed or {}).get("lat"),
            "lng": data.get("longitude") or (seed or {}).get("lng"),
            "image_urls": image_urls,
            "source": {
                "title": "华夏古迹图",
                "year": None,
                "note": "sinorelic.com API",
                "url": "https://www.sinorelic.com/home",
            },
        },
        None,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch tomb data from sinorelic.com API.")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--page-size", type=int, default=500)
    parser.add_argument("--sleep", type=float, default=0.05)
    parser.add_argument("--timeout", type=float, default=30.0, help="HTTP timeout in seconds.")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of detail items (for testing).")
    parser.add_argument("--resume", action="store_true", help="Skip IDs already present in output file.")
    parser.add_argument("--checkpoint", type=int, default=200)
    parser.add_argument(
        "--keywords",
        type=str,
        default="墓,陵,冢,坟",
        help="Comma-separated keywords to include by name match.",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="Authorization token from sinorelic.com (LocalStorage: token).",
    )
    parser.add_argument(
        "--front-active-ent-id",
        type=str,
        default=None,
        help="Optional FrontActiveEntId header value.",
    )
    parser.add_argument(
        "--list-all",
        action="store_true",
        default=False,
        help="Collect relicPoint IDs from /api/portal/v1/relicPoint/list (may be large).",
    )
    parser.add_argument(
        "--list-only",
        action="store_true",
        default=False,
        help="Only collect IDs from relicPoint list (skip keyword/category/complex searches).",
    )
    parser.add_argument(
        "--list-page-start",
        type=int,
        default=0,
        help="Start page index for relicPoint list collection.",
    )
    parser.add_argument(
        "--list-page-count",
        type=int,
        default=None,
        help="Number of list pages to fetch (for chunked runs).",
    )
    parser.add_argument(
        "--search-all",
        dest="search_all",
        action="store_true",
        default=True,
        help="Collect relicPoint IDs from site-wide search (complexInfo).",
    )
    parser.add_argument(
        "--no-search-all",
        dest="search_all",
        action="store_false",
        help="Disable site-wide search (complexInfo).",
    )
    parser.add_argument(
        "--search-terms",
        type=str,
        default=None,
        help="Comma-separated search terms for site-wide search (defaults to --keywords).",
    )
    parser.add_argument(
        "--search-extra-output",
        type=Path,
        default=None,
        help="Optional path to write non-relicPoint search results.",
    )
    parser.add_argument(
        "--extra-ids",
        type=str,
        default=None,
        help="Comma/space-separated relicPoint IDs or URLs to force include.",
    )
    parser.add_argument(
        "--extra-ids-file",
        type=Path,
        default=None,
        help="File containing relicPoint IDs/URLs (one per line or JSON list).",
    )
    args = parser.parse_args()

    global REQUEST_TIMEOUT
    REQUEST_TIMEOUT = args.timeout

    category_id = fetch_category_id()
    keyword_list = [token.strip() for token in args.keywords.split(",") if token.strip()]
    auth_headers = build_auth_headers(args.token, args.front_active_ent_id)
    search_terms = (
        [token.strip() for token in args.search_terms.split(",") if token.strip()]
        if args.search_terms
        else list(keyword_list)
    )

    ids: List[str] = []
    seen = set()
    id_sources: Dict[str, set] = {}
    seed_by_id: Dict[str, Dict] = {}

    def add_id(relic_id: Optional[str], source: str, seed: Optional[Dict] = None) -> None:
        if not relic_id:
            return
        if relic_id not in seen:
            seen.add(relic_id)
            ids.append(relic_id)
        id_sources.setdefault(relic_id, set()).add(source)
        if seed:
            seed_by_id[relic_id] = merge_seed(seed_by_id.get(relic_id), seed)

    def collect_ids(
        category_ids: Optional[List[str]] = None,
        keywords: Optional[str] = None,
        source_label: str = "lite",
    ) -> None:
        first = fetch_lite_page(
            0,
            args.page_size,
            category_ids=category_ids,
            keywords=keywords,
            auth_headers=auth_headers,
        )
        total = first.get("total") or len(first.get("data") or [])
        pages = int(math.ceil(total / args.page_size)) if args.page_size > 0 else 1
        for page_index in range(pages):
            page = (
                first
                if page_index == 0
                else fetch_lite_page(
                    page_index,
                    args.page_size,
                    category_ids=category_ids,
                    keywords=keywords,
                    auth_headers=auth_headers,
                )
            )
            for item in page.get("data", []):
                relic_id = item.get("id")
                add_id(relic_id, source_label, seed_from_lite(item))

    search_extra: List[Dict] = []
    search_extra_seen = set()
    search_type_counts: Dict[str, int] = {}

    def collect_ids_from_complex_search(keywords: str) -> None:
        first = fetch_complex_search_page(0, args.page_size, keywords=keywords, auth_headers=auth_headers)
        total = first.get("total") or len(first.get("data") or [])
        pages = int(math.ceil(total / args.page_size)) if args.page_size > 0 else 1
        for page_index in range(pages):
            page = (
                first
                if page_index == 0
                else fetch_complex_search_page(
                    page_index,
                    args.page_size,
                    keywords=keywords,
                    auth_headers=auth_headers,
                )
            )
            for item in page.get("data", []):
                relation_type = item.get("relationType") or "unknown"
                search_type_counts[relation_type] = search_type_counts.get(relation_type, 0) + 1
                relation = item.get("relation") or {}
                if relation_type == "relicPoint":
                    relic_id = relation.get("id") or item.get("relationId") or item.get("id")
                    add_id(relic_id, f"complex:{keywords}", seed_from_complex(item))
                elif args.search_extra_output:
                    rel_id = relation.get("id") or item.get("relationId") or item.get("id")
                    key = f"{relation_type}:{rel_id}"
                    if key in search_extra_seen:
                        continue
                    search_extra_seen.add(key)
                    search_extra.append(item)

    def collect_ids_from_list() -> None:
        first = fetch_list_page(0, args.page_size, auth_headers=auth_headers)
        total = first.get("total") or len(first.get("data") or [])
        pages = int(math.ceil(total / args.page_size)) if args.page_size > 0 else 1
        start = max(args.list_page_start, 0)
        end = pages
        if args.list_page_count is not None:
            end = min(end, start + args.list_page_count)
        if start >= pages:
            return
        for page_index in range(start, end):
            page = first if page_index == 0 else fetch_list_page(
                page_index, args.page_size, auth_headers=auth_headers
            )
            for item in page.get("data", []):
                seed = seed_from_list(item)
                if not seed_matches_keywords(seed, keyword_list):
                    continue
                relic_id = item.get("id")
                add_id(relic_id, "list", seed)

    if args.list_all or args.list_only:
        collect_ids_from_list()
    if not args.list_only:
        collect_ids(category_ids=[category_id], source_label="category")
        for keyword in keyword_list:
            collect_ids(category_ids=None, keywords=keyword, source_label=f"keyword:{keyword}")
        if args.search_all:
            for term in search_terms:
                collect_ids_from_complex_search(term)

    extra_ids: List[str] = []
    if args.extra_ids:
        extra_ids.extend(parse_extra_ids(args.extra_ids))
    if args.extra_ids_file and args.extra_ids_file.exists():
        raw_text = args.extra_ids_file.read_text(encoding="utf-8").strip()
        if raw_text:
            if raw_text.lstrip().startswith("["):
                try:
                    data = json.loads(raw_text)
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, str):
                                extra_ids.extend(parse_extra_ids(item))
                except json.JSONDecodeError:
                    extra_ids.extend(parse_extra_ids(raw_text))
            else:
                extra_ids.extend(parse_extra_ids(raw_text))
    for relic_id in extra_ids:
        add_id(relic_id, "extra")

    output_items: List[Dict] = []
    existing_ids = set()
    if args.resume and args.output.exists():
        existing = json.loads(args.output.read_text(encoding="utf-8"))
        for item in existing:
            existing_ids.add(item.get("id"))
        output_items.extend(existing)

    processed = 0
    missing_detail = 0
    filtered_out = 0
    skipped_missing_detail = 0
    for relic_id in ids:
        if args.limit is not None and processed >= args.limit:
            break
        if f"sinorelic-{relic_id}" in existing_ids:
            continue
        try:
            detail = fetch_detail(relic_id, auth_headers=auth_headers)
        except Exception as exc:
            detail = {"data": None, "state": "error", "message": str(exc)}
        sources = id_sources.get(relic_id, set())
        force_include = any(source.startswith("complex:") for source in sources) or "extra" in sources
        seed = seed_by_id.get(relic_id)
        item, reason = build_item(
            relic_id,
            detail,
            keyword_list,
            seed=seed,
            force_include=force_include,
        )
        if item:
            output_items.append(item)
            processed += 1
        if reason == "detail_unavailable":
            if item:
                missing_detail += 1
            else:
                skipped_missing_detail += 1
        elif reason == "filtered_out":
            if item:
                filtered_out += 1
        if args.sleep:
            time.sleep(args.sleep)
        if args.checkpoint and processed % args.checkpoint == 0:
            args.output.write_text(
                json.dumps(output_items, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"Checkpoint: {processed} items written")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output_items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(output_items)} items to {args.output}")
    if missing_detail or filtered_out or skipped_missing_detail:
        print(
            f"Included {missing_detail} items with missing detail; "
            f"{filtered_out} items included via search despite category/name filters; "
            f"skipped {skipped_missing_detail} items with no detail or seed."
        )
    if args.search_all:
        print(f"Search types: {json.dumps(search_type_counts, ensure_ascii=False)}")
    if args.search_extra_output and search_extra:
        args.search_extra_output.parent.mkdir(parents=True, exist_ok=True)
        args.search_extra_output.write_text(
            json.dumps(search_extra, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"Wrote {len(search_extra)} non-relicPoint search items to {args.search_extra_output}")


if __name__ == "__main__":
    main()
