@echo off
chcp 65001 >nul
title DramaPlay PRO - May Chu Xem Phim Chuyen Nghiep
cd /d "%~dp0"

echo ======================================================================
echo           DRAMAPLAY PRO - HE THONG WEB XEM PHIM CHUYEN NGHIEP
echo ======================================================================
echo.
echo [1] Dang khoi dong may chu web tai http://localhost:8080 ...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 8080; " ^
  "$root = (Get-Location).Path; " ^
  "$listener = New-Object System.Net.HttpListener; " ^
  "$listener.Prefixes.Add(\"http://localhost:$port/\"); " ^
  "$listener.Start(); " ^
  "Write-Host '==============================================================' -ForegroundColor Cyan; " ^
  "Write-Host \" -> TRUY CAP NGAY TREN MAY TINH: http://localhost:$port\" -ForegroundColor Green; " ^
  "Write-Host '==============================================================' -ForegroundColor Cyan; " ^
  "Write-Host 'Dang chay may chu... (Dong cua so nay hoac nhan Ctrl + C de dung)'; " ^
  "Start-Process \"http://localhost:$port\"; " ^
  "$mimeMap = @{'.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'}; " ^
  "while ($listener.IsListening) { " ^
  "  try { " ^
  "    $ctx = $listener.GetContext(); " ^
  "    $req = $ctx.Request; " ^
  "    $res = $ctx.Response; " ^
  "    $relPath = $req.Url.LocalPath.TrimStart('/'); " ^
  "    if ([string]::IsNullOrEmpty($relPath)) { $relPath = 'index.html' } " ^
  "    $filePath = Join-Path $root ($relPath -replace '/','\'); " ^
  "    if (Test-Path $filePath -PathType Leaf) { " ^
  "      $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); " ^
  "      $res.ContentType = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }; " ^
  "      $bytes = [System.IO.File]::ReadAllBytes($filePath); " ^
  "      $res.ContentLength64 = $bytes.Length; " ^
  "      $res.OutputStream.Write($bytes, 0, $bytes.Length); " ^
  "    } else { " ^
  "      $res.StatusCode = 404; " ^
  "    } " ^
  "    $res.Close(); " ^
  "  } catch { break } " ^
  "}"

pause
