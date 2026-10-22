#!/bin/bash
set -e
echo "=========================================================="
echo "    DramaPlay: Sửa Lỗi Header Quá Lớn (proxy_buffer_size) "
echo "=========================================================="

CONF_FILE=$(grep -rl "film.tptmmo.site" /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null | head -n 1)

if [ -z "$CONF_FILE" ]; then
    if [ -f "/etc/nginx/sites-available/default" ]; then
        CONF_FILE="/etc/nginx/sites-available/default"
    else
        echo "[LỖI] Không tìm thấy file cấu hình Nginx!"
        exit 1
    fi
fi

echo "[1/3] Đang cập nhật: $CONF_FILE"

# Ghi đè cấu hình stream có proxy_buffer_size 128k để đọc trọn vẹn header Google Drive
python3 -c "
import re

with open('$CONF_FILE', 'r') as f:
    content = f.read()

# Gỡ bỏ block stream, drive-folder, td-page, td-api cũ
content = re.sub(r'location\s+/stream/\s*\{[^}]*\}', '', content)
content = re.sub(r'location\s+/drive-folder/\s*\{[^}]*\}', '', content)
content = re.sub(r'location\s+/td-page/\s*\{[^}]*\}', '', content)
content = re.sub(r'location\s+/td-api/\s*\{[^}]*\}', '', content)

stream_block = '''
    # Streaming trực tiếp từ Google Drive: không dừng 7s, không che phụ đề
    location /stream/ {
        resolver 8.8.8.8 1.1.1.1 valid=300s ipv6=off;
        resolver_timeout 5s;
        proxy_pass https://drive.usercontent.google.com/download?id=\$arg_id&export=download;
        proxy_set_header Host drive.usercontent.google.com;
        proxy_ssl_name drive.usercontent.google.com;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        
        # Mở rộng buffer để đọc header khổng lồ của Google Drive
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        proxy_set_header Range \$http_range;
        proxy_set_header If-Range \$http_if_range;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_hide_header Cross-Origin-Resource-Policy;
        proxy_hide_header Cross-Origin-Embedder-Policy;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header Content-Disposition;
        add_header Access-Control-Allow-Origin *;
        add_header Accept-Ranges bytes;
    }

    # Quét trực tiếp danh sách file .SRT mới trong thư mục Google Drive theo thời gian thực
    location /drive-folder/ {
        resolver 8.8.8.8 1.1.1.1 valid=300s ipv6=off;
        resolver_timeout 5s;
        proxy_pass https://drive.google.com/embeddedfolderview?id=\$arg_id;
        proxy_set_header Host drive.google.com;
        proxy_ssl_name drive.google.com;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
        add_header Access-Control-Allow-Origin *;
    }

    # Proxy tự động lấy phụ đề trực tiếp theo thời gian thực kể cả khi Drive chưa kịp đồng bộ .SRT
    location /td-page/ {
        resolver 8.8.8.8 1.1.1.1 valid=300s ipv6=off;
        resolver_timeout 5s;
        proxy_pass https://trumdrama.com/phim/;
        proxy_set_header Host trumdrama.com;
        proxy_ssl_name trumdrama.com;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        add_header Access-Control-Allow-Origin *;
    }

    location /td-api/ {
        resolver 8.8.8.8 1.1.1.1 valid=300s ipv6=off;
        resolver_timeout 5s;
        proxy_pass https://trumdrama.com/api/v1/;
        proxy_set_header Host trumdrama.com;
        proxy_set_header Referer https://trumdrama.com/;
        proxy_ssl_name trumdrama.com;
        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        add_header Access-Control-Allow-Origin *;
    }
'''

if 'server_name' in content:
    idx = content.find('server_name')
    end_idx = content.find(';', idx) + 1
    new_content = content[:end_idx] + '\n' + stream_block + content[end_idx:]
    with open('$CONF_FILE', 'w') as f:
        f.write(new_content)
    print('[OK] Đã tăng proxy_buffer_size lên 128k!')
else:
    print('[!] Không tìm thấy server_name trong file.')
"

echo "[2/3] Kiểm tra cú pháp Nginx..."
nginx -t

echo "[3/4] Áp dụng cấu hình Nginx mới..."
systemctl reload nginx

echo "[4/4] Cài đặt Cron tự động đồng bộ phim & phụ đề .SRT mới mỗi 10 phút..."
APP_DIR=$(cd "$(dirname "$0")" && pwd)
cat <<EOF > /etc/cron.d/dramafilm-sync
*/10 * * * * root cd $APP_DIR && git pull -q origin main && /usr/bin/python3 $APP_DIR/sync_movies.py >/var/log/dramafilm_sync.log 2>&1
EOF
chmod 644 /etc/cron.d/dramafilm-sync

echo "=========================================================="
echo " [THÀNH CÔNG] Đã cấu hình Nginx + Tự động đồng bộ Sub 24/7!"
echo "=========================================================="
