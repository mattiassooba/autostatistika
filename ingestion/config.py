from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

TRUSTED_HOSTS = {
    "transpordiamet.ee",
    "www.transpordiamet.ee",
    "andmed.eesti.ee",
}

USER_AGENT = "AutostatistikaIngestion/0.1 (+https://autostatistika.ee; source-audit)"
MAX_FILE_BYTES = 250 * 1024 * 1024
REQUEST_TIMEOUT = 60
REQUEST_GAP_SECONDS = 1.0

DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))
DOWNLOAD_DIR = DATA_DIR / "downloads"
SAMPLE_DIR = DATA_DIR / "source-samples"
DB_PATH = Path(os.getenv("INGESTION_DB", DATA_DIR / "autostatistika.db"))
PUBLISH_DIR = Path(os.getenv("PUBLISH_DIR", ROOT / "apps" / "web" / "data" / "published"))

DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "source-files")
ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
INSIGHT_MODEL = os.getenv("INSIGHT_MODEL", "gpt-4.1-mini")

REGISTRATIONS_PAGE = "https://www.transpordiamet.ee/soidukitega-tehtud-toimingute-statistika"
INSPECTIONS_PAGE = "https://www.transpordiamet.ee/tehnoulevaatuste-statistika"
FLEET_PAGE = "https://www.transpordiamet.ee/soidukite-statistika"
TEABEVARAV_API = "https://andmed.eesti.ee/api/v2/datasets"

INFOLEHT_DATASET_UUID = "9d2f4b4d-9eab-45f7-97b2-543600621aff"


def ensure_dirs() -> None:
    for path in (DATA_DIR, DOWNLOAD_DIR, SAMPLE_DIR, PUBLISH_DIR, DB_PATH.parent):
        path.mkdir(parents=True, exist_ok=True)
