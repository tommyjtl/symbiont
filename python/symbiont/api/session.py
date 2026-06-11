from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from symbiont.storage.sessions import (
    Session,
    SessionUpdate,
    create_session,
    get_session_by_id,
    get_session_by_url,
    update_session,
    upsert_session_for_url,
)

router = APIRouter(prefix="/session")


class SessionCreate(BaseModel):
    url: str
    domain: str
    page_title: str = Field(alias="pageTitle", default="")
    nearest_heading: str = Field(alias="nearestHeading", default="")
    recipe_id: str = Field(alias="recipeId")
    original_code: str = Field(alias="originalCode")
    current_code: str = Field(alias="currentCode")
    stdout: str = ""
    stderr: str = ""

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


@router.post("", response_model=Session)
async def save_session(body: SessionCreate) -> Session:
    session = Session(
        url=body.url,
        domain=body.domain,
        pageTitle=body.page_title,
        nearestHeading=body.nearest_heading,
        recipeId=body.recipe_id,
        originalCode=body.original_code,
        currentCode=body.current_code,
        stdout=body.stdout,
        stderr=body.stderr,
    )
    return await upsert_session_for_url(session)


@router.get("", response_model=Session)
async def get_session(url: str) -> Session:
    session = await get_session_by_url(url)
    if session is None:
        raise HTTPException(status_code=404, detail="No session found for this URL")
    return session


@router.patch("/{session_id}", response_model=Session)
async def patch_session(session_id: str, body: SessionUpdate) -> Session:
    session = await update_session(session_id, body)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/create", response_model=Session)
async def create_new_session(body: SessionCreate) -> Session:
    session = Session(
        url=body.url,
        domain=body.domain,
        pageTitle=body.page_title,
        nearestHeading=body.nearest_heading,
        recipeId=body.recipe_id,
        originalCode=body.original_code,
        currentCode=body.current_code,
        stdout=body.stdout,
        stderr=body.stderr,
    )
    return await create_session(session)


@router.get("/{session_id}", response_model=Session)
async def get_session_by_id_route(session_id: str) -> Session:
    session = await get_session_by_id(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
