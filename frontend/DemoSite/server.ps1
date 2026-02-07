# 简易 HTTP 服务器脚本
$port = 3000
$root = Get-Location

Write-Host "============================================" -ForegroundColor Green
Write-Host "  X-plan Demo 服务器启动" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  访问地址: http://localhost:$port" -ForegroundColor Yellow
Write-Host "  根目录: $root" -ForegroundColor Cyan
Write-Host ""
Write-Host "  按 Ctrl+C 停止服务器" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()

Write-Host "✓ 服务器已启动" -ForegroundColor Green
Write-Host ""

try {
    while ($true) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # 获取请求路径
        $path = $request.Url.LocalPath

        # 默认文件
        if ($path -eq '/') {
            $path = '/index.html'
        }

        # 构建文件路径
        $filePath = Join-Path $root $path.TrimStart('/')

        # 检查文件是否存在
        if (Test-Path $filePath) {
            $contentType = "text/plain"

            # 根据扩展名设置 Content-Type
            $extension = [System.IO.Path]::GetExtension($filePath)
            switch ($extension) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css" { $contentType = "text/css; charset=utf-8" }
                ".js" { $contentType = "application/javascript; charset=utf-8" }
                ".json" { $contentType = "application/json; charset=utf-8" }
                ".png" { $contentType = "image/png" }
                ".jpg" { $contentType = "image/jpeg" }
                ".gif" { $contentType = "image/gif" }
                ".svg" { $contentType = "image/svg+xml" }
                ".ico" { $contentType = "image/x-icon" }
                default { $contentType = "application/octet-stream" }
            }

            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] GET $path - 200" -ForegroundColor Green
        }
        else {
            $response.StatusCode = 404
            $message = "404 - Not Found: $path"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($message)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] GET $path - 404" -ForegroundColor Red
        }

        $response.Close()
    }
}
finally {
    $listener.Stop()
    Write-Host ""
    Write-Host "✓ 服务器已停止" -ForegroundColor Yellow
}
