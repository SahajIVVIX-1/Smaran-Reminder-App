@echo off
setlocal EnableDelayedExpansion
title Smaran HFS - Enable Windows WebDAV Client

:: Check Administrator permissions
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [Smaran HFS] Requesting Administrator privileges to configure Windows WebDAV...
    powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo       Smaran HFS - Windows WebDAV Service Setup
echo ========================================================
echo.
echo SECURITY NOTICE:
echo Enabling HTTP Basic Authentication (BasicAuthLevel=2) allows
echo credentials to be transmitted unencrypted over local HTTP.
echo For remote or untrusted networks, HTTPS with SSL is strongly recommended.
echo.
echo [1/3] Setting Windows WebClient service to start automatically...
sc config WebClient start= auto >nul 2>&1
net start WebClient >nul 2>&1

echo [2/3] Configuring WebDAV Basic Authentication for HTTP in Registry...
reg add "HKLM\SYSTEM\CurrentControlSet\Services\WebClient\Parameters" /v BasicAuthLevel /t REG_DWORD /d 2 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\WebClient\Parameters" /v FileSizeLimitInBytes /t REG_DWORD /d 4294967295 /f >nul 2>&1

echo [3/3] Restarting WebClient service to apply registry changes...
net stop WebClient /y >nul 2>&1
net start WebClient >nul 2>&1

echo.
echo ========================================================
echo SUCCESS: Windows WebDAV service and registry configured!
echo You can now mount Smaran HFS as a network drive in Windows Explorer.
echo ========================================================
echo.
pause
