@echo off
title DramaPlay - May Chu Xem Phim
cd /d "%~dp0"

echo ======================================================================
echo             DRAMAPLAY - TRINH XEM PHIM NGAN CHUYEN NGHIEP
echo ======================================================================
echo.
echo [1] Dang khoi dong may chu web tren may tinh cua ban...
echo.

python -c "
import socket, http.server, socketserver, os, webbrowser

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

local_ip = get_ip()
print('='*60)
print(f'-> XEM TREN MAY TINH:   http://localhost:{PORT}')
print(f'-> XEM TREN DIEN THOAI: http://{local_ip}:{PORT}')
print('='*60)
print('\n[MEO HAY]: Tren dien thoai Android, hay mo trinh duyet Chrome,')
print(f'truy cap: http://{local_ip}:{PORT}')
print('Bam vao dau 3 cham o goc phai -> Chon \"Them vao Man hinh chinh\"')
print('de bien thanh App xem phim thuc thu!')
print('\nDang chay may chu... (Nhan Ctrl + C de dung)\n')

webbrowser.open(f'http://localhost:{PORT}')

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    httpd.serve_forever()
"

pause
