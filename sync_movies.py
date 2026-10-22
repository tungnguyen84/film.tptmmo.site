import urllib.request
import urllib.parse
import json
import os
import re
import sys
import html
import unicodedata
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

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
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
}

ENTRY_REGEX = re.compile(
    r'id="entry-([^"]+)"[^>]*>.*?<div class="flip-entry-title">([^<]+)</div>',
    re.DOTALL
)

VIDEO_EXT_REGEX = re.compile(r'\.(mp4|mkv|mov|webm|avi|m4v|ts|flv)$', re.IGNORECASE)
NON_VIDEO_EXT_REGEX = re.compile(r'\.(jpg|jpeg|png|webp|gif|txt|json|srt|ass|vtt|nfo|db|ini)$', re.IGNORECASE)


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


def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s or '')]


def is_valid_image_bytes(data):
    if not data or len(data) < 100:
        return False
    if data.startswith(b'\xff\xd8'):
        return True
    if data.startswith(b'\x89PNG'):
        return True
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
                print(f"[CATALOG] Đã nạp {len(data)} mục phim từ trumdrama_catalog.json.")
                return data
        except Exception as e:
            print(f"[CATALOG] Lỗi nạp {CATALOG_FILE}: {e}")
    return {}


def load_existing_movies():
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                arr = json.load(f)
                if isinstance(arr, list):
                    by_id = {}
                    for m in arr:
                        if isinstance(m, dict) and m.get('id') and m.get('episodes'):
                            # Compact existing episodes to save size
                            compact_eps = []
                            for idx, ep in enumerate(m['episodes']):
                                eid = ep.get('id') if isinstance(ep, dict) else str(ep)
                                ename = ep.get('name') if isinstance(ep, dict) else f"Tập {idx + 1:02d}"
                                if eid:
                                    compact_eps.append({"id": eid, "name": ename})
                            if compact_eps:
                                m['episodes'] = compact_eps
                                m['total_episodes'] = len(compact_eps)
                                by_id[m['id']] = m
                    print(f"[CACHE] Đã nạp {len(by_id)} bộ phim có sẵn từ movies.json.")
                    return by_id
        except Exception as e:
            print(f"[CACHE] Không đọc được movies.json cũ: {e}")
    return {}


def fetch_drive_folder_entries(folder_id, retries=3):
    """Quét danh sách mục con trong 1 thư mục Google Drive cực nhanh qua embeddedfolderview."""
    url = f"https://drive.google.com/embeddedfolderview?id={folder_id}#list"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw_html = resp.read().decode('utf-8', errors='replace')
                matches = ENTRY_REGEX.findall(raw_html)
                results = []
                for entry_id, raw_title in matches:
                    title = html.unescape(raw_title).strip()
                    if entry_id and title:
                        results.append((entry_id.strip(), title))
                return results
        except Exception:
            if attempt < retries - 1:
                time.sleep(0.6 * (attempt + 1))
    return []


def resolve_initial_poster(movie, catalog):
    mid = movie['id']
    raw_title = movie['title']
    cover_filename = f"{mid}.jpg"
    local_path = os.path.join(COVERS_DIR, cover_filename)

    if is_file_valid_image(local_path):
        return f"./covers/{cover_filename}"

    norm_k = normalize_key(raw_title)
    slug_k = make_slug(raw_title)

    if norm_k in catalog and catalog[norm_k].get('cover'):
        return catalog[norm_k]['cover']
    if slug_k in catalog and catalog[slug_k].get('cover'):
        return catalog[slug_k]['cover']

    if movie.get('episodes') and len(movie['episodes']) > 0:
        first_fid = movie['episodes'][0]['id']
        return f"https://drive.google.com/thumbnail?id={first_fid}&sz=w400"

    return f"./covers/{cover_filename}"


def save_movies_json(movies_list):
    temp_file = OUTPUT_FILE + ".tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(movies_list, f, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)
    os.rename(temp_file, OUTPUT_FILE)


def download_image(url, target_path):
    if not url:
        return False
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = resp.read()
            if is_valid_image_bytes(data):
                with open(target_path, 'wb') as f:
                    f.write(data)
                return True
    except Exception:
        pass
    return False


def sync():
    force_rescan = ('--full' in sys.argv)
    t_start = time.time()

    print("=" * 65)
    print("  DRAMAPLAY PRO: ĐỒNG BỘ SIÊU TỐC ĐA LUỒNG TỪ GOOGLE DRIVE")
    print("=" * 65)

    catalog = load_catalog()
    cached_by_id = {} if force_rescan else load_existing_movies()

    print(f"[1/3] Đang lấy danh sách thư mục phim từ Google Drive ({FOLDER_ID})...")
    folder_entries = fetch_drive_folder_entries(FOLDER_ID, retries=4)

    if not folder_entries:
        print("[!] Không lấy được danh sách qua embeddedfolderview, thử qua Apps Script...")
        try:
            req = urllib.request.Request(f"{SCRIPT_URL}?folderId={FOLDER_ID}", headers=HEADERS)
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get("success") and data.get("movies"):
                    movies = data["movies"]
                    for m in movies:
                        m['poster_url'] = resolve_initial_poster(m, catalog)
                    save_movies_json(movies)
                    print(f"[OK] Đã lưu {len(movies)} phim.")
                    return True
        except Exception as e:
            print(f"[LỖI] Không thể kết nối Google Drive: {e}")
            return False

    total_folders = len(folder_entries)
    print(f"[OK] Phát hiện tổng cộng {total_folders} thư mục phim trên Google Drive!")

    # Tách các phim đã có sẵn trong cache và các phim mới cần quét tập
    movies_by_id = {}
    to_scan = []

    for fid, ftitle in folder_entries:
        if fid in cached_by_id and len(cached_by_id[fid].get('episodes', [])) > 0:
            m = cached_by_id[fid]
            m['title'] = ftitle
            m['poster_url'] = resolve_initial_poster(m, catalog)
            movies_by_id[fid] = m
        else:
            to_scan.append((fid, ftitle))

    print(f" -> Đã có sẵn trong bộ nhớ đệm: {len(movies_by_id)} phim.")
    print(f" -> Cần quét tập phim mới:      {len(to_scan)} phim.")

    if to_scan:
        print(f"\n[2/3] Đang quét tập phim cho {len(to_scan)} bộ phim bằng 32 luồng song song...")

        def _scan_one_movie(item):
            fid, ftitle = item
            entries = fetch_drive_folder_entries(fid, retries=3)
            if not entries:
                return None

            video_entries = []
            for eid, ename in entries:
                if VIDEO_EXT_REGEX.search(ename) or not NON_VIDEO_EXT_REGEX.search(ename):
                    video_entries.append((eid, ename))

            if not video_entries:
                return None

            video_entries.sort(key=lambda x: natural_sort_key(x[1]))

            episodes = []
            for idx, (eid, ename) in enumerate(video_entries):
                episodes.append({
                    "id": eid,
                    "name": f"Tập {idx + 1:02d}"
                })

            movie_obj = {
                "id": fid,
                "title": ftitle,
                "total_episodes": len(episodes),
                "episodes": episodes
            }
            movie_obj["poster_url"] = resolve_initial_poster(movie_obj, catalog)
            return movie_obj

        completed = 0
        added = 0
        with ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(_scan_one_movie, item): item for item in to_scan}
            for fut in as_completed(futures):
                completed += 1
                res = fut.result()
                if res:
                    movies_by_id[res['id']] = res
                    added += 1

                if completed % 100 == 0 or completed == len(to_scan):
                    elapsed = time.time() - t_start
                    print(f"   [{completed}/{len(to_scan)}] Đã quét xong {added} phim hợp lệ ({elapsed:.1f}s)...")
                    # Lưu checkpoint ngay để web có dữ liệu tức thì
                    cur_list = sorted(movies_by_id.values(), key=lambda x: natural_sort_key(x['title']))
                    save_movies_json(cur_list)

    # Sắp xếp danh sách phim hoàn chỉnh và ghi vào movies.json
    final_movies = sorted(movies_by_id.values(), key=lambda x: natural_sort_key(x['title']))
    save_movies_json(final_movies)
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\n[THÀNH CÔNG BƯỚC 1] Đã cập nhật {len(final_movies)} bộ phim vào movies.json ({size_mb:.2f} MB)!")
    print(" -> Ngay bây giờ bạn đã có thể mở web và xem toàn bộ phim!")

    # Bước 3: Tải ảnh bìa về thư mục ./covers/ để tăng tốc độ tải ảnh lâu dài
    download_tasks = []
    for m in final_movies:
        mid = m['id']
        raw_title = m['title']
        cover_filename = f"{mid}.jpg"
        target_path = os.path.join(COVERS_DIR, cover_filename)

        if is_file_valid_image(target_path):
            m['poster_url'] = f"./covers/{cover_filename}"
            continue

        candidates = []
        norm_k = normalize_key(raw_title)
        slug_k = make_slug(raw_title)

        if norm_k in catalog and catalog[norm_k].get('cover'):
            candidates.append(catalog[norm_k]['cover'])
        if slug_k in catalog and catalog[slug_k].get('cover'):
            candidates.append(catalog[slug_k]['cover'])
        if m.get('episodes') and len(m['episodes']) > 0:
            first_fid = m['episodes'][0]['id']
            candidates.append(f"https://drive.google.com/thumbnail?id={first_fid}&sz=w400")

        if candidates:
            download_tasks.append((m, candidates, target_path, cover_filename))

    if download_tasks:
        print(f"\n[3/3] Đang tải {len(download_tasks)} ảnh bìa về máy chủ (32 luồng)...")

        def _dl_worker(task):
            m_obj, candidates, path, fname = task
            for c_url in candidates:
                if download_image(c_url, path):
                    m_obj['poster_url'] = f"./covers/{fname}"
                    return True
            return False

        dl_done = 0
        dl_ok = 0
        with ThreadPoolExecutor(max_workers=32) as pool:
            futs = [pool.submit(_dl_worker, t) for t in download_tasks]
            for fut in as_completed(futs):
                dl_done += 1
                if fut.result():
                    dl_ok += 1
                if dl_done % 200 == 0 or dl_done == len(download_tasks):
                    print(f"   [Ảnh bìa {dl_done}/{len(download_tasks)}] Đã lưu {dl_ok} ảnh...")
                    save_movies_json(final_movies)

    save_movies_json(final_movies)
    total_time = time.time() - t_start
    print("=" * 65)
    print(f" HOÀN TẤT ĐỒNG BỘ: {len(final_movies)} BỘ PHIM TRONG {total_time:.1f} GIÂY!")
    print("=" * 65)
    return True


if __name__ == "__main__":
    sync()
