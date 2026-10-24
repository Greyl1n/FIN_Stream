"""
Dual-Engine Streaming Inventory & Cross-Platform Search Client.

Combines:
1. TMDB API (The Movie Database v3/v4) for official metadata, discovery, trailers, and watch providers.
2. JustWatch Public GraphQL API for zero-config live catalog browsing, cross-platform search,
   and direct deep-links (`standardWebURL`) that launch titles directly inside Netflix, Disney+,
   Prime Video, Max, Apple TV+, Yle Areena, Ruutu, Viaplay, etc.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any
from urllib.parse import quote_plus

import httpx

JUSTWATCH_GRAPHQL_URL = "https://apis.justwatch.com/graphql"
JUSTWATCH_IMAGE_BASE = "https://images.justwatch.com"
TMDB_API_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"

GENRE_MAP_JW_TO_NAME: dict[str, str] = {
    "act": "Action & Adventure",
    "scf": "Sci-Fi",
    "cmy": "Comedy",
    "trl": "Mystery & Thriller",
    "drm": "Drama",
    "crm": "Crime",
    "hrr": "Horror",
    "ani": "Animation",
    "doc": "Documentary",
    "fnt": "Fantasy",
    "rma": "Romance",
    "fml": "Kids & Family",
    "hst": "History",
    "war": "War & Military",
    "rly": "Reality TV",
    "spt": "Sports",
    "msc": "Music",
    "wsn": "Western",
    "eur": "European",
}

CATEGORIES_METADATA: list[dict[str, str]] = [
    {"id": "act", "name": "Action & Adventure", "icon": "💥", "keywords": "action adventure superhero martial arts"},
    {"id": "scf", "name": "Sci-Fi", "icon": "🚀", "keywords": "sci-fi science fiction space alien future cyberpunk"},
    {"id": "cmy", "name": "Comedy", "icon": "😂", "keywords": "comedy funny sitcom humor standup"},
    {"id": "trl", "name": "Mystery & Thriller", "icon": "🕵️", "keywords": "thriller mystery suspense detective"},
    {"id": "drm", "name": "Drama", "icon": "🎭", "keywords": "drama emotional biography"},
    {"id": "crm", "name": "Crime", "icon": "🚓", "keywords": "crime mafia gangster heist police noir"},
    {"id": "hrr", "name": "Horror", "icon": "🔪", "keywords": "horror scary supernatural slasher zombie"},
    {"id": "ani", "name": "Animation", "icon": "🎨", "keywords": "animation anime cartoon animated"},
    {"id": "doc", "name": "Documentary", "icon": "🌍", "keywords": "documentary docuseries nature true story"},
    {"id": "fnt", "name": "Fantasy", "icon": "🐉", "keywords": "fantasy magic dragon myth"},
    {"id": "rma", "name": "Romance", "icon": "❤️", "keywords": "romance romantic love"},
    {"id": "fml", "name": "Kids & Family", "icon": "👨‍👩‍👧", "keywords": "kids family children"},
    {"id": "hst", "name": "History", "icon": "🏛️", "keywords": "history historical period"},
    {"id": "war", "name": "War & Military", "icon": "⚔️", "keywords": "war military battle ww2"},
    {"id": "rly", "name": "Reality TV", "icon": "📺", "keywords": "reality tv competition cooking dating"},
    {"id": "spt", "name": "Sports", "icon": "🏆", "keywords": "sports football hockey racing"},
    {"id": "msc", "name": "Music", "icon": "🎵", "keywords": "music musical concert"},
    {"id": "wsn", "name": "Western", "icon": "🤠", "keywords": "western cowboy"},
    {"id": "eur", "name": "European", "icon": "🇪🇺", "keywords": "european nordic"},
]

VALID_SORT_OPTIONS = {"POPULAR", "TRENDING", "IMDB_SCORE", "RELEASE_YEAR", "TMDB_POPULARITY", "RANDOM"}

TMDB_TO_JW_GENRE: dict[str, int] = {
    "act": 28,
    "ani": 16,
    "cmy": 35,
    "crm": 80,
    "doc": 99,
    "drm": 18,
    "fml": 10751,
    "fnt": 14,
    "hrr": 27,
    "hst": 36,
    "msc": 10402,
    "rma": 10749,
    "scf": 878,
    "trl": 53,
    "war": 10752,
    "wsn": 37,
}

QUALITY_RANK = {"_4K": 4, "4K": 4, "UHD": 4, "HD": 3, "SD": 2, "": 1}
MONETIZATION_RANK = {"FLATRATE": 1, "FREE": 2, "ADS": 3, "RENT": 4, "BUY": 5}

SUPPORTED_COUNTRIES = [
    {"code": "FI", "name": "Finland", "flag": "🇫🇮"},
    {"code": "US", "name": "United States", "flag": "🇺🇸"},
    {"code": "GB", "name": "United Kingdom", "flag": "🇬🇧"},
    {"code": "SE", "name": "Sweden", "flag": "🇸🇪"},
    {"code": "NO", "name": "Norway", "flag": "🇳🇴"},
    {"code": "DK", "name": "Denmark", "flag": "🇩🇰"},
    {"code": "DE", "name": "Germany", "flag": "🇩🇪"},
    {"code": "FR", "name": "France", "flag": "🇫🇷"},
    {"code": "ES", "name": "Spain", "flag": "🇪🇸"},
    {"code": "CA", "name": "Canada", "flag": "🇨🇦"},
    {"code": "AU", "name": "Australia", "flag": "🇦🇺"},
    {"code": "NL", "name": "Netherlands", "flag": "🇳🇱"},
]

PROVIDER_SEARCH_FALLBACKS: dict[str, str] = {
    "netflix": "https://www.netflix.com/search?q={query}",
    "disneyplus": "https://www.disneyplus.com/search?q={query}",
    "amazonprimevideo": "https://www.primevideo.com/search?phrase={query}",
    "appletvplus": "https://tv.apple.com/search?term={query}",
    "max": "https://play.max.com/search?q={query}",
    "hbomax": "https://play.max.com/search?q={query}",
    "yleareena": "https://areena.yle.fi/haku?q={query}",
    "ruutu": "https://www.ruutu.fi/haku?q={query}",
    "viaplay": "https://viaplay.com/search?query={query}",
    "skyshowtime": "https://www.skyshowtime.com/watch/search?q={query}",
}


def format_jw_image(url_template: str | None, profile: str = "s592", ext: str = "webp") -> str | None:
    """Format a JustWatch image path template into a full CDN URL."""
    if not url_template:
        return None
    if url_template.startswith("http"):
        return url_template
    formatted = url_template.replace("{profile}", profile).replace("{format}", ext)
    return f"{JUSTWATCH_IMAGE_BASE}{formatted}"


def normalize_quality(presentation_type: str | None) -> str:
    """Convert JustWatch presentationType (e.g. '_4K') into clean badge label."""
    if not presentation_type:
        return "HD"
    cleaned = presentation_type.lstrip("_").upper()
    return cleaned if cleaned in ("4K", "HD", "SD") else "HD"


def categorize_monetization(monetization_type: str | None) -> str:
    """Group monetization types into 'stream' (subscription/free/ads), 'rent', or 'buy'."""
    m = (monetization_type or "").upper()
    if m in ("FLATRATE", "FREE", "ADS", "CINEMA"):
        return "stream"
    if m == "RENT":
        return "rent"
    if m == "BUY":
        return "buy"
    return "stream"


class StreamingInventoryClient:
    """Async client combining TMDB API and JustWatch GraphQL for streaming search & discovery."""

    def __init__(self, tmdb_api_key: str | None = None) -> None:
        self.tmdb_api_key: str = (tmdb_api_key or os.getenv("TMDB_API_KEY", "")).strip()
        self._http = httpx.AsyncClient(
            timeout=15.0,
            headers={
                "User-Agent": "StreamPulse/1.0 (Cross-Platform Streaming Aggregator)",
                "Accept": "application/json",
            },
        )
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 300.0  # 5 minutes cache

    def _get_cache(self, key: str) -> Any | None:
        item = self._cache.get(key)
        if item and (time.time() - item[0]) < self._cache_ttl:
            return item[1]
        return None

    def _set_cache(self, key: str, value: Any) -> None:
        self._cache[key] = (time.time(), value)

    def _tmdb_headers_and_params(self, extra_params: dict[str, Any] | None = None) -> tuple[dict[str, str], dict[str, Any]]:
        """Support both TMDB v3 API Key (32-char hex) and v4 Bearer Read Access Token."""
        headers: dict[str, str] = {}
        params: dict[str, Any] = dict(extra_params or {})
        key = self.tmdb_api_key.strip()
        if key.startswith("eyJ") or len(key) > 45:
            headers["Authorization"] = f"Bearer {key}"
        elif key:
            params["api_key"] = key
        return headers, params

    async def verify_tmdb_key(self, candidate_key: str | None = None) -> dict[str, Any]:
        """Test whether the provided or configured TMDB API key is valid."""
        key_to_test = (candidate_key if candidate_key is not None else self.tmdb_api_key).strip()
        if not key_to_test:
            return {"valid": False, "configured": False, "message": "No TMDB API key configured."}

        headers: dict[str, str] = {}
        params: dict[str, Any] = {}
        if key_to_test.startswith("eyJ") or len(key_to_test) > 45:
            headers["Authorization"] = f"Bearer {key_to_test}"
        else:
            params["api_key"] = key_to_test

        try:
            resp = await self._http.get(f"{TMDB_API_BASE}/configuration", headers=headers, params=params)
            if resp.status_code == 200:
                return {
                    "valid": True,
                    "configured": True,
                    "message": "TMDB API connected! Hybrid TMDB + JustWatch Direct-Link engine active.",
                }
            return {
                "valid": False,
                "configured": True,
                "message": f"TMDB returned HTTP {resp.status_code}: {resp.json().get('status_message', 'Invalid API key')}",
            }
        except Exception as exc:
            return {"valid": False, "configured": True, "message": f"Connection error testing TMDB key: {exc}"}

    def set_tmdb_key(self, new_key: str) -> None:
        """Update the active TMDB API key and clear cached responses."""
        self.tmdb_api_key = new_key.strip()
        self._cache.clear()

    async def get_providers(self, country: str = "FI") -> list[dict[str, Any]]:
        """
        Return all major streaming providers for a country, including both
        JustWatch `shortName` (for GraphQL filtering) and `packageId` (which matches TMDB `provider_id`).
        """
        country = country.upper()
        cache_key = f"providers:{country}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        query = """
        query GetPackages($country: Country!) {
          packages(country: $country, platform: WEB, includeAddons: false) {
            packageId
            clearName
            shortName
            technicalName
            monetizationTypes
            icon(profile: S100, format: JPG)
          }
        }
        """
        resp = await self._http.post(
            JUSTWATCH_GRAPHQL_URL,
            json={"query": query, "variables": {"country": country}},
        )
        resp.raise_for_status()
        raw_packages = resp.json().get("data", {}).get("packages") or []

        # Prioritize flatrate/free/ads subscription & catch-up services first
        providers: list[dict[str, Any]] = []
        seen_names: set[str] = set()
        for pkg in raw_packages:
            m_types = pkg.get("monetizationTypes") or []
            if not any(m in ("FLATRATE", "FREE", "ADS", "RENT", "BUY") for m in m_types):
                continue
            clear_name = pkg.get("clearName", "")
            # Skip duplicate channel add-ons (e.g., "Paramount+ Amazon Channel")
            if "Channel" in clear_name or clear_name in seen_names:
                continue
            seen_names.add(clear_name)
            is_subscription = any(m in ("FLATRATE", "FREE", "ADS") for m in m_types)
            providers.append(
                {
                    "id": pkg["packageId"],  # Matches TMDB provider_id
                    "shortName": pkg["shortName"],
                    "technicalName": pkg.get("technicalName", ""),
                    "name": clear_name,
                    "icon": format_jw_image(pkg.get("icon"), "s100", "jpg"),
                    "monetizationTypes": m_types,
                    "isSubscription": is_subscription,
                }
            )

        # Sort so subscription/free streaming platforms appear first in the filter bar
        providers.sort(key=lambda p: (0 if p["isSubscription"] else 1))
        self._set_cache(cache_key, providers)
        return providers

    def _deduplicate_offers(self, raw_offers: list[dict[str, Any]], title_name: str = "") -> list[dict[str, Any]]:
        """
        Deduplicate offers by (packageId, monetizationCategory) keeping the highest presentation quality
        and preserving the direct deep-link (`standardWebURL`) to launch the streaming platform.
        """
        grouped: dict[tuple[int, str], dict[str, Any]] = {}
        for offer in raw_offers or []:
            pkg = offer.get("package") or {}
            pkg_id = pkg.get("packageId")
            if not pkg_id:
                continue
            m_type = (offer.get("monetizationType") or "FLATRATE").upper()
            category = categorize_monetization(m_type)
            quality = normalize_quality(offer.get("presentationType"))
            quality_score = QUALITY_RANK.get(offer.get("presentationType") or "", 1)

            direct_url = offer.get("standardWebURL") or offer.get("deeplinkURL")
            tech_name = (pkg.get("technicalName") or "").lower()
            if not direct_url and tech_name in PROVIDER_SEARCH_FALLBACKS and title_name:
                direct_url = PROVIDER_SEARCH_FALLBACKS[tech_name].format(query=quote_plus(title_name))

            key = (pkg_id, category)
            existing = grouped.get(key)
            if existing is None or quality_score > existing["_qualityScore"]:
                grouped[key] = {
                    "providerId": pkg_id,
                    "providerName": pkg.get("clearName", "Unknown"),
                    "providerShortName": pkg.get("shortName", ""),
                    "providerTechName": tech_name,
                    "icon": format_jw_image(pkg.get("icon"), "s100", "jpg"),
                    "monetizationType": m_type,
                    "category": category,  # 'stream' | 'rent' | 'buy'
                    "quality": quality,
                    "price": offer.get("retailPrice"),
                    "url": direct_url,
                    "_qualityScore": quality_score,
                    "_monetizationRank": MONETIZATION_RANK.get(m_type, 9),
                }

        results = list(grouped.values())
        results.sort(key=lambda x: (x["_monetizationRank"], -x["_qualityScore"]))
        for item in results:
            item.pop("_qualityScore", None)
            item.pop("_monetizationRank", None)
        return results

    def _format_jw_node(self, node: dict[str, Any]) -> dict[str, Any]:
        """Format a JustWatch GraphQL `MovieOrShow` node into a unified Title dictionary."""
        content = node.get("content") or {}
        title = content.get("title") or "Untitled"
        scoring = content.get("scoring") or {}
        ext_ids = content.get("externalIds") or {}
        backdrops = content.get("backdrops") or []
        backdrop_template = backdrops[0].get("backdropUrl") if backdrops else None

        genre_codes = [g.get("shortName", "") for g in (content.get("genres") or []) if g.get("shortName")]
        genres = [GENRE_MAP_JW_TO_NAME.get(code, code) for code in genre_codes]

        offers = self._deduplicate_offers(node.get("offers") or [], title_name=title)
        stream_offers = [o for o in offers if o["category"] == "stream"]
        rent_offers = [o for o in offers if o["category"] == "rent"]
        buy_offers = [o for o in offers if o["category"] == "buy"]

        obj_type = (node.get("objectType") or "MOVIE").upper()
        media_type = "movie" if obj_type == "MOVIE" else "tv"

        return {
            "id": node.get("id"),
            "tmdbId": ext_ids.get("tmdbId"),
            "imdbId": ext_ids.get("imdbId"),
            "mediaType": media_type,
            "title": title,
            "year": content.get("originalReleaseYear"),
            "overview": content.get("shortDescription") or "",
            "runtime": content.get("runtime"),
            "ageCertification": content.get("ageCertification"),
            "poster": format_jw_image(content.get("posterUrl"), "s592", "webp"),
            "backdrop": format_jw_image(backdrop_template, "s1440", "webp"),
            "imdbScore": round(scoring["imdbScore"], 1) if scoring.get("imdbScore") else None,
            "tmdbScore": round(scoring["tmdbScore"], 1) if scoring.get("tmdbScore") else None,
            "genres": genres,
            "genreCodes": genre_codes,
            "offers": {
                "all": offers,
                "stream": stream_offers,
                "rent": rent_offers,
                "buy": buy_offers,
            },
            "sourceEngine": "tmdb+justwatch" if self.tmdb_api_key else "justwatch_direct",
        }

    async def browse_or_search_justwatch(
        self,
        country: str = "FI",
        search_query: str = "",
        providers: list[str] | None = None,
        media_type: str = "all",
        genres: list[str] | None = None,
        monetization: str = "stream",
        sort_by: str = "POPULAR",
        year_min: int | None = None,
        year_max: int | None = None,
        first: int = 24,
        after: str | None = None,
    ) -> dict[str, Any]:
        """
        Query JustWatch GraphQL for popular titles or search results across streaming services,
        supporting simultaneous search query + category filtering, sorting, and release year bounds.
        """
        country = country.upper()
        title_filter: dict[str, Any] = {}
        if search_query.strip():
            title_filter["searchQuery"] = search_query.strip()
        if providers:
            title_filter["packages"] = providers
        if media_type == "movie":
            title_filter["objectTypes"] = ["MOVIE"]
        elif media_type == "tv":
            title_filter["objectTypes"] = ["SHOW"]
        if genres:
            title_filter["genres"] = [g for g in genres if g in GENRE_MAP_JW_TO_NAME]
        if year_min or year_max:
            ry: dict[str, int] = {}
            if year_min:
                ry["min"] = int(year_min)
            if year_max:
                ry["max"] = int(year_max)
            title_filter["releaseYear"] = ry

        if monetization == "stream" and not search_query.strip():
            title_filter["monetizationTypes"] = ["FLATRATE", "FREE", "ADS"]

        jw_sort = sort_by.upper() if sort_by and sort_by.upper() in VALID_SORT_OPTIONS else "POPULAR"
        random_seed = int(time.time()) % 1000 if jw_sort == "RANDOM" else 0

        graphql_query = """
        query GetCatalog(
          $country: Country!,
          $language: Language!,
          $first: Int!,
          $after: String,
          $sortBy: PopularTitlesSorting!,
          $sortRandomSeed: Int!,
          $filter: TitleFilter
        ) {
          popularTitles(
            country: $country,
            first: $first,
            after: $after,
            sortBy: $sortBy,
            sortRandomSeed: $sortRandomSeed,
            filter: $filter
          ) {
            totalCount
            pageInfo {
              endCursor
              hasNextPage
            }
            edges {
              node {
                id
                objectId
                objectType
                content(country: $country, language: $language) {
                  title
                  originalReleaseYear
                  shortDescription
                  runtime
                  posterUrl
                  backdrops {
                    backdropUrl
                  }
                  scoring {
                    imdbScore
                    tmdbScore
                  }
                  externalIds {
                    imdbId
                    tmdbId
                  }
                  genres {
                    shortName
                  }
                }
                offers(country: $country, platform: WEB) {
                  monetizationType
                  presentationType
                  retailPrice(language: $language)
                  standardWebURL
                  package {
                    packageId
                    clearName
                    shortName
                    technicalName
                    icon(profile: S100, format: JPG)
                  }
                }
              }
            }
          }
        }
        """

        variables = {
            "country": country,
            "language": "en",
            "first": first,
            "after": after,
            "sortBy": jw_sort,
            "sortRandomSeed": random_seed,
            "filter": title_filter,
        }
        resp = await self._http.post(
            JUSTWATCH_GRAPHQL_URL,
            json={"query": graphql_query, "variables": variables},
        )
        resp.raise_for_status()
        payload = resp.json().get("data", {}).get("popularTitles") or {}
        edges = payload.get("edges") or []
        items = [self._format_jw_node(edge["node"]) for edge in edges if edge.get("node")]

        return {
            "totalCount": payload.get("totalCount", len(items)),
            "nextCursor": (payload.get("pageInfo") or {}).get("endCursor"),
            "hasNextPage": (payload.get("pageInfo") or {}).get("hasNextPage", False),
            "items": items,
            "engine": "justwatch_graphql",
        }

    async def enrich_tmdb_item_with_direct_links(
        self,
        tmdb_item: dict[str, Any],
        media_type: str,
        country: str,
    ) -> dict[str, Any]:
        """
        Given a TMDB movie or TV item, query JustWatch GraphQL by title & type
        and match by `tmdbId` (or title + release year) to attach direct streaming deep links!
        """
        tmdb_id_str = str(tmdb_item.get("id", ""))
        title = tmdb_item.get("title") or tmdb_item.get("name") or ""
        release_date = tmdb_item.get("release_date") or tmdb_item.get("first_air_date") or ""
        year = int(release_date[:4]) if len(release_date) >= 4 and release_date[:4].isdigit() else None

        obj_type = "MOVIE" if media_type == "movie" else "SHOW"
        cache_key = f"enrich:{country}:{media_type}:{tmdb_id_str}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        graphql_query = """
        query MatchTMDB($country: Country!, $language: Language!, $filter: TitleFilter) {
          popularTitles(country: $country, first: 5, filter: $filter) {
            edges {
              node {
                id
                objectType
                content(country: $country, language: $language) {
                  title
                  originalReleaseYear
                  runtime
                  scoring {
                    imdbScore
                    tmdbScore
                  }
                  externalIds {
                    imdbId
                    tmdbId
                  }
                  genres {
                    shortName
                  }
                }
                offers(country: $country, platform: WEB) {
                  monetizationType
                  presentationType
                  retailPrice(language: $language)
                  standardWebURL
                  package {
                    packageId
                    clearName
                    shortName
                    technicalName
                    icon(profile: S100, format: JPG)
                  }
                }
              }
            }
          }
        }
        """
        matched_node = None
        if title:
            try:
                resp = await self._http.post(
                    JUSTWATCH_GRAPHQL_URL,
                    json={
                        "query": graphql_query,
                        "variables": {
                            "country": country.upper(),
                            "language": "en",
                            "filter": {"searchQuery": title, "objectTypes": [obj_type]},
                        },
                    },
                )
                if resp.status_code == 200:
                    edges = resp.json().get("data", {}).get("popularTitles", {}).get("edges") or []
                    for edge in edges:
                        node = edge.get("node") or {}
                        ext_tmdb = str(((node.get("content") or {}).get("externalIds") or {}).get("tmdbId") or "")
                        if ext_tmdb and ext_tmdb == tmdb_id_str:
                            matched_node = node
                            break
                    if not matched_node and edges:
                        # Fallback match by exact title + year
                        for edge in edges:
                            node = edge.get("node") or {}
                            c = node.get("content") or {}
                            if c.get("title", "").lower() == title.lower() and (
                                not year or c.get("originalReleaseYear") == year
                            ):
                                matched_node = node
                                break
                        if not matched_node:
                            matched_node = edges[0].get("node")
            except Exception:
                matched_node = None

        offers_list = self._deduplicate_offers(
            (matched_node or {}).get("offers") or [],
            title_name=title,
        )
        matched_content = (matched_node or {}).get("content") or {}
        scoring = matched_content.get("scoring") or {}
        ext_ids = matched_content.get("externalIds") or {}
        genre_codes = [
            g.get("shortName", "")
            for g in (matched_content.get("genres") or [])
            if g.get("shortName")
        ]
        genres = [GENRE_MAP_JW_TO_NAME.get(code, code) for code in genre_codes]

        poster_path = tmdb_item.get("poster_path")
        backdrop_path = tmdb_item.get("backdrop_path")
        vote_avg = tmdb_item.get("vote_average")

        result = {
            "id": (matched_node or {}).get("id") or f"tmdb-{media_type}-{tmdb_id_str}",
            "tmdbId": tmdb_id_str,
            "imdbId": ext_ids.get("imdbId"),
            "mediaType": media_type,
            "title": title,
            "year": year or matched_content.get("originalReleaseYear"),
            "overview": tmdb_item.get("overview") or "",
            "runtime": matched_content.get("runtime"),
            "poster": f"{TMDB_IMAGE_BASE}/w500{poster_path}" if poster_path else None,
            "backdrop": f"{TMDB_IMAGE_BASE}/w1280{backdrop_path}" if backdrop_path else None,
            "imdbScore": round(scoring["imdbScore"], 1) if scoring.get("imdbScore") else None,
            "tmdbScore": round(float(vote_avg), 1) if vote_avg else (
                round(scoring["tmdbScore"], 1) if scoring.get("tmdbScore") else None
            ),
            "genres": genres,
            "genreCodes": genre_codes,
            "offers": {
                "all": offers_list,
                "stream": [o for o in offers_list if o["category"] == "stream"],
                "rent": [o for o in offers_list if o["category"] == "rent"],
                "buy": [o for o in offers_list if o["category"] == "buy"],
            },
            "sourceEngine": "tmdb+justwatch",
        }
        self._set_cache(cache_key, result)
        return result

    async def browse_or_search(
        self,
        country: str = "FI",
        search_query: str = "",
        provider_short_names: list[str] | None = None,
        provider_ids: list[int] | None = None,
        media_type: str = "all",
        genres: list[str] | None = None,
        monetization: str = "stream",
        sort_by: str = "POPULAR",
        year_min: int | None = None,
        year_max: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        """
        Unified search & inventory discovery method with full category/genre filtering,
        sorting, and release year bounds.
        """
        country = country.upper()
        active_genres = [g.strip() for g in (genres or []) if g.strip() in GENRE_MAP_JW_TO_NAME]

        # When TMDB API key is configured and user searches or browses on page 1 (and not using RANDOM sort):
        if self.tmdb_api_key and not after and sort_by != "RANDOM":
            try:
                if search_query.strip() and not active_genres:
                    headers, params = self._tmdb_headers_and_params(
                        {"query": search_query.strip(), "include_adult": "false", "language": "en-US", "page": 1}
                    )
                    endpoint = (
                        f"{TMDB_API_BASE}/search/movie"
                        if media_type == "movie"
                        else f"{TMDB_API_BASE}/search/tv"
                        if media_type == "tv"
                        else f"{TMDB_API_BASE}/search/multi"
                    )
                    resp = await self._http.get(endpoint, headers=headers, params=params)
                    if resp.status_code == 200:
                        raw_results = resp.json().get("results") or []
                        filtered = [
                            r
                            for r in raw_results
                            if r.get("media_type", media_type if media_type in ("movie", "tv") else "movie")
                            in ("movie", "tv")
                        ][:16]
                        enriched = list(
                            await asyncio.gather(
                                *[
                                    self.enrich_tmdb_item_with_direct_links(
                                        r,
                                        r.get("media_type") or (media_type if media_type in ("movie", "tv") else "movie"),
                                        country,
                                    )
                                    for r in filtered
                                ]
                            )
                        )
                        if provider_Short := set(provider_short_names or []):
                            enriched = [
                                item
                                for item in enriched
                                if any(o["providerShortName"] in provider_Short for o in item["offers"]["all"])
                            ]
                        if year_min:
                            enriched = [item for item in enriched if (item.get("year") or 0) >= year_min]
                        if year_max:
                            enriched = [item for item in enriched if (item.get("year") or 9999) <= year_max]
                        return {
                            "totalCount": len(enriched),
                            "nextCursor": None,
                            "hasNextPage": False,
                            "items": enriched,
                            "engine": "tmdb+justwatch_hybrid",
                        }
                elif not search_query.strip():
                    # TMDB Discover across selected watch providers + categories
                    target_type = "tv" if media_type == "tv" else "movie"
                    tmdb_sort_map = {
                        "POPULAR": "popularity.desc",
                        "TRENDING": "popularity.desc",
                        "IMDB_SCORE": "vote_average.desc",
                        "RELEASE_YEAR": "primary_release_date.desc" if target_type == "movie" else "first_air_date.desc",
                    }
                    discover_params: dict[str, Any] = {
                        "watch_region": country,
                        "sort_by": tmdb_sort_map.get(sort_by, "popularity.desc"),
                        "language": "en-US",
                        "page": 1,
                    }
                    if sort_by == "IMDB_SCORE":
                        discover_params["vote_count.gte"] = 200
                    if provider_ids:
                        discover_params["with_watch_providers"] = "|".join(str(pid) for pid in provider_ids)
                    if monetization == "stream":
                        discover_params["with_watch_monetization_types"] = "flatrate|free|ads"
                    if active_genres:
                        tmdb_gids = [str(TMDB_TO_JW_GENRE[g]) for g in active_genres if g in TMDB_TO_JW_GENRE]
                        if tmdb_gids:
                            discover_params["with_genres"] = ",".join(tmdb_gids)
                    if year_min:
                        date_key = "primary_release_date.gte" if target_type == "movie" else "first_air_date.gte"
                        discover_params[date_key] = f"{year_min}-01-01"
                    if year_max:
                        date_key = "primary_release_date.lte" if target_type == "movie" else "first_air_date.lte"
                        discover_params[date_key] = f"{year_max}-12-31"

                    headers, params = self._tmdb_headers_and_params(discover_params)
                    resp = await self._http.get(
                        f"{TMDB_API_BASE}/discover/{target_type}",
                        headers=headers,
                        params=params,
                    )
                    if resp.status_code == 200:
                        raw_results = (resp.json().get("results") or [])[:16]
                        enriched = list(
                            await asyncio.gather(
                                *[
                                    self.enrich_tmdb_item_with_direct_links(r, target_type, country)
                                    for r in raw_results
                                ]
                            )
                        )
                        return {
                            "totalCount": resp.json().get("total_results", len(enriched)),
                            "nextCursor": "NQ==",
                            "hasNextPage": True,
                            "items": enriched,
                            "engine": "tmdb+justwatch_hybrid",
                        }
            except Exception:
                # Gracefully fall back to JustWatch GraphQL if TMDB call fails
                pass

        return await self.browse_or_search_justwatch(
            country=country,
            search_query=search_query,
            providers=provider_short_names,
            media_type=media_type,
            genres=active_genres or None,
            monetization=monetization,
            sort_by=sort_by,
            year_min=year_min,
            year_max=year_max,
            first=24,
            after=after,
        )

    async def get_title_details(self, node_id: str, country: str = "FI", tmdb_id: str | None = None, media_type: str = "movie") -> dict[str, Any]:
        """
        Fetch full details for a movie or show (runtime, age rating, cast, director,
        YouTube trailer via TMDB if available, and all streaming offers with direct links).
        """
        country = country.upper()
        cache_key = f"detail:{country}:{node_id}:{tmdb_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        detail: dict[str, Any] = {}
        if node_id and not node_id.startswith("tmdb-"):
            query = """
            query GetNodeDetail($id: ID!, $country: Country!, $language: Language!) {
              node(id: $id) {
                ... on MovieOrShow {
                  id
                  objectId
                  objectType
                  content(country: $country, language: $language) {
                    title
                    originalReleaseYear
                    shortDescription
                    runtime
                    ageCertification
                    posterUrl
                    backdrops {
                      backdropUrl
                    }
                    scoring {
                      imdbScore
                      tmdbScore
                    }
                    externalIds {
                      imdbId
                      tmdbId
                    }
                    genres {
                      shortName
                    }
                    credits {
                      role
                      name
                      characterName
                    }
                  }
                  offers(country: $country, platform: WEB) {
                    monetizationType
                    presentationType
                    retailPrice(language: $language)
                    standardWebURL
                    package {
                      packageId
                      clearName
                      shortName
                      technicalName
                      icon(profile: S100, format: JPG)
                    }
                  }
                }
              }
            }
            """
            resp = await self._http.post(
                JUSTWATCH_GRAPHQL_URL,
                json={"query": query, "variables": {"id": node_id, "country": country, "language": "en"}},
            )
            if resp.status_code == 200:
                node = resp.json().get("data", {}).get("node")
                if node:
                    detail = self._format_jw_node(node)
                    credits_raw = (node.get("content") or {}).get("credits") or []
                    directors = [c["name"] for c in credits_raw if c.get("role") == "DIRECTOR"][:3]
                    cast = [
                        {"name": c.get("name"), "character": c.get("characterName")}
                        for c in credits_raw
                        if c.get("role") == "ACTOR"
                    ][:10]
                    detail["directors"] = directors
                    detail["cast"] = cast
                    tmdb_id = tmdb_id or detail.get("tmdbId")
                    media_type = detail.get("mediaType", media_type)

        # If TMDB API key is configured and we have tmdb_id, enrich with TMDB trailer, tagline, & watch link
        if self.tmdb_api_key and tmdb_id:
            try:
                headers, params = self._tmdb_headers_and_params({"append_to_response": "videos,watch/providers,credits"})
                resp = await self._http.get(
                    f"{TMDB_API_BASE}/{media_type}/{tmdb_id}",
                    headers=headers,
                    params=params,
                )
                if resp.status_code == 200:
                    t_data = resp.json()
                    detail["tagline"] = t_data.get("tagline")
                    if t_data.get("overview"):
                        detail["overview"] = t_data["overview"]
                    videos = (t_data.get("videos") or {}).get("results") or []
                    yt_trailers = [
                        v for v in videos if v.get("site") == "YouTube" and v.get("type") in ("Trailer", "Teaser")
                    ]
                    if yt_trailers:
                        detail["trailerUrl"] = f"https://www.youtube.com/watch?v={yt_trailers[0]['key']}"
                    watch_prov = ((t_data.get("watch/providers") or {}).get("results") or {}).get(country) or {}
                    if watch_prov.get("link"):
                        detail["tmdbWatchUrl"] = watch_prov["link"]
            except Exception:
                pass

        self._set_cache(cache_key, detail)
        return detail

    async def aclose(self) -> None:
        await self._http.aclose()
