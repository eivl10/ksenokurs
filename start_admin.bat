@echo off
echo Starting Decap CMS Local Backend...
start cmd /k "npx decap-server"

echo Opening browser...
start http://localhost:8000/Netlify/admin/

echo Starting Web Server...
echo (Press Ctrl+C to stop)
python -m http.server 8000
