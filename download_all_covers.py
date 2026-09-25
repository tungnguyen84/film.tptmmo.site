import json
import urllib.request
import urllib.parse
import re
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COVERS_DIR = os.path.join(BASE_DIR, "covers")
MOVIES_FILE = os.path.join(BASE_DIR, "movies.json")

os.makedirs(COVERS_DIR, exist_ok=True)

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}

def clean_title(t):
    t = re.sub(r'\(.*?\)', '', t)
    t = t.replace('_', ' ').replace('-', ' ').strip()
    return t

def find_trumdrama_cover(title):
    try:
        c_title = clean_title(title)
        qs = urllib.parse.urlencode({'search': c_title, 'pageSize': 3})
        url = f'https://trumdrama.com/api/v1/movies?{qs}'
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode('utf-8'))
            items = d.get('data', [])
            if items:
                cover = items[0].get('coverImageUrl')
                if cover:
                    if cover.startswith('/'):
                        cover = 'https://trumdrama.com' + cover
                    return cover
    except Exception:
        pass
    return None

def download_file(url, target_path):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if len(data) > 1024:
                with open(target_path, 'wb') as f:
                    f.write(data)
                return True
    except Exception as e:
        # print("Download error:", e)
        pass
    return False

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def main():
    if not os.path.exists(MOVIES_FILE):
        print("movies.json not found!")
        return

    with open(MOVIES_FILE, 'r', encoding='utf-8') as f:
        movies = json.load(f)

    print(f"Downloading covers for {len(movies)} movies...")
    success_count = 0

    for i, m in enumerate(movies, start=1):
        mid = m['id']
        title = m['title']
        cover_filename = f"{mid}.jpg"
        target_path = os.path.join(COVERS_DIR, cover_filename)
        m['poster_url'] = f"./covers/{cover_filename}"

        if os.path.exists(target_path) and os.path.getsize(target_path) > 2000:
            success_count += 1
            continue

        # 1. Search TrumDrama cover
        cover_url = find_trumdrama_cover(title)
        dl_ok = False

        if cover_url:
            dl_ok = download_file(cover_url, target_path)

        # 2. Fallback to Google Drive video thumbnail
        if not dl_ok and m.get('episodes'):
            first_fid = m['episodes'][0]['id']
            gdrive_thumb = f"https://drive.google.com/thumbnail?id={first_fid}&sz=w500"
            dl_ok = download_file(gdrive_thumb, target_path)

        if dl_ok:
            success_count += 1
            t_ascii = title.encode('ascii', 'replace').decode('ascii')
            print(f"[{i}/{len(movies)}] OK: {t_ascii}")
        else:
            t_ascii = title.encode('ascii', 'replace').decode('ascii')
            print(f"[{i}/{len(movies)}] Skip: {t_ascii}")

    # Save updated movies.json
    with open(MOVIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)

    print(f"\nHOÀN THÀNH: Đã lưu {success_count}/{len(movies)} ảnh bìa vào thư mục {COVERS_DIR}!")

if __name__ == "__main__":
    main()
