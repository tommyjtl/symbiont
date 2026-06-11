import aiosqlite

from symbiont.config import DATA_DIR, DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    page_title TEXT NOT NULL DEFAULT '',
    nearest_heading TEXT NOT NULL DEFAULT '',
    recipe_id TEXT NOT NULL,
    original_code TEXT NOT NULL,
    current_code TEXT NOT NULL,
    stdout TEXT NOT NULL DEFAULT '',
    stderr TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_url ON sessions(url);
CREATE INDEX IF NOT EXISTS idx_sessions_domain ON sessions(domain);
"""


async def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


def get_db_path() -> str:
    return str(DB_PATH)
