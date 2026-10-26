"""
StreamPulse — Cross-Platform Streaming Inventory & Direct-Launch App.
FastAPI Backend + Progressive Web App (Desktop & Mobile).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.streaming_client import (
    CATEGORIES_METADATA,
    SUPPORTED_COUNTRIES,
    StreamingInventoryClient,
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ENV_FILE = BASE_DIR / ".env"


def _load_env_tmdb_key() -> str:
    """Read TMDB_API_KEY from .env file if present."""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("TMDB_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _save_env_tmdb_key(key: str) -> None:
    """Persist TMDB_API_KEY to .env file."""
    lines: list[str] = []
    found = False
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("TMDB_API_KEY="):
                lines.append(f"TMDB_API_KEY={key}")
                found = True
            else:
                lines.append(line)
    if not found:
        lines.append(f"TMDB_API_KEY={key}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


client = StreamingInventoryClient(tmdb_api_key=_load_env_tmdb_key())


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await client.aclose()


app = FastAPI(
    title="StreamPulse — Cross-Platform Streaming Search & Inventory",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TMDBKeyRequest(BaseModel):
    api_key: str


@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    """Return app configuration, supported countries, categories/genres, and TMDB connection status."""
    tmdb_status = await client.verify_tmdb_key()
    return {
        "countries": SUPPORTED_COUNTRIES,
        "genres": CATEGORIES_METADATA,
        "categories": CATEGORIES_METADATA,
        "tmdb": {
            "configured": bool(client.tmdb_api_key),
            "valid": tmdb_status.get("valid", False),
            "message": tmdb_status.get("message", ""),
            "maskedKey": (
                f"{client.tmdb_api_key[:4]}...{client.tmdb_api_key[-4:]}"
                if len(client.tmdb_api_key) >= 8
                else ""
            ),
        },
    }


@app.post("/api/settings/tmdb")
async def update_tmdb_key(payload: TMDBKeyRequest) -> dict[str, Any]:
    """Verify and save a TMDB API v3 key or v4 Read Access Token."""
    candidate = payload.api_key.strip()
    if not candidate:
        client.set_tmdb_key("")
        _save_env_tmdb_key("")
        return {
            "valid": False,
            "configured": False,
            "message": "TMDB API key cleared. Running in Direct GraphQL Live Catalog mode.",
        }

    verification = await client.verify_tmdb_key(candidate)
    if verification.get("valid"):
        client.set_tmdb_key(candidate)
        _save_env_tmdb_key(candidate)
    return verification


@app.get("/api/providers")
async def list_providers(country: str = Query("FI", min_length=2, max_length=2)) -> dict[str, Any]:
    """Return streaming platforms available in the specified country."""
    try:
        providers = await client.get_providers(country=country.upper())
        return {"country": country.upper(), "providers": providers}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load providers: {exc}") from exc


@app.get("/api/catalog")
async def get_catalog(
    country: str = Query("FI", min_length=2, max_length=2),
    q: str = Query("", description="Search query across streaming platforms"),
    providers: str = Query("", description="Comma-separated JustWatch provider shortNames (e.g. nfx,dnp)"),
    provider_ids: str = Query("", description="Comma-separated TMDB provider IDs (e.g. 8,337)"),
    media_type: str = Query("all", description="all | movie | tv"),
    genre: str = Query("", description="Single genre/category short code (e.g. scf)"),
    genres: str = Query("", description="Comma-separated category short codes (e.g. scf,hrr)"),
    monetization: str = Query("stream", description="stream | all"),
    sort_by: str = Query("POPULAR", description="POPULAR | TRENDING | IMDB_SCORE | RELEASE_YEAR | RANDOM"),
    year_min: int | None = Query(None, description="Minimum release year"),
    year_max: int | None = Query(None, description="Maximum release year"),
    past_month: bool = Query(False, description="Only titles released in the past 30 days"),
    after: str | None = Query(None, description="Pagination cursor"),
) -> dict[str, Any]:
    """Search for titles or browse combined inventory across selected streaming services & categories."""
    short_list = [p.strip() for p in providers.split(",") if p.strip()]
    id_list = [int(x.strip()) for x in provider_ids.split(",") if x.strip().isdigit()]
    raw_genres = genres or genre
    genre_list = [g.strip() for g in raw_genres.split(",") if g.strip()]
    try:
        return await client.browse_or_search(
            country=country.upper(),
            search_query=q,
            provider_short_names=short_list or None,
            provider_ids=id_list or None,
            media_type=media_type,
            genres=genre_list or None,
            monetization=monetization,
            sort_by=sort_by,
            year_min=year_min,
            year_max=year_max,
            past_month=past_month,
            after=after,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to query streaming inventory: {exc}") from exc


@app.get("/api/title/{node_id}")
async def get_title_detail(
    node_id: str,
    country: str = Query("FI", min_length=2, max_length=2),
    tmdb_id: str | None = Query(None),
    media_type: str = Query("movie"),
) -> dict[str, Any]:
    """Fetch full movie/series details, cast, trailer, and direct streaming launch links."""
    try:
        detail = await client.get_title_details(
            node_id=node_id,
            country=country.upper(),
            tmdb_id=tmdb_id,
            media_type=media_type,
        )
        if not detail:
            raise HTTPException(status_code=404, detail="Title not found")
        return detail
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load title details: {exc}") from exc


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/manifest.json")
async def serve_manifest() -> FileResponse:
    return FileResponse(BASE_DIR / "manifest.json", media_type="application/manifest+json")


@app.get("/sw.js")
async def serve_sw() -> FileResponse:
    return FileResponse(BASE_DIR / "sw.js", media_type="application/javascript")


@app.get("/")
@app.get("/index.html")
async def serve_index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


def _find_available_port(preferred_ports: list[int] = [8080, 8000, 8501, 5050, 3000]) -> int:
    """Find a port that is free and not blocked by Windows Hyper-V/socket permissions (WinError 10013)."""
    import socket

    for port in preferred_ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


if __name__ == "__main__":
    import uvicorn

    port = _find_available_port()
    print(f"\n  StreamPulse is starting at: http://127.0.0.1:{port}\n")
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=False)

