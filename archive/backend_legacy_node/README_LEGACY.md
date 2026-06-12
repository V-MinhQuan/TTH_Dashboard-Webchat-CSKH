# Legacy Node.js/Express Backend Archive

This folder contains the archived Node.js/Express backend.
It is no longer required for normal backend runtime.

The active backend runtime is **`backend/app/` (FastAPI)** running on port `8000`.

* **Archived from**: `backend/`
* **Archived date**: 10/06/2026
* **Reason**: Backend-only FastAPI cutover
* **Status**: Inactive / Reference / Rollback fallback

## Purpose

This folder is kept only for rollback/reference purposes. Do not run this backend unless explicitly needed for rollback operations.

## How to rollback (if needed)

If you must temporarily rollback to the Node.js backend:
1. Restore these files back into the `backend/` directory (or run directly from this directory if path references are updated).
2. Configure your frontend target URL `VITE_API_URL` to point to port `5000` (e.g. `http://localhost:5000/api`).
3. Run:
   ```bash
   cd backend_legacy_node
   npm install
   npm run dev
   ```
