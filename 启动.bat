@echo off
chcp 65001 >nul
echo ============================================
echo   FPS 射击游戏 - 完整版 v6
echo   界面完善+传送门+主菜单+击杀日志+
echo   准星自定义+音效补全+4武器3D模型+纹理替换
echo ============================================
echo.
echo 正在启动 HTTP 服务器...
echo 浏览器打开: http://localhost:8080
echo 按 Ctrl+C 停止服务器
echo ============================================
echo.
cd /d "%~dp0"
start http://localhost:8080
python -m http.server 8080
pause
