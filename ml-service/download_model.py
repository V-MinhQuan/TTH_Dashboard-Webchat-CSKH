"""
download_model.py
─────────────────
Script tải và export model PhoBERT sang định dạng ONNX.
Chạy một lần trước khi khởi động ml-service.

Cách dùng:
    python download_model.py

Model sẽ được lưu vào: ml-service/models/phobert-sentiment-onnx/
"""

from pathlib import Path
import sys

# ─── Tên model trên HuggingFace ───────────────────────────────────────────────
MODEL_NAME = "wonrax/phobert-base-vietnamese-sentiment"

# ─── Thư mục đầu ra ONNX (dùng pathlib để tương thích Windows và Linux) ───────
OUTPUT_DIR = Path(__file__).parent / "models" / "phobert-sentiment-onnx"


def main():
    print("=" * 60)
    print("  FLIC WebChat — Export PhoBERT sang ONNX")
    print("=" * 60)

    # ── Kiểm tra thư mục đã tồn tại ──────────────────────────────────────────
    if OUTPUT_DIR.exists() and any(OUTPUT_DIR.iterdir()):
        print(f"\n[INFO] Thư mục model đã tồn tại: {OUTPUT_DIR}")
        answer = input("[HỎI] Model đã được export. Bạn có muốn export lại không? (y/N): ").strip().lower()
        if answer != "y":
            print("[INFO] Bỏ qua export. Model hiện tại vẫn được giữ nguyên.")
            sys.exit(0)

    # ── Bước 1: Import thư viện ───────────────────────────────────────────────
    print("\n[BƯỚC 1] Import thư viện transformers và optimum...")
    try:
        from transformers import AutoTokenizer
        from optimum.onnxruntime import ORTModelForSequenceClassification
    except ImportError as e:
        print(f"[LỖI] Không thể import thư viện cần thiết: {e}")
        print("      Hãy chạy từ thư mục gốc repo: pip install -r requirements.txt")
        sys.exit(1)

    # ── Bước 2: Tải tokenizer từ HuggingFace ─────────────────────────────────
    print(f"\n[BƯỚC 2] Đang tải tokenizer: {MODEL_NAME}")
    print("         (Lần đầu chạy sẽ mất vài phút để tải về...)")
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        print("[OK] Tokenizer đã tải thành công.")
    except Exception as e:
        print(f"[LỖI] Không thể tải tokenizer: {e}")
        sys.exit(1)

    # ── Bước 3: Tải model và export sang ONNX ────────────────────────────────
    # optimum sẽ tự động tải PyTorch model rồi convert sang ONNX.
    # torch chỉ cần ở bước này — không cần khi inference sau đó.
    print(f"\n[BƯỚC 3] Đang export model sang ONNX: {MODEL_NAME}")
    print("         (Quá trình này có thể mất 5–15 phút lần đầu...)")
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # export=True → optimum tự load PyTorch model và convert sang ONNX
        model = ORTModelForSequenceClassification.from_pretrained(
            MODEL_NAME,
            export=True
        )
        print("[OK] Export ONNX thành công.")
    except Exception as e:
        print(f"[LỖI] Export ONNX thất bại: {e}")
        print("      Hãy kiểm tra torch và optimum đã được cài đúng phiên bản.")
        # Xóa thư mục nếu export thất bại để tránh để lại file rác
        import shutil
        if OUTPUT_DIR.exists():
            shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
        sys.exit(1)

    # ── Bước 4: Lưu model và tokenizer vào thư mục đích ─────────────────────
    print(f"\n[BƯỚC 4] Đang lưu model vào: {OUTPUT_DIR}")
    try:
        model.save_pretrained(str(OUTPUT_DIR))
        tokenizer.save_pretrained(str(OUTPUT_DIR))
        print("[OK] Model và tokenizer đã được lưu thành công.")
    except Exception as e:
        print(f"[LỖI] Không thể lưu model: {e}")
        sys.exit(1)

    # ── Hoàn tất ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ✅ Export hoàn tất!")
    print(f"  📁 Model đã lưu tại: {OUTPUT_DIR}")
    print("  Bây giờ bạn có thể khởi động service bằng lệnh:")
    print("  uvicorn app.main:app --host 0.0.0.0 --port 8001")
    print("=" * 60)


if __name__ == "__main__":
    main()
