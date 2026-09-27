import os
from pathlib import Path

from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_backend_dir / ".env.local")
load_dotenv(_backend_dir / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
BLASTRADIUS_API_SECRET = os.getenv("BLASTRADIUS_API_SECRET", "")
ENV = os.getenv("ENV", "dev")
DATA_DIR = Path(os.getenv("DATA_DIR", str(_backend_dir / "data")))
REPOS_DIR = Path(os.getenv("REPOS_DIR", str(DATA_DIR / "repos")))
DB_PATH = Path(os.getenv("DB_PATH", str(_backend_dir / "blastradius.db")))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
