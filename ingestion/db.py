from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from ingestion.config import DB_PATH, ensure_dirs

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def connect(path: Path | None = None) -> sqlite3.Connection:
    ensure_dirs()
    db_path = path or DB_PATH
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    _migrate(conn)
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.commit()


def _migrate(conn: sqlite3.Connection) -> None:
    """Bring a database created by an older schema.sql up to date. The weekly
    job always starts from an empty database; this is for local copies."""
    columns = {row[1] for row in conn.execute("PRAGMA table_info(registration_facts)")}
    if columns and "dimension" not in columns:
        conn.execute("ALTER TABLE registration_facts ADD COLUMN dimension TEXT")
        conn.execute("ALTER TABLE registration_facts ADD COLUMN dimension_value TEXT")
        # schema.sql recreates the unique index with the new columns.
        conn.execute("DROP INDEX IF EXISTS uq_registration_facts")


@contextmanager
def session(path: Path | None = None):
    conn = connect(path)
    try:
        init_db(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
