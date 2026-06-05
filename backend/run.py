import uvicorn
import config

if __name__ == "__main__":
    print(f"Starting FastAPI server on port {config.PORT}...")
    uvicorn.run("main:app", host="0.0.0.0", port=config.PORT, reload=True)
