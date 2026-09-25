import urllib.request
import json
import time
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_CATALOG = os.path.join(BASE_DIR, "trumdrama_catalog.json")

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}

def fetch_page(p):
    url = f"https://trumdrama.com/api/v1/movies?page={p}&pageSize=50"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as r:
                d = json.loads(r.read())
                return d.get('data', [])
        except Exception:
            time.sleep(1)
    return []

def normalize_key(s):
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r'\(.*?\)', '', s)
    s = s.replace('_', ' ').replace('-', ' ')
    s = re.sub(r'[^a-zA-Z0-9\sàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def main():
    print("Bắt đầu nạp toàn bộ danh mục 10.600+ phim từ Trùm Drama...")
    t0 = time.time()

    # Get total pages first
    req = urllib.request.Request("https://trumdrama.com/api/v1/movies?page=1&pageSize=50", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as r:
        init_data = json.loads(r.read())
        total_items = init_data.get("total", 10689)
        total_pages = init_data.get("totalPages", 214)

    print(f"Tổng kho Trùm Drama: {total_items} phim ({total_pages} trang).")
    pages = list(range(1, total_pages + 1))

    all_movies = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(fetch_page, pages))

    count_with_cover = 0
    catalog_by_name = {}

    for page_items in results:
        for m in page_items:
            mid = m.get('id')
            title = m.get('title') or ""
            slug = m.get('slug') or ""
            cover = m.get('coverImageUrl')
            if cover and cover.startswith('/'):
                cover = 'https://trumdrama.com' + cover

            item = {
                "id": mid,
                "title": title,
                "slug": slug,
                "cover": cover,
                "totalEpisodes": m.get('totalEpisodes', 0)
            }

            if cover:
                count_with_cover += 1

            if slug:
                catalog_by_name[slug.lower()] = item
            if title:
                norm_title = normalize_key(title)
                catalog_by_name[norm_title] = item

    t1 = time.time()
    print(f"Thu thập thành công {len(catalog_by_name)} mục phim (trong đó {count_with_cover} phim có ảnh bìa) trong {t1 - t0:.2f}s!")

    with open(OUT_CATALOG, "w", encoding="utf-8") as f:
        json.dump(catalog_by_name, f, ensure_ascii=False, indent=1)

    print(f"Đã lưu cơ sở dữ liệu ảnh bìa vào: {OUT_CATALOG} ({os.path.getsize(OUT_CATALOG)/(1024*1024):.2f} MB)")

if __name__ == "__main__":
    main()
