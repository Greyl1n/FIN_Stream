/**
 * StreamPulse Frontend Application (Desktop & Mobile PWA)
 * Works seamlessly across ALL environments:
 * 1. Local Python Backend (`python app.py` at http://127.0.0.1:8080)
 * 2. GitHub Pages & Standalone `index.html` (Zero-Server Mode):
 *    - Built-in 415+ multi-category catalog (`window.STREAMPULSE_STATIC_DATA`)
 *    - Live Zero-Key Universal Search combining:
 *        a) Apple iTunes Movie Search API (CORS `*`, full synopses, posters, genres, runtime)
 *        b) TVMaze Series Search API (CORS `*`, full synopses, posters, genres, ratings)
 *        c) IMDb Live JSONP Search (`v2.sg.media-imdb.com`, universal movie & TV lookup)
 *    - Full Client-Side Live TMDB API Mode when a user adds a free TMDB API key
 */

// Actively unregister any legacy service workers so stale caches never block search updates
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) {
      reg.unregister().catch(() => {});
    }
  }).catch(() => {});
}

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const JW_TO_TMDB_GENRE_MOVIE = {
  act: 28,
  ani: 16,
  cmy: 35,
  crm: 80,
  doc: 99,
  drm: 18,
  fml: 10751,
  fnt: 14,
  hrr: 27,
  hst: 36,
  msc: 10402,
  rma: 10749,
  scf: 878,
  trl: 53,
  war: 10752,
  wsn: 37,
};

const JW_TO_TMDB_GENRE_TV = {
  act: 10759,
  ani: 16,
  cmy: 35,
  crm: 80,
  doc: 99,
  drm: 18,
  fml: 10751,
  fnt: 10765,
  hrr: 9648,
  hst: 36,
  msc: 10402,
  rly: 10764,
  rma: 10749,
  scf: 10765,
  trl: 9648,
  war: 10768,
  wsn: 37,
};

const TMDB_ID_TO_GENRE_NAME = {
  28: "Action & Adventure",
  12: "Action & Adventure",
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Kids & Family",
  14: "Fantasy",
  10765: "Sci-Fi",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery & Thriller",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Mystery & Thriller",
  10752: "War & Military",
  10768: "War & Military",
  10764: "Reality TV",
  37: "Western",
};

const GENRE_NAME_TO_CODE = {
  action: "act",
  adventure: "act",
  "action & adventure": "act",
  "sci-fi": "scf",
  "science-fiction": "scf",
  "sci-fi & fantasy": "scf",
  comedy: "cmy",
  thriller: "trl",
  mystery: "trl",
  "mystery & thriller": "trl",
  drama: "drm",
  crime: "crm",
  horror: "hrr",
  animation: "ani",
  anime: "ani",
  documentary: "doc",
  nonfiction: "doc",
  fantasy: "fnt",
  romance: "rma",
  children: "fml",
  family: "fml",
  "kids & family": "fml",
  history: "hst",
  war: "war",
  "reality tv": "rly",
  sports: "spt",
  music: "msc",
  musical: "msc",
  western: "wsn",
};

const PROVIDER_DIRECT_SEARCH_URLS = {
  8: "https://www.netflix.com/search?q={q}",
  337: "https://www.disneyplus.com/search?q={q}",
  119: "https://www.primevideo.com/search?phrase={q}",
  9: "https://www.primevideo.com/search?phrase={q}",
  350: "https://tv.apple.com/search?term={q}",
  2: "https://tv.apple.com/search?term={q}",
  1899: "https://play.max.com/search?q={q}",
  384: "https://play.max.com/search?q={q}",
  323: "https://areena.yle.fi/haku?q={q}",
  338: "https://www.ruutu.fi/haku?q={q}",
  76: "https://viaplay.com/search?query={q}",
  1773: "https://www.skyshowtime.com/watch/search?q={q}",
  283: "https://www.crunchyroll.com/search?q={q}",
  531: "https://www.paramountplus.com/search/?q={q}",
  15: "https://www.hulu.com/search?q={q}",
};

const state = {
  backendAvailable: false,
  apiBase: ".",
  staticSnapshot: window.STREAMPULSE_STATIC_DATA || null,
  clientTmdbKey: localStorage.getItem("streampulse_tmdb_key") || "",
  country: localStorage.getItem("streampulse_country") || "FI",
  providers: [],
  categories: [],
  selectedProviders: new Set(JSON.parse(localStorage.getItem("streampulse_providers") || "[]")),
  selectedCategories: new Set(),
  searchQuery: "",
  mediaType: "all",
  monetization: "stream",
  sortBy: "POPULAR",
  eraRange: "",
  nextCursor: null,
  hasNextPage: false,
  items: [],
  watchlist: JSON.parse(localStorage.getItem("streampulse_watchlist") || "{}"),
  showingWatchlist: false,
  tmdbStatus: { configured: false, valid: false, message: "" },
};

const els = {
  countrySelect: document.getElementById("countrySelect"),
  searchCategorySelect: document.getElementById("searchCategorySelect"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  searchKbd: document.getElementById("searchKbd"),
  categorySuggestion: document.getElementById("categorySuggestion"),
  providersRail: document.getElementById("providersRail"),
  selectAllSubBtn: document.getElementById("selectAllSubBtn"),
  categoriesRail: document.getElementById("categoriesRail"),
  clearCategoriesBtn: document.getElementById("clearCategoriesBtn"),
  mediaTypeControl: document.getElementById("mediaTypeControl"),
  monetizationControl: document.getElementById("monetizationControl"),
  sortSelect: document.getElementById("sortSelect"),
  eraSelect: document.getElementById("eraSelect"),
  activeFiltersBar: document.getElementById("activeFiltersBar"),
  resultsMeta: document.getElementById("resultsMeta"),
  titlesGrid: document.getElementById("titlesGrid"),
  loadMoreContainer: document.getElementById("loadMoreContainer"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  watchlistToggleBtn: document.getElementById("watchlistToggleBtn"),
  watchlistCount: document.getElementById("watchlistCount"),
  tmdbSettingsBtn: document.getElementById("tmdbSettingsBtn"),
  tmdbStatusDot: document.getElementById("tmdbStatusDot"),
  tmdbStatusText: document.getElementById("tmdbStatusText"),
  detailModal: document.getElementById("detailModal"),
  detailModalContent: document.getElementById("detailModalContent"),
  closeDetailModalBtn: document.getElementById("closeDetailModalBtn"),
  tmdbModal: document.getElementById("tmdbModal"),
  closeTmdbModalBtn: document.getElementById("closeTmdbModalBtn"),
  tmdbModalStatusBox: document.getElementById("tmdbModalStatusBox"),
  tmdbKeyForm: document.getElementById("tmdbKeyForm"),
  tmdbKeyInput: document.getElementById("tmdbKeyInput"),
  brandReset: document.getElementById("brandReset"),
};

let searchDebounceTimer = null;

async function fetchWithTimeout(url, options = {}, timeoutMs = 1200) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function detectBackend() {
  const host = window.location.hostname || "";
  const isGitHubPages = host.endsWith(".github.io") || host.endsWith(".pages.dev") || host.endsWith(".netlify.app") || host.endsWith(".vercel.app");
  if (isGitHubPages) {
    state.backendAvailable = false;
    return null;
  }

  const candidates = [];
  if (window.location.protocol.startsWith("http")) {
    candidates.push(".");
  }
  if (window.location.protocol === "file:" || host === "127.0.0.1" || host === "localhost") {
    candidates.push("http://127.0.0.1:8080", "http://127.0.0.1:8000");
  }

  for (const base of candidates) {
    try {
      const resp = await fetchWithTimeout(`${base}/api/config`, {}, 1000);
      if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
        const cfg = await resp.json();
        state.backendAvailable = true;
        state.apiBase = base;
        return cfg;
      }
    } catch (_e) {}
  }
  state.backendAvailable = false;
  return null;
}

async function initApp() {
  updateWatchlistBadge();
  bindEvents();

  let config = await detectBackend();

  if (!config) {
    if (!state.staticSnapshot && window.STREAMPULSE_STATIC_DATA) {
      state.staticSnapshot = window.STREAMPULSE_STATIC_DATA;
    }
    if (!state.staticSnapshot) {
      try {
        const snapResp = await fetch("./static/fallback_catalog.json");
        state.staticSnapshot = await snapResp.json();
      } catch (_e) {
        state.staticSnapshot = { countries: [{ code: "FI", name: "Finland", flag: "🇫🇮" }], categories: [], providers: {}, catalog: {} };
      }
    }

    let tmdbStatus = {
      configured: Boolean(state.clientTmdbKey),
      valid: false,
      message: "Standalone / GitHub Pages Mode active. Built-in 415+ catalog + Live Universal Search enabled!",
    };
    if (state.clientTmdbKey) {
      tmdbStatus = await verifyClientTmdbKey(state.clientTmdbKey);
    }
    config = {
      countries: state.staticSnapshot.countries || [],
      categories: state.staticSnapshot.categories || [],
      tmdb: tmdbStatus,
    };
  }

  // Populate Countries
  els.countrySelect.innerHTML = (config.countries || [])
    .map(
      (c) =>
        `<option value="${c.code}" ${c.code === state.country ? "selected" : ""}>${c.flag} ${c.name} (${c.code})</option>`
    )
    .join("");

  // Populate Categories
  state.categories = config.categories || config.genres || [];
  renderSearchCategoryDropdown();
  renderCategoriesRail();

  updateTmdbStatusUI(config.tmdb);

  await loadProviders();
  await loadCatalog(true);
}

/* ============================================================================
   Client-Side Live Search & TMDB Helpers (for GitHub Pages & Standalone index.html)
   ============================================================================ */
function buildTmdbFetchArgs(endpoint, extraParams = {}) {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  const headers = { Accept: "application/json" };
  const key = (state.clientTmdbKey || "").trim();
  if (key.startsWith("eyJ") || key.length > 45) {
    headers["Authorization"] = `Bearer ${key}`;
  } else if (key) {
    url.searchParams.set("api_key", key);
  }
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  return { url: url.toString(), headers };
}

async function verifyClientTmdbKey(candidateKey) {
  const prev = state.clientTmdbKey;
  state.clientTmdbKey = (candidateKey || "").trim();
  if (!state.clientTmdbKey) {
    return { valid: false, configured: false, message: "TMDB API key cleared. Using built-in catalog + Live Zero-Key Search." };
  }
  try {
    const { url, headers } = buildTmdbFetchArgs("/configuration");
    const resp = await fetch(url, { headers });
    if (resp.ok) {
      return {
        valid: true,
        configured: true,
        message: "Live Client-Side TMDB API active!",
        maskedKey: `${state.clientTmdbKey.slice(0, 4)}...${state.clientTmdbKey.slice(-4)}`,
      };
    }
    state.clientTmdbKey = prev;
    return { valid: false, configured: true, message: "Invalid TMDB API key or Read Access Token." };
  } catch (err) {
    state.clientTmdbKey = prev;
    return { valid: false, configured: true, message: `Network error verifying TMDB key: ${err.message}` };
  }
}

function buildDirectProviderUrl(providerId, providerName, title, tmdbFallbackLink) {
  const q = encodeURIComponent(title || "");
  if (PROVIDER_DIRECT_SEARCH_URLS[providerId]) {
    return PROVIDER_DIRECT_SEARCH_URLS[providerId].replace("{q}", q);
  }
  const lower = (providerName || "").toLowerCase();
  if (lower.includes("netflix")) return `https://www.netflix.com/search?q=${q}`;
  if (lower.includes("disney")) return `https://www.disneyplus.com/search?q=${q}`;
  if (lower.includes("prime")) return `https://www.primevideo.com/search?phrase=${q}`;
  if (lower.includes("apple")) return `https://tv.apple.com/search?term=${q}`;
  if (lower.includes("max") || lower.includes("hbo")) return `https://play.max.com/search?q=${q}`;
  if (lower.includes("yle")) return `https://areena.yle.fi/haku?q=${q}`;
  if (lower.includes("ruutu")) return `https://www.ruutu.fi/haku?q=${q}`;
  if (lower.includes("viaplay")) return `https://viaplay.com/search?query=${q}`;
  if (lower.includes("skyshowtime")) return `https://www.skyshowtime.com/watch/search?q=${q}`;
  return tmdbFallbackLink || `https://www.justwatch.com/${state.country.toLowerCase()}/search?q=${q}`;
}

function buildQuickLaunchOffersForTitle(title) {
  let targetProviders =
    state.selectedProviders.size > 0
      ? state.providers.filter((p) => state.selectedProviders.has(p.shortName))
      : state.providers.filter((p) => p.isSubscription).slice(0, 5);

  if (!targetProviders.length) {
    targetProviders = [
      { id: 8, name: "Netflix", shortName: "nfx", icon: "https://images.justwatch.com/icon/207360008/s100/netflix.jpg" },
      { id: 337, name: "Disney Plus", shortName: "dnp", icon: "https://images.justwatch.com/icon/313118777/s100/disneyplus.jpg" },
      { id: 119, name: "Amazon Prime Video", shortName: "prv", icon: "https://images.justwatch.com/icon/322992749/s100/amazonprimevideo.jpg" },
      { id: 323, name: "Yle Areena", shortName: "yle", icon: "https://images.justwatch.com/icon/305025798/s100/yleareena.jpg" },
    ];
  }

  const offers = targetProviders.map((p) => ({
    providerId: p.id,
    providerName: p.name,
    providerShortName: p.shortName,
    icon: p.icon,
    monetizationType: "FLATRATE",
    category: "stream",
    quality: "HD",
    url: buildDirectProviderUrl(p.id, p.name, title, ""),
  }));

  return {
    all: offers,
    stream: offers,
    rent: [],
    buy: [],
  };
}

/**
 * 1) Live Zero-Key Apple iTunes Movie Search — sends `Access-Control-Allow-Origin: *`!
 */
async function searchItunesMoviesLive(query) {
  try {
    const resp = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query.trim())}&limit=18`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || [])
      .filter((r) => r.kind === "feature-movie" && r.trackName)
      .map((m) => {
        const title = m.trackName;
        const year = m.releaseDate ? parseInt(m.releaseDate.slice(0, 4), 10) : null;
        const gName = m.primaryGenreName || "";
        const gCode = GENRE_NAME_TO_CODE[gName.toLowerCase()] || "";
        const hiResPoster = m.artworkUrl100
          ? m.artworkUrl100.replace("100x100bb", "600x900bb")
          : null;
        return {
          id: `itunes-movie-${m.trackId}`,
          mediaType: "movie",
          title,
          year,
          overview: m.longDescription || m.shortDescription || "",
          runtime: m.trackTimeMillis ? Math.round(m.trackTimeMillis / 60000) : null,
          ageCertification: m.contentAdvisoryRating || null,
          poster: hiResPoster,
          backdrop: hiResPoster,
          imdbScore: null,
          genres: gName ? [gName] : [],
          genreCodes: gCode ? [gCode] : [],
          offers: buildQuickLaunchOffersForTitle(title),
        };
      });
  } catch (_e) {
    return [];
  }
}

/**
 * 2) Live Zero-Key TVMaze Show Search — sends `Access-Control-Allow-Origin: *`!
 */
async function searchTvMazeLive(query) {
  try {
    const resp = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query.trim())}`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data || []).slice(0, 12).map((entry) => {
      const s = entry.show || {};
      const title = s.name || "Untitled";
      const year = s.premiered ? parseInt(s.premiered.slice(0, 4), 10) : null;
      const rawGenres = s.genres || [];
      const genreCodes = rawGenres
        .map((g) => GENRE_NAME_TO_CODE[g.toLowerCase()])
        .filter(Boolean);
      const cleanSummary = (s.summary || "").replace(/<[^>]+>/g, "");
      return {
        id: `tvmaze-${s.id}`,
        mediaType: "tv",
        title,
        year,
        overview: cleanSummary,
        runtime: s.averageRuntime || s.runtime || null,
        poster: (s.image && (s.image.original || s.image.medium)) || null,
        backdrop: (s.image && s.image.original) || null,
        imdbScore: s.rating && s.rating.average ? s.rating.average : null,
        genres: rawGenres,
        genreCodes,
        offers: buildQuickLaunchOffersForTitle(title),
      };
    });
  } catch (_e) {
    return [];
  }
}

/**
 * 3) Live Zero-Key IMDb JSONP Search — strips non-alphanumeric chars so callback is always valid JS!
 */
function searchImdbJsonp(query) {
  return new Promise((resolve) => {
    const clean = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) {
      resolve([]);
      return;
    }
    const firstChar = clean[0] || "a";
    const callbackName = `imdb$${clean}`;
    const script = document.createElement("script");
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        resolve([]);
      }
    }, 3000);

    function cleanup() {
      clearTimeout(timer);
      try {
        delete window[callbackName];
      } catch (_e) {
        window[callbackName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (payload) => {
      if (finished) return;
      finished = true;
      cleanup();
      const rows = (payload && payload.d) || [];
      const items = rows
        .filter(
          (r) =>
            r.qid &&
            (r.qid === "movie" ||
              r.qid === "tvSeries" ||
              r.qid === "tvMiniSeries" ||
              r.qid === "feature")
        )
        .map((r) => {
          const isTv = r.qid === "tvSeries" || r.qid === "tvMiniSeries";
          const posterUrl = Array.isArray(r.i)
            ? r.i[0]
            : r.i && r.i.imageUrl
            ? r.i.imageUrl
            : null;
          return {
            id: `imdb-${r.id}`,
            imdbId: r.id,
            mediaType: isTv ? "tv" : "movie",
            title: r.l || "Untitled",
            year: r.y || null,
            overview: r.s ? `Starring: ${r.s}` : "",
            poster: posterUrl,
            backdrop: posterUrl,
            imdbScore: null,
            genres: [],
            genreCodes: [],
            offers: buildQuickLaunchOffersForTitle(r.l || ""),
          };
        });
      resolve(items);
    };

    script.src = `https://v2.sg.media-imdb.com/suggests/${firstChar}/${clean}.json`;
    script.onerror = () => {
      if (!finished) {
        finished = true;
        cleanup();
        resolve([]);
      }
    };
    document.head.appendChild(script);
  });
}

async function fetchClientTmdbCatalog(pageNum = 1) {
  const targetType = state.mediaType === "tv" ? "tv" : "movie";
  const selectedIds = state.providers
    .filter((p) => state.selectedProviders.has(p.shortName))
    .map((p) => p.id);
  const selectedCats = Array.from(state.selectedCategories);

  let endpoint = `/discover/${targetType}`;
  const params = { language: "en-US", page: pageNum };

  if (state.searchQuery.trim()) {
    endpoint = state.mediaType === "all" ? "/search/multi" : `/search/${targetType}`;
    params.query = state.searchQuery.trim();
  } else {
    params.watch_region = state.country;
    const sortMap = {
      POPULAR: "popularity.desc",
      TRENDING: "popularity.desc",
      IMDB_SCORE: "vote_average.desc",
      RELEASE_YEAR: targetType === "movie" ? "primary_release_date.desc" : "first_air_date.desc",
      RANDOM: "popularity.desc",
    };
    params.sort_by = sortMap[state.sortBy] || "popularity.desc";
    if (state.sortBy === "IMDB_SCORE") params["vote_count.gte"] = 150;
    if (selectedIds.length) params.with_watch_providers = selectedIds.join("|");
    if (state.monetization === "stream") params.with_watch_monetization_types = "flatrate|free|ads";
    if (selectedCats.length) {
      const gMap = targetType === "tv" ? JW_TO_TMDB_GENRE_TV : JW_TO_TMDB_GENRE_MOVIE;
      const gIds = selectedCats.map((c) => gMap[c]).filter(Boolean);
      if (gIds.length) params.with_genres = gIds.join(",");
    }
    if (state.eraRange && state.eraRange.includes("-")) {
      const [yMin, yMax] = state.eraRange.split("-");
      const kGte = targetType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
      const kLte = targetType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
      if (yMin) params[kGte] = `${yMin}-01-01`;
      if (yMax) params[kLte] = `${yMax}-12-31`;
    }
  }

  const { url, headers } = buildTmdbFetchArgs(endpoint, params);
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  const rawResults = (data.results || [])
    .filter((r) => (r.media_type || targetType) === "movie" || (r.media_type || targetType) === "tv")
    .slice(0, 18);

  const items = await Promise.all(
    rawResults.map(async (r) => {
      const mType = r.media_type || targetType;
      const title = r.title || r.name || "Untitled";
      const rel = r.release_date || r.first_air_date || "";
      const year = rel ? parseInt(rel.slice(0, 4), 10) : null;
      const genres = (r.genre_ids || []).map((gid) => TMDB_ID_TO_GENRE_NAME[gid]).filter(Boolean);

      let offersAll = [];
      try {
        const wpCall = buildTmdbFetchArgs(`/${mType}/${r.id}/watch/providers`);
        const wpResp = await fetch(wpCall.url, { headers: wpCall.headers });
        if (wpResp.ok) {
          const wpData = await wpResp.json();
          const regionData = (wpData.results || {})[state.country] || {};
          const fallbackLink = regionData.link || "";
          const mapGroup = (arr, mTypeLabel, catLabel) =>
            (arr || []).map((p) => ({
              providerId: p.provider_id,
              providerName: p.provider_name,
              providerShortName: `tmdb_${p.provider_id}`,
              icon: p.logo_path ? `${TMDB_IMAGE_BASE}/w92${p.logo_path}` : "",
              monetizationType: mTypeLabel,
              category: catLabel,
              quality: "HD",
              url: buildDirectProviderUrl(p.provider_id, p.provider_name, title, fallbackLink),
            }));
          offersAll = [
            ...mapGroup(regionData.flatrate, "FLATRATE", "stream"),
            ...mapGroup(regionData.free, "FREE", "stream"),
            ...mapGroup(regionData.ads, "ADS", "stream"),
            ...mapGroup(regionData.rent, "RENT", "rent"),
            ...mapGroup(regionData.buy, "BUY", "buy"),
          ];
        }
      } catch (_e) {}

      return {
        id: `tmdb-${mType}-${r.id}`,
        tmdbId: String(r.id),
        mediaType: mType,
        title,
        year,
        overview: r.overview || "",
        poster: r.poster_path ? `${TMDB_IMAGE_BASE}/w500${r.poster_path}` : null,
        backdrop: r.backdrop_path ? `${TMDB_IMAGE_BASE}/w1280${r.backdrop_path}` : null,
        tmdbScore: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
        genres: Array.from(new Set(genres)),
        offers: {
          all: offersAll,
          stream: offersAll.filter((o) => o.category === "stream"),
          rent: offersAll.filter((o) => o.category === "rent"),
          buy: offersAll.filter((o) => o.category === "buy"),
        },
      };
    })
  );

  return {
    totalCount: data.total_results || items.length,
    nextCursor: data.page < data.total_pages ? String(pageNum + 1) : null,
    hasNextPage: data.page < data.total_pages,
    items,
  };
}

async function searchOrBrowseStaticAndLive() {
  const pool =
    (state.staticSnapshot &&
      state.staticSnapshot.catalog &&
      (state.staticSnapshot.catalog[state.country] || state.staticSnapshot.catalog["FI"])) ||
    [];
  const q = state.searchQuery.trim().toLowerCase();
  const qTokens = q.split(/\s+/).filter(Boolean);
  const selectedCats = Array.from(state.selectedCategories);
  const selectedShorts = state.selectedProviders;

  const matchesMetadataFilters = (item, isFromLiveSearchAPI = false) => {
    if (state.mediaType !== "all" && item.mediaType !== state.mediaType) return false;

    if (!isFromLiveSearchAPI && qTokens.length > 0) {
      const hay = `${item.title} ${item.overview || ""} ${(item.genres || []).join(" ")}`
        .toLowerCase()
        .replace(/[-:]/g, " ");
      const allMatched = qTokens.every((tok) => hay.includes(tok.replace(/[-:]/g, "")));
      if (!allMatched) return false;
    }

    if (selectedCats.length > 0) {
      const codes = item.genreCodes || [];
      const names = item.genres || [];
      if (codes.length > 0 || names.length > 0) {
        const matchesCat = selectedCats.some((cId) => {
          const catObj = state.categories.find((c) => c.id === cId);
          return codes.includes(cId) || (catObj && names.includes(catObj.name));
        });
        if (!matchesCat) return false;
      }
    }

    if (!isFromLiveSearchAPI && selectedShorts.size > 0) {
      const hasProv = ((item.offers && item.offers.all) || []).some((o) =>
        selectedShorts.has(o.providerShortName)
      );
      if (!hasProv) return false;
    }

    if (state.eraRange && state.eraRange.includes("-")) {
      const [yMin, yMax] = state.eraRange.split("-").map((n) => parseInt(n, 10));
      if (yMin && (item.year || 0) < yMin) return false;
      if (yMax && (item.year || 9999) > yMax) return false;
    }
    return true;
  };

  let filtered = pool.filter((item) => matchesMetadataFilters(item, false));

  // When user searches for any title, also query live CORS/JSONP APIs (IMDb + iTunes Movies + TVMaze)
  if (q.length >= 2) {
    const [imdbResults, itunesResults, tvmazeResults] = await Promise.all([
      searchImdbJsonp(q),
      state.mediaType === "tv" ? Promise.resolve([]) : searchItunesMoviesLive(q),
      state.mediaType === "movie" ? Promise.resolve([]) : searchTvMazeLive(q),
    ]);

    const seenTitles = new Set(
      filtered.map((x) => `${(x.title || "").toLowerCase().replace(/[^a-z0-9]/g, "")}-${x.year || ""}`)
    );

    for (const liveItem of [...imdbResults, ...itunesResults, ...tvmazeResults]) {
      const normKey = `${(liveItem.title || "").toLowerCase().replace(/[^a-z0-9]/g, "")}-${
        liveItem.year || ""
      }`;
      if (!seenTitles.has(normKey) && matchesMetadataFilters(liveItem, true)) {
        seenTitles.add(normKey);
        filtered.push(liveItem);
      }
    }
  }

  if (state.sortBy === "IMDB_SCORE") {
    filtered.sort((a, b) => (b.imdbScore || b.tmdbScore || 0) - (a.imdbScore || a.tmdbScore || 0));
  } else if (state.sortBy === "RELEASE_YEAR") {
    filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (state.sortBy === "RANDOM") {
    filtered = [...filtered].sort(() => Math.random() - 0.5);
  }

  return {
    totalCount: filtered.length,
    nextCursor: null,
    hasNextPage: false,
    items: filtered,
  };
}

function renderSearchCategoryDropdown() {
  const activeArr = Array.from(state.selectedCategories);
  const singleSelected = activeArr.length === 1 ? activeArr[0] : "";

  els.searchCategorySelect.innerHTML =
    `<option value="">🎬 All Categories${activeArr.length > 1 ? ` (${activeArr.length})` : ""}</option>` +
    state.categories
      .map(
        (cat) =>
          `<option value="${escapeHtml(cat.id)}" ${cat.id === singleSelected ? "selected" : ""}>${
            cat.icon || "🎬"
          } ${escapeHtml(cat.name)}</option>`
      )
      .join("");

  if (activeArr.length > 0) {
    const names = activeArr
      .map((id) => (state.categories.find((c) => c.id === id) || {}).name || id)
      .join(" + ");
    els.searchInput.placeholder = `Search within ${names} across streaming services...`;
  } else {
    els.searchInput.placeholder = "Search titles or keywords across Netflix, Disney+, Max, Yle...";
  }
}

function renderCategoriesRail() {
  const hasSelected = state.selectedCategories.size > 0;
  els.clearCategoriesBtn.classList.toggle("hidden", !hasSelected);
  if (hasSelected) {
    els.clearCategoriesBtn.textContent = `Clear Categories (${state.selectedCategories.size})`;
  }

  const allPill = `
    <button
      class="category-pill ${!hasSelected ? "selected" : ""}"
      data-cat=""
      title="Show all categories"
    >
      <span class="cat-icon">🎬</span>
      <span>All Categories</span>
    </button>
  `;

  const catPills = state.categories
    .map((cat) => {
      const isSelected = state.selectedCategories.has(cat.id);
      return `
        <button
          class="category-pill ${isSelected ? "selected" : ""}"
          data-cat="${escapeHtml(cat.id)}"
          title="Filter search & catalog by ${escapeHtml(cat.name)}"
        >
          <span class="cat-icon">${cat.icon || "🎬"}</span>
          <span>${escapeHtml(cat.name)}</span>
        </button>
      `;
    })
    .join("");

  els.categoriesRail.innerHTML = allPill + catPills;
}

function detectCategoryFromQuery(query) {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 3) {
    els.categorySuggestion.classList.add("hidden");
    return;
  }
  const matched = state.categories.find((cat) => {
    if (state.selectedCategories.has(cat.id)) return false;
    const nameMatch = cat.name.toLowerCase().includes(q);
    const kwMatch = (cat.keywords || "")
      .toLowerCase()
      .split(/\s+/)
      .some((k) => k === q || (q.length >= 4 && k.startsWith(q)));
    return nameMatch || kwMatch;
  });

  if (matched) {
    els.categorySuggestion.innerHTML = `
      <span>💡 Filter by Category: <strong>${matched.icon || ""} ${escapeHtml(matched.name)}</strong></span>
      <span style="font-size:0.74rem;opacity:0.85;">(Click to apply)</span>
    `;
    els.categorySuggestion.dataset.catId = matched.id;
    els.categorySuggestion.classList.remove("hidden");
  } else {
    els.categorySuggestion.classList.add("hidden");
  }
}

function renderActiveFiltersBar() {
  const chips = [];

  if (state.searchQuery.trim()) {
    chips.push(`
      <span class="filter-chip">
        🔍 "${escapeHtml(state.searchQuery.trim())}"
        <button data-clear-type="query" title="Remove search query">✕</button>
      </span>
    `);
  }

  for (const catId of state.selectedCategories) {
    const cat = state.categories.find((c) => c.id === catId);
    if (cat) {
      chips.push(`
        <span class="filter-chip">
          ${cat.icon || "🎬"} ${escapeHtml(cat.name)}
          <button data-clear-type="category" data-val="${escapeHtml(catId)}" title="Remove category">✕</button>
        </span>
      `);
    }
  }

  for (const shortName of state.selectedProviders) {
    const prov = state.providers.find((p) => p.shortName === shortName);
    if (prov) {
      chips.push(`
        <span class="filter-chip">
          📺 ${escapeHtml(prov.name)}
          <button data-clear-type="provider" data-val="${escapeHtml(shortName)}" title="Remove platform">✕</button>
        </span>
      `);
    }
  }

  if (state.eraRange) {
    chips.push(`
      <span class="filter-chip">
        🗓️ ${escapeHtml(state.eraRange)}
        <button data-clear-type="era" title="Remove year filter">✕</button>
      </span>
    `);
  }

  if (chips.length > 0) {
    els.activeFiltersBar.innerHTML = `
      <span class="active-filters-label">Active Filters:</span>
      ${chips.join("")}
      <button class="text-btn" data-clear-type="all" style="margin-left:auto;">Reset All</button>
    `;
    els.activeFiltersBar.classList.remove("hidden");
  } else {
    els.activeFiltersBar.classList.add("hidden");
  }
}

function updateTmdbStatusUI(tmdb) {
  state.tmdbStatus = tmdb;
  if (tmdb.valid) {
    els.tmdbStatusDot.className = "status-dot connected";
    els.tmdbStatusText.textContent = "TMDB + Direct Links";
    els.tmdbModalStatusBox.innerHTML = `✅ <strong>Connected:</strong> ${escapeHtml(tmdb.message)} ${
      tmdb.maskedKey ? `(<code>${escapeHtml(tmdb.maskedKey)}</code>)` : ""
    }`;
  } else {
    els.tmdbStatusDot.className = "status-dot";
    els.tmdbStatusText.textContent = "Setup TMDB Key";
    els.tmdbModalStatusBox.innerHTML = state.backendAvailable
      ? `⚡ <strong>Active Engine:</strong> Live JustWatch GraphQL Catalog + Direct Streaming Links (Zero-key mode). Add a free TMDB API key below to enable hybrid TMDB discovery & trailers.`
      : `🌐 <strong>Standalone / GitHub Pages Mode Active:</strong> Built-in 415+ catalog + Live Universal Search (IMDb, Apple iTunes & TVMaze). Paste a free <strong>TMDB API Key</strong> below to unlock full TMDB provider discovery!`;
  }
}

async function loadProviders() {
  els.providersRail.innerHTML = `<div style="color:var(--text-secondary);font-size:0.84rem;padding:6px;">Loading streaming platforms...</div>`;
  try {
    if (state.backendAvailable) {
      const resp = await fetch(`${state.apiBase}/api/providers?country=${encodeURIComponent(state.country)}`);
      const data = await resp.json();
      state.providers = data.providers || [];
    } else if (state.clientTmdbKey && state.tmdbStatus.valid) {
      const { url, headers } = buildTmdbFetchArgs("/watch/providers/movie", { watch_region: state.country });
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      state.providers = (data.results || []).slice(0, 30).map((p) => ({
        id: p.provider_id,
        shortName: `tmdb_${p.provider_id}`,
        name: p.provider_name,
        icon: p.logo_path ? `${TMDB_IMAGE_BASE}/w92${p.logo_path}` : "",
        isSubscription: true,
      }));
    } else if (state.staticSnapshot) {
      state.providers =
        (state.staticSnapshot.providers &&
          (state.staticSnapshot.providers[state.country] || state.staticSnapshot.providers["FI"])) ||
        [];
    }
    const validShorts = new Set(state.providers.map((p) => p.shortName));
    for (const s of Array.from(state.selectedProviders)) {
      if (!validShorts.has(s)) state.selectedProviders.delete(s);
    }
    renderProvidersRail();
  } catch (err) {
    els.providersRail.innerHTML = `<div style="color:#f87171;font-size:0.84rem;">Failed to load providers.</div>`;
  }
}

function renderProvidersRail() {
  els.providersRail.innerHTML = state.providers
    .slice(0, 26)
    .map((p) => {
      const isSelected = state.selectedProviders.has(p.shortName);
      return `
        <button
          class="provider-chip ${isSelected ? "selected" : ""}"
          data-short="${escapeHtml(p.shortName)}"
          title="${escapeHtml(p.name)} (${p.isSubscription ? "Subscription / Free" : "Rent / Buy"})"
        >
          <img src="${escapeHtml(p.icon || "")}" alt="${escapeHtml(p.name)}" loading="lazy" />
          <span>${escapeHtml(p.name)}</span>
        </button>
      `;
    })
    .join("");

  els.selectAllSubBtn.textContent =
    state.selectedProviders.size > 0
      ? `Clear Platforms (${state.selectedProviders.size} selected)`
      : "Showing All Platforms";
}

async function loadCatalog(reset = true) {
  renderActiveFiltersBar();

  if (state.showingWatchlist) {
    renderWatchlistGrid();
    return;
  }

  if (reset) {
    state.nextCursor = null;
    els.titlesGrid.innerHTML = Array.from({ length: 8 })
      .map(
        () =>
          `<div class="title-card" style="height:370px;opacity:0.4;background:var(--bg-card);"></div>`
      )
      .join("");
  }

  const selectedShortList = Array.from(state.selectedProviders);
  const selectedIdList = state.providers
    .filter((p) => state.selectedProviders.has(p.shortName))
    .map((p) => p.id);
  const selectedCatsList = Array.from(state.selectedCategories);

  try {
    let data = null;
    if (state.backendAvailable) {
      const params = new URLSearchParams({
        country: state.country,
        q: state.searchQuery,
        providers: selectedShortList.join(","),
        provider_ids: selectedIdList.join(","),
        media_type: state.mediaType,
        genres: selectedCatsList.join(","),
        monetization: state.monetization,
        sort_by: state.sortBy,
      });
      if (state.eraRange && state.eraRange.includes("-")) {
        const [yMin, yMax] = state.eraRange.split("-");
        if (yMin) params.set("year_min", yMin);
        if (yMax) params.set("year_max", yMax);
      }
      if (!reset && state.nextCursor) {
        params.set("after", state.nextCursor);
      }
      const resp = await fetch(`${state.apiBase}/api/catalog?${params.toString()}`);
      data = await resp.json();
    } else if (state.clientTmdbKey && state.tmdbStatus.valid) {
      const pageNum = !reset && state.nextCursor ? parseInt(state.nextCursor, 10) : 1;
      data = await fetchClientTmdbCatalog(pageNum);
    } else {
      data = await searchOrBrowseStaticAndLive();
    }

    const newItems = data.items || [];
    state.items = reset ? newItems : [...state.items, ...newItems];
    state.nextCursor = data.nextCursor;
    state.hasNextPage = Boolean(data.hasNextPage && data.nextCursor);

    const catNames = selectedCatsList
      .map((id) => (state.categories.find((c) => c.id === id) || {}).name || id)
      .join(" + ");
    const catSummary = catNames ? ` in ${catNames}` : "";
    const platformSummary =
      selectedShortList.length > 0
        ? ` on ${selectedShortList.length} selected platform(s)`
        : ` across ${state.country} platforms`;
    els.resultsMeta.textContent = `${(data.totalCount || state.items.length).toLocaleString()} titles${catSummary}${platformSummary}`;

    renderTitlesGrid(state.items);
    els.loadMoreContainer.classList.toggle("hidden", !state.hasNextPage);
  } catch (err) {
    els.resultsMeta.textContent = "Error loading streaming catalog";
    els.titlesGrid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-secondary);">Could not load catalog. Please check your connection and try again.</div>`;
  }
}

function getPreferredOffersForCard(item) {
  const allOffers = (item.offers && item.offers.all) || [];
  if (state.selectedProviders.size > 0) {
    return [...allOffers].sort((a, b) => {
      const aSel = state.selectedProviders.has(a.providerShortName) ? 0 : 1;
      const bSel = state.selectedProviders.has(b.providerShortName) ? 0 : 1;
      return aSel - bSel;
    });
  }
  return allOffers;
}

function renderTitlesGrid(items) {
  if (!items.length) {
    els.titlesGrid.innerHTML = `
      <div style="grid-column:1/-1;padding:48px 20px;text-align:center;color:var(--text-secondary);">
        <h3 style="color:var(--text-primary);margin-bottom:8px;">No matching titles found</h3>
        <p>Try clearing some category or platform filters, switching to "+ Rent & Buy", or searching another title.</p>
      </div>
    `;
    return;
  }

  els.titlesGrid.innerHTML = items
    .map((item) => {
      const isSaved = Boolean(state.watchlist[item.id]);
      const score = item.imdbScore
        ? `★ ${item.imdbScore} IMDb`
        : item.tmdbScore
        ? `★ ${item.tmdbScore}`
        : "";
      const offers = getPreferredOffersForCard(item);
      const topOffer = offers[0] || null;

      const offerIconsHtml = offers
        .slice(0, 5)
        .map((off) => {
          const badgeLabel =
            off.category === "stream"
              ? off.quality || "HD"
              : off.category === "rent"
              ? "RENT"
              : "BUY";
          const badgeClass = off.category === "stream" ? "" : "rent";
          return `
            <a
              href="${escapeHtml(off.url || "#")}"
              target="_blank"
              rel="noopener noreferrer"
              class="offer-icon-link"
              title="Open '${escapeHtml(item.title)}' directly on ${escapeHtml(off.providerName)} (${off.monetizationType} ${off.quality || ""})"
              onclick="event.stopPropagation();"
            >
              <img src="${escapeHtml(off.icon || "")}" alt="${escapeHtml(off.providerName)}" loading="lazy" />
              <span class="offer-tag-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
            </a>
          `;
        })
        .join("");

      const directLaunchHtml = topOffer && topOffer.url
        ? `
          <a
            href="${escapeHtml(topOffer.url)}"
            target="_blank"
            rel="noopener noreferrer"
            class="direct-launch-btn"
            onclick="event.stopPropagation();"
            title="Launch directly in ${escapeHtml(topOffer.providerName)}"
          >
            ▶ Watch on ${escapeHtml(topOffer.providerName)}
          </a>
        `
        : `<span class="no-offers-label">Click for availability details</span>`;

      return `
        <article class="title-card" data-id="${escapeHtml(item.id)}" data-tmdb="${escapeHtml(item.tmdbId || "")}" data-type="${escapeHtml(item.mediaType)}">
          <div class="poster-wrapper" data-action="detail">
            ${
              item.poster
                ? `<img src="${escapeHtml(item.poster)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
                : `<div class="poster-fallback">${escapeHtml(item.title)}</div>`
            }
            <div class="card-badges-top">
              <span class="type-pill">${item.mediaType === "tv" ? "Series" : "Movie"}</span>
              ${score ? `<span class="score-pill">${escapeHtml(score)}</span>` : ""}
            </div>
            <button
              class="bookmark-btn ${isSaved ? "saved" : ""}"
              data-action="bookmark"
              title="${isSaved ? "Remove from Watchlist" : "Save to Watchlist"}"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>

          <div class="card-body">
            <div class="card-title-row" data-action="detail">
              <h3 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
              <div class="card-sub">
                ${item.year || "—"} ${item.genres && item.genres.length ? "• " + escapeHtml(item.genres.slice(0, 2).join(", ")) : ""}
              </div>
            </div>

            <div class="card-offers">
              ${offerIconsHtml ? `<div class="offer-icons-row">${offerIconsHtml}</div>` : ""}
              ${directLaunchHtml}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWatchlistGrid() {
  const savedItems = Object.values(state.watchlist);
  els.resultsMeta.textContent = `${savedItems.length} saved title(s) in your Watchlist`;
  els.loadMoreContainer.classList.add("hidden");
  renderTitlesGrid(savedItems);
}

async function openTitleDetail(nodeId, tmdbId, mediaType) {
  els.detailModal.classList.remove("hidden");
  els.detailModalContent.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-secondary);">Loading streaming links & details...</div>`;

  try {
    let d = null;
    if (state.backendAvailable) {
      const params = new URLSearchParams({
        country: state.country,
        media_type: mediaType || "movie",
      });
      if (tmdbId) params.set("tmdb_id", tmdbId);
      const resp = await fetch(`${state.apiBase}/api/title/${encodeURIComponent(nodeId)}?${params.toString()}`);
      d = await resp.json();
    } else {
      d = state.items.find((x) => x.id === nodeId) || state.watchlist[nodeId] || {};
      if (state.clientTmdbKey && tmdbId) {
        const { url, headers } = buildTmdbFetchArgs(`/${mediaType || "movie"}/${tmdbId}`, {
          append_to_response: "videos,credits",
        });
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const tData = await resp.json();
          d = { ...d, runtime: tData.runtime || d.runtime, overview: tData.overview || d.overview };
          const vids = (tData.videos && tData.videos.results) || [];
          const trailer = vids.find((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
          if (trailer) d.trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
          if (tData.credits && tData.credits.cast) {
            d.cast = tData.credits.cast.slice(0, 8).map((c) => ({ name: c.name, character: c.character }));
          }
        }
      }
    }

    const streamOffers = (d.offers && d.offers.stream) || [];
    const rentOffers = (d.offers && d.offers.rent) || [];
    const buyOffers = (d.offers && d.offers.buy) || [];

    const renderOfferCards = (list, actionLabel) =>
      list
        .map(
          (o) => `
          <a
            href="${escapeHtml(o.url || "#")}"
            target="_blank"
            rel="noopener noreferrer"
            class="offer-launch-card"
          >
            <div class="offer-left">
              <img src="${escapeHtml(o.icon || "")}" alt="${escapeHtml(o.providerName)}" />
              <div>
                <span class="offer-prov-name">${escapeHtml(o.providerName)}</span>
                <span class="offer-prov-sub">${escapeHtml(o.quality || "HD")}${
            o.price ? " • " + escapeHtml(o.price) : ""
          }</span>
              </div>
            </div>
            <span class="offer-open-badge">${actionLabel} ↗</span>
          </a>
        `
        )
        .join("");

    els.detailModalContent.innerHTML = `
      <div class="detail-hero" style="${
        d.backdrop ? `background-image:url('${escapeHtml(d.backdrop)}')` : ""
      }">
        <div class="detail-hero-inner">
          ${
            d.poster
              ? `<img class="detail-poster" src="${escapeHtml(d.poster)}" alt="${escapeHtml(d.title)}" />`
              : ""
          }
          <div>
            <h2 class="detail-title">${escapeHtml(d.title)}</h2>
            <div class="detail-meta-row">
              <span>${d.mediaType === "tv" ? "TV Series" : "Movie"}</span>
              ${d.year ? `<span>• ${d.year}</span>` : ""}
              ${d.runtime ? `<span>• ${d.runtime} min</span>` : ""}
              ${d.ageCertification ? `<span>• ${escapeHtml(d.ageCertification)}</span>` : ""}
              ${d.imdbScore ? `<span style="color:#fbbf24;font-weight:700;">• ★ ${d.imdbScore} IMDb</span>` : ""}
              ${d.tmdbScore ? `<span style="color:#38bdf8;font-weight:700;">• ${d.tmdbScore} TMDB</span>` : ""}
            </div>
            ${
              d.genres && d.genres.length
                ? `<div style="font-size:0.8rem;color:var(--text-secondary);">${escapeHtml(
                    d.genres.join(" • ")
                  )}</div>`
                : ""
            }
          </div>
        </div>
      </div>

      <div class="detail-body">
        ${
          d.trailerUrl
            ? `<div style="margin-bottom:16px;"><a href="${escapeHtml(
                d.trailerUrl
              )}" target="_blank" rel="noopener" class="text-btn" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;border-color:var(--accent);color:#fff;">▶ Watch Official Trailer (YouTube)</a></div>`
            : ""
        }
        <p class="detail-overview">${escapeHtml(d.overview || "No synopsis available.")}</p>

        ${
          streamOffers.length
            ? `<h4 class="offers-group-title">Stream Now (Subscription / Free)</h4>
               <div class="offers-list-grid">${renderOfferCards(streamOffers, "Watch")}</div>`
            : `<div style="padding:12px;background:var(--bg-card);border-radius:8px;color:var(--text-secondary);font-size:0.86rem;">Not currently on flatrate subscription in ${state.country}. Check Rent/Buy options below.</div>`
        }

        ${
          rentOffers.length
            ? `<h4 class="offers-group-title">Rent Digitally</h4>
               <div class="offers-list-grid">${renderOfferCards(rentOffers, "Rent")}</div>`
            : ""
        }

        ${
          buyOffers.length
            ? `<h4 class="offers-group-title">Buy Digitally</h4>
               <div class="offers-list-grid">${renderOfferCards(buyOffers, "Buy")}</div>`
            : ""
        }

        ${
          d.cast && d.cast.length
            ? `<h4 class="offers-group-title">Top Cast</h4>
               <div style="font-size:0.84rem;color:var(--text-secondary);line-height:1.5;">
                 ${d.cast
                   .map(
                     (c) =>
                       `<strong style="color:var(--text-primary);">${escapeHtml(c.name)}</strong>${
                         c.character ? ` (${escapeHtml(c.character)})` : ""
                       }`
                   )
                   .join(" • ")}
               </div>`
            : ""
        }
      </div>
    `;
  } catch (err) {
    els.detailModalContent.innerHTML = `<div style="padding:36px;text-align:center;color:#f87171;">Failed to load title details.</div>`;
  }
}

function toggleWatchlistItem(item) {
  if (state.watchlist[item.id]) {
    delete state.watchlist[item.id];
  } else {
    state.watchlist[item.id] = item;
  }
  localStorage.setItem("streampulse_watchlist", JSON.stringify(state.watchlist));
  updateWatchlistBadge();
  if (state.showingWatchlist) {
    renderWatchlistGrid();
  } else {
    renderTitlesGrid(state.items);
  }
}

function updateWatchlistBadge() {
  const count = Object.keys(state.watchlist).length;
  els.watchlistCount.textContent = count;
}

function syncCategoriesUI() {
  renderSearchCategoryDropdown();
  renderCategoriesRail();
}

function bindEvents() {
  // Country Switch
  els.countrySelect.addEventListener("change", async (e) => {
    state.country = e.target.value;
    localStorage.setItem("streampulse_country", state.country);
    await loadProviders();
    await loadCatalog(true);
  });

  // Search Category Dropdown (inside search bar)
  els.searchCategorySelect.addEventListener("change", (e) => {
    const val = e.target.value;
    state.selectedCategories.clear();
    if (val) {
      state.selectedCategories.add(val);
    }
    state.showingWatchlist = false;
    els.watchlistToggleBtn.classList.remove("active");
    syncCategoriesUI();
    loadCatalog(true);
  });

  // Visual Category Pills Rail (supports selecting one or multiple categories)
  els.categoriesRail.addEventListener("click", (e) => {
    const pill = e.target.closest(".category-pill");
    if (!pill) return;
    const catId = pill.dataset.cat;
    if (!catId) {
      state.selectedCategories.clear();
    } else if (state.selectedCategories.has(catId)) {
      state.selectedCategories.delete(catId);
    } else {
      state.selectedCategories.add(catId);
    }
    state.showingWatchlist = false;
    els.watchlistToggleBtn.classList.remove("active");
    syncCategoriesUI();
    loadCatalog(true);
  });

  els.clearCategoriesBtn.addEventListener("click", () => {
    state.selectedCategories.clear();
    syncCategoriesUI();
    loadCatalog(true);
  });

  // Smart Category Suggestion Banner Click
  els.categorySuggestion.addEventListener("click", () => {
    const catId = els.categorySuggestion.dataset.catId;
    if (catId) {
      state.selectedCategories.add(catId);
      state.searchQuery = "";
      els.searchInput.value = "";
      els.clearSearchBtn.classList.add("hidden");
      els.searchKbd.classList.remove("hidden");
      els.categorySuggestion.classList.add("hidden");
      syncCategoriesUI();
      loadCatalog(true);
    }
  });

  // Search Input with Debounce + Enter key + Smart Category Detection
  els.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    els.clearSearchBtn.classList.toggle("hidden", !state.searchQuery);
    els.searchKbd.classList.toggle("hidden", Boolean(state.searchQuery));
    state.showingWatchlist = false;
    els.watchlistToggleBtn.classList.remove("active");

    detectCategoryFromQuery(state.searchQuery);

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      loadCatalog(true);
    }, 280);
  });

  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(searchDebounceTimer);
      state.searchQuery = els.searchInput.value;
      loadCatalog(true);
    }
  });

  els.clearSearchBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    state.searchQuery = "";
    els.clearSearchBtn.classList.add("hidden");
    els.searchKbd.classList.remove("hidden");
    els.categorySuggestion.classList.add("hidden");
    loadCatalog(true);
  });

  // Active Filter Chips Removal
  els.activeFiltersBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clear-type]");
    if (!btn) return;
    const type = btn.dataset.clearType;
    const val = btn.dataset.val;
    if (type === "query") {
      state.searchQuery = "";
      els.searchInput.value = "";
      els.clearSearchBtn.classList.add("hidden");
      els.searchKbd.classList.remove("hidden");
    } else if (type === "category") {
      state.selectedCategories.delete(val);
      syncCategoriesUI();
    } else if (type === "provider") {
      state.selectedProviders.delete(val);
      localStorage.setItem("streampulse_providers", JSON.stringify(Array.from(state.selectedProviders)));
      renderProvidersRail();
    } else if (type === "era") {
      state.eraRange = "";
      els.eraSelect.value = "";
    } else if (type === "all") {
      state.searchQuery = "";
      els.searchInput.value = "";
      els.clearSearchBtn.classList.add("hidden");
      state.selectedCategories.clear();
      state.selectedProviders.clear();
      localStorage.setItem("streampulse_providers", "[]");
      state.eraRange = "";
      els.eraSelect.value = "";
      syncCategoriesUI();
      renderProvidersRail();
    }
    loadCatalog(true);
  });

  // Keyboard shortcuts ('/' to focus search, 'Escape' to close modals)
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== els.searchInput && document.activeElement !== els.tmdbKeyInput) {
      e.preventDefault();
      els.searchInput.focus();
    } else if (e.key === "Escape") {
      els.detailModal.classList.add("hidden");
      els.tmdbModal.classList.add("hidden");
      els.categorySuggestion.classList.add("hidden");
    }
  });

  // Provider Chips Click
  els.providersRail.addEventListener("click", (e) => {
    const chip = e.target.closest(".provider-chip");
    if (!chip) return;
    const shortName = chip.dataset.short;
    if (state.selectedProviders.has(shortName)) {
      state.selectedProviders.delete(shortName);
    } else {
      state.selectedProviders.add(shortName);
    }
    localStorage.setItem("streampulse_providers", JSON.stringify(Array.from(state.selectedProviders)));
    state.showingWatchlist = false;
    els.watchlistToggleBtn.classList.remove("active");
    renderProvidersRail();
    loadCatalog(true);
  });

  els.selectAllSubBtn.addEventListener("click", () => {
    state.selectedProviders.clear();
    localStorage.setItem("streampulse_providers", "[]");
    renderProvidersRail();
    loadCatalog(true);
  });

  // Media Type Segmented Control
  els.mediaTypeControl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    els.mediaTypeControl.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.mediaType = btn.dataset.type;
    loadCatalog(true);
  });

  // Monetization Segmented Control
  els.monetizationControl.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    els.monetizationControl.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.monetization = btn.dataset.monetization;
    loadCatalog(true);
  });

  // Sort Select
  els.sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    loadCatalog(true);
  });

  // Release Era Select
  els.eraSelect.addEventListener("change", (e) => {
    state.eraRange = e.target.value;
    loadCatalog(true);
  });

  // Load More
  els.loadMoreBtn.addEventListener("click", () => {
    loadCatalog(false);
  });

  // Card Interactions (Detail & Bookmark)
  els.titlesGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".title-card");
    if (!card) return;
    const id = card.dataset.id;
    const tmdbId = card.dataset.tmdb;
    const mediaType = card.dataset.type;

    if (e.target.closest("[data-action='bookmark']")) {
      const found = state.items.find((x) => x.id === id) || state.watchlist[id];
      if (found) toggleWatchlistItem(found);
      return;
    }

    if (e.target.closest("[data-action='detail']")) {
      openTitleDetail(id, tmdbId, mediaType);
    }
  });

  // Watchlist Toggle
  els.watchlistToggleBtn.addEventListener("click", () => {
    state.showingWatchlist = !state.showingWatchlist;
    els.watchlistToggleBtn.classList.toggle("active", state.showingWatchlist);
    loadCatalog(true);
  });

  // Brand Reset
  els.brandReset.addEventListener("click", () => {
    state.searchQuery = "";
    els.searchInput.value = "";
    els.clearSearchBtn.classList.add("hidden");
    state.selectedCategories.clear();
    state.eraRange = "";
    els.eraSelect.value = "";
    state.showingWatchlist = false;
    els.watchlistToggleBtn.classList.remove("active");
    syncCategoriesUI();
    loadCatalog(true);
  });

  // Modals Close
  els.closeDetailModalBtn.addEventListener("click", () => els.detailModal.classList.add("hidden"));
  els.detailModal.addEventListener("click", (e) => {
    if (e.target === els.detailModal) els.detailModal.classList.add("hidden");
  });

  els.tmdbSettingsBtn.addEventListener("click", () => els.tmdbModal.classList.remove("hidden"));
  els.closeTmdbModalBtn.addEventListener("click", () => els.tmdbModal.classList.add("hidden"));
  els.tmdbModal.addEventListener("click", (e) => {
    if (e.target === els.tmdbModal) els.tmdbModal.classList.add("hidden");
  });

  // Save & Verify TMDB API Key
  els.tmdbKeyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const keyVal = els.tmdbKeyInput.value.trim();
    els.tmdbModalStatusBox.textContent = "Verifying TMDB API key...";
    let result = null;
    if (state.backendAvailable) {
      const resp = await fetch(`${state.apiBase}/api/settings/tmdb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: keyVal }),
      });
      result = await resp.json();
    } else {
      result = await verifyClientTmdbKey(keyVal);
      if (result.valid || !keyVal) {
        localStorage.setItem("streampulse_tmdb_key", keyVal);
      }
    }
    updateTmdbStatusUI(result);
    if (result.valid || !keyVal) {
      els.tmdbKeyInput.value = "";
      await loadProviders();
      await loadCatalog(true);
    }
  });

  // Mobile Bottom Navigation
  document.querySelectorAll(".mob-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mob-nav-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const nav = btn.dataset.nav;
      if (nav === "browse") {
        state.showingWatchlist = false;
        els.watchlistToggleBtn.classList.remove("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
        loadCatalog(true);
      } else if (nav === "categories") {
        els.categoriesRail.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (nav === "search") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        els.searchInput.focus();
      } else if (nav === "watchlist") {
        state.showingWatchlist = true;
        els.watchlistToggleBtn.classList.add("active");
        loadCatalog(true);
      } else if (nav === "settings") {
        els.tmdbModal.classList.remove("hidden");
      }
    });
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

document.addEventListener("DOMContentLoaded", initApp);
