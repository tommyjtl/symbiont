import uuid
from datetime import UTC, datetime

import aiosqlite
from pydantic import BaseModel, Field

from symbiont.storage.db import get_db_path


class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    domain: str
    page_title: str = Field(alias="pageTitle", default="")
    nearest_heading: str = Field(alias="nearestHeading", default="")
    recipe_id: str = Field(alias="recipeId")
    original_code: str = Field(alias="originalCode")
    current_code: str = Field(alias="currentCode")
    stdout: str = ""
    stderr: str = ""
    created_at: str = Field(alias="createdAt", default="")
    updated_at: str = Field(alias="updatedAt", default="")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class SessionUpdate(BaseModel):
    current_code: str | None = Field(alias="currentCode", default=None)
    stdout: str | None = None
    stderr: str | None = None
    recipe_id: str | None = Field(alias="recipeId", default=None)
    nearest_heading: str | None = Field(alias="nearestHeading", default=None)
    page_title: str | None = Field(alias="pageTitle", default=None)

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _row_to_session(row: aiosqlite.Row) -> Session:
    return Session(
        id=row["id"],
        url=row["url"],
        domain=row["domain"],
        pageTitle=row["page_title"],
        nearestHeading=row["nearest_heading"],
        recipeId=row["recipe_id"],
        originalCode=row["original_code"],
        currentCode=row["current_code"],
        stdout=row["stdout"],
        stderr=row["stderr"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


async def create_session(session: Session) -> Session:
    now = _now()
    session.created_at = now
    session.updated_at = now

    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            """
            INSERT INTO sessions (
                id, url, domain, page_title, nearest_heading, recipe_id,
                original_code, current_code, stdout, stderr, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session.id,
                session.url,
                session.domain,
                session.page_title,
                session.nearest_heading,
                session.recipe_id,
                session.original_code,
                session.current_code,
                session.stdout,
                session.stderr,
                session.created_at,
                session.updated_at,
            ),
        )
        await db.commit()
    return session


async def get_session_by_url(url: str) -> Session | None:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE url = ? ORDER BY updated_at DESC LIMIT 1",
            (url,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_session(row)


async def get_session_by_id(session_id: str) -> Session | None:
    async with aiosqlite.connect(get_db_path()) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_session(row)


async def update_session(session_id: str, update: SessionUpdate) -> Session | None:
    existing = await get_session_by_id(session_id)
    if existing is None:
        return None

    data = existing.model_dump(by_alias=True)
    patch = update.model_dump(by_alias=True, exclude_none=True)
    data.update(patch)
    data["updatedAt"] = _now()

    async with aiosqlite.connect(get_db_path()) as db:
        await db.execute(
            """
            UPDATE sessions SET
                page_title = ?, nearest_heading = ?, recipe_id = ?,
                current_code = ?, stdout = ?, stderr = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                data["pageTitle"],
                data["nearestHeading"],
                data["recipeId"],
                data["currentCode"],
                data["stdout"],
                data["stderr"],
                data["updatedAt"],
                session_id,
            ),
        )
        await db.commit()

    return await get_session_by_id(session_id)


async def upsert_session_for_url(session: Session) -> Session:
    existing = await get_session_by_url(session.url)
    if existing is None:
        return await create_session(session)

    update = SessionUpdate(
        currentCode=session.current_code,
        stdout=session.stdout,
        stderr=session.stderr,
        recipeId=session.recipe_id,
        nearestHeading=session.nearest_heading,
        pageTitle=session.page_title,
    )
    updated = await update_session(existing.id, update)
    assert updated is not None
    return updated
