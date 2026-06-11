import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from symbiont.api.health import router as health_router
from symbiont.api.recipes import router as recipes_router
from symbiont.api.sandbox import router as sandbox_router
from symbiont.api.session import router as session_router
from symbiont.api.terminal import router as terminal_router
from symbiont.config import HOST, PORT
from symbiont.sandbox.docker_runner import warn_if_docker_missing
from symbiont.storage.db import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    warn_if_docker_missing()
    yield


app = FastAPI(title="Symbiont", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(recipes_router)
app.include_router(sandbox_router)
app.include_router(terminal_router)
app.include_router(session_router)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    uvicorn.run("symbiont.main:app", host=HOST, port=PORT, reload=False)


if __name__ == "__main__":
    main()
