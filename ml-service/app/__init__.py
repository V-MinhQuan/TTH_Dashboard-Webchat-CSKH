# ml-service/app/__init__.py
# Package marker — để Python nhận diện thư mục này là một package.

import os
from pathlib import Path

def load_dotenv():
    # Load from ml-service/.env or root .env
    for base in [Path(__file__).parent.parent, Path(__file__).parent.parent.parent]:
        env_path = base / ".env"
        if env_path.exists():
            print(f"[__init__.py] Loading environment variables from: {env_path.resolve()}")
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'").strip('"')
                        if k not in os.environ:
                            os.environ[k] = v

load_dotenv()
