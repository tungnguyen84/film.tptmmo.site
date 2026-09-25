import urllib.request
import urllib.parse
import json
import os
import re
import sys
import unicodedata
import time
from concurrent.futures import ThreadPoolExecutor

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQlJD1OfbIGa_csySw1JjGPvuTyW8Air-DLvAF2RXSTRuC8a2SCBdVh_0DPLDpwqrtFQ/exec"
FOLDER_ID = "1TvAthXpZpP1vv1Lv9wYp8lZrvMo3FWB7"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COVERS_DIR = os.path.join(BASE_DIR, "covers")
OUTPUT_FILE = os.path.join(BASE_DIR, "movies.json")
CATALOG_FILE = os.path.join(BASE_DIR, "trumdrama_catalog.json")

os.makedirs(COVERS_DIR, exist_ok=True)
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

def remove_accents(input_str):
    if not input_str:
        return ""
    s = unicodedata.normalize('NFD', input_str)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('đ', 'd').replace('Đ', 'D')
    return s

def clean_title(t):
    if not t:
        return ""
    t = re.sub(r'\(.*?\)', '', t)
    t = re.sub(r'\[.*?\]', '', t)
    t = t.replace('_', ' ').replace('-', ' ').strip()
    return re.sub(r'\s+', ' ', t)

def normalize_key(s):
    if not s:
        return ""
    s = clean_title(s).lower()
    s = re.sub(r'[^a-zA-Z0-9\sàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def make_slug(s):
    no_accent = remove_accents(clean_title(s)).lower()
    slug = re.sub(r'[^a-z0-9]+', '-', no_accent).strip('-')
    return slug

def is_valid_image_bytes(data):
    if not data or len(data) < 100:
        return False
    # JPEG (\xff\xd8)
    if data.startswith(b'\xff\xd8'):
        return True
    # PNG (\x89PNG)
    if data.startswith(b'\x89PNG'):
        return True
    # WEBP (RIFF....WEBP)
    if data.startswith(b'RIFF') and b'WEBP' in data[:16]:
        return True
    return False

def is_file_valid_image(filepath):
    if not os.path.exists(filepath) or os.path.getsize(filepath) < 1000:
        return False
    try:
        with open(filepath, 'rb') as f:
            return is_valid_image_bytes(f.read(32))
    except Exception:
        return False

def load_catalog():
    if os.path.exists(CATALOG_FILE):
        try:
            with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"[CATALOG] Đã nạp {len(data)} mục phim từ {CATALOG_FILE}.")
                return data
        except Exception as e:
            print(f"[CATALOG] Lỗi nạp {CATALOG_FILE}: {e}")
    return {}

def find_trumdrama_cover_online(title):
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

def download_image(url, target_path):
    if not url:
        return False
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            if is_valid_image_bytes(data):
                with open(target_path, 'wb') as f:
                    f.write(data)
                return True
    except Exception:
        pass
    return False

def sync():
    print("=" * 60)
    print("DramaPlay Auto-Sync: Quét Google Drive & Khớp Ảnh Bìa Phim")
    print("=" * 60)
    
    catalog = load_catalog()

    print("Đang kết nối Google Drive qua Apps Script...")
    url = f"{SCRIPT_URL}?folderId={FOLDER_ID}"
    req = urllib.request.Request(url, headers=HEADERS)
    
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if not data.get("success") or "movies" not in data:
                print(f"[ERROR] Google Drive trả về lỗi: {data.get('error')}")
                return False

            movies = data["movies"]
            total_movies = len(movies)
            print(f"[OK] Đã tìm thấy {total_movies} bộ phim trên Google Drive.")

            download_tasks = []

            for m in movies:
                mid = m['id']
                raw_title = m['title']
                cover_filename = f"{mid}.jpg"
                target_path = os.path.join(COVERS_DIR, cover_filename)
                m['poster_url'] = f"./covers/{cover_filename}"

                # Nếu ảnh chưa có hoặc bị hỏng (file HTML)
                if not is_file_valid_image(target_path):
                    # Danh sách ứng viên theo thứ tự ưu tiên
                    candidates = []

                    norm_k = normalize_key(raw_title)
                    slug_k = make_slug(raw_title)

                    if norm_k in catalog and catalog[norm_k].get('cover'):
                        candidates.append(catalog[norm_k]['cover'])
                    if slug_k in catalog and catalog[slug_k].get('cover'):
                        candidates.append(catalog[slug_k]['cover'])

                    # Luôn luôn có fallback là thumbnail từ Tập 1 của Drive (100% public & cực nét)
                    if m.get('episodes') and len(m['episodes']) > 0:
                        first_fid = m['episodes'][0]['id']
                        candidates.append(f"https://drive.google.com/thumbnail?id={first_fid}&sz=w500")

                    download_tasks.append((candidates, target_path, raw_title))

            if download_tasks:
                print(f"Đang tải và kiểm tra {len(download_tasks)} ảnh bìa chuẩn đa luồng...")
                def _worker(task):
                    candidates, path, name = task
                    for c_url in candidates:
                        if download_image(c_url, path):
                            return True
                    # Tìm online nếu các ứng viên trước không ra ảnh thật
                    online_c = find_trumdrama_cover_online(name)
                    if online_c and download_image(online_c, path):
                        return True
                    return False

                with ThreadPoolExecutor(max_workers=8) as pool:
                    dl_results = list(pool.map(_worker, download_tasks))
                
                success_count = sum(1 for r in dl_results if r)
                print(f"[OK] Đã tải thành công {success_count}/{len(download_tasks)} ảnh bìa hợp lệ (JPEG/PNG)!")
            else:
                print("Tất cả ảnh bìa đã có sẵn đầy đủ và hợp lệ, không cần tải lại.")

            # Ghi movies.json an toàn
            temp_file = OUTPUT_FILE + ".tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(movies, f, ensure_ascii=False, indent=2)
            
            if os.path.exists(OUTPUT_FILE):
                os.remove(OUTPUT_FILE)
            os.rename(temp_file, OUTPUT_FILE)

            print(f"[THÀNH CÔNG] Đã cập nhật xong danh sách {len(movies)} phim vào {OUTPUT_FILE}!")
            return True

    except Exception as e:
        print(f"[ERROR] Sync thất bại: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    sync()
