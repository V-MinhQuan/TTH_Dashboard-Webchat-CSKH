@echo off
REM Script chạy tự động chuẩn hóa câu hỏi FAQ
REM Tự động cd vào thư mục backend và thiết lập PYTHONPATH

cd /d "d:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\backend"
set PYTHONPATH=.
python scripts\standardize_faq_questions.py
