FROM python:3.12-slim-bookworm

RUN pip install --no-cache-dir mojo

WORKDIR /workspace

# Mojo needs a writable home/cache; /tmp is tmpfs-mounted at runtime (read-only root).
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_DATA_HOME=/tmp/.local/share

USER nobody
