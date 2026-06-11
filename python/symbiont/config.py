import os
from pathlib import Path

PORT = int(os.environ.get("SYMBIONT_PORT", "7341"))
HOST = os.environ.get("SYMBIONT_HOST", "127.0.0.1")
DATA_DIR = Path(os.environ.get("SYMBIONT_DATA_DIR", Path.home() / ".symbiont"))
DB_PATH = DATA_DIR / "sessions.db"
DOCKER_SOCKET = os.environ.get("DOCKER_HOST")
