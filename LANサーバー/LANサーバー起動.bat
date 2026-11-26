@echo off
chcp 65001 >nul
title 友情ブレイカーズ LANサーバー
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ja からLTS版をインストールしてから、もう一度実行してください。
  pause
  exit /b
)
if not exist node_modules (
  echo 初回のみ必要な部品をダウンロードしています...
  call npm install --no-audit --no-fund
)
node server.js
pause
