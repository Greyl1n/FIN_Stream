/**
 * StreamPulse Frontend Application (Desktop & Mobile PWA)
 * Powered by TMDB API v3 + JustWatch Direct-Link Catalog.
 * Works 100% live on GitHub Pages (client-side TMDB API) AND locally via `python app.py`.
 */

// Actively unregister any legacy service workers so stale caches never block updates
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      for (const reg of regs) {
        reg.unregister().catch(() => {});
      }
    })
    .catch(() => {});
}

const DEFAULT_TMDB_API_KEY = "596395204d6b71ecf4dda2988e7e4226";
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

const TMDB_ID_TO_JW_CODE = {
  28: "act",
  12: "act",
  10759: "act",
  16: "ani",
  35: "cmy",
  80: "crm",
  99: "doc",
  18: "drm",
  10751: "fml",
  14: "fnt",
  10765: "scf",
  36: "hst",
  27: "hrr",
  10402: "msc",
  9648: "trl",
  10749: "rma",
  878: "scf",
  53: "trl",
  10752: "war",
  10768: "war",
  10764: "rly",
  37: "wsn",
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
  423: "https://blockbuster.fi/search?q={q}",
  426: "https://www.sfanytime.com/fi/search?q={q}",
  35: "https://www.rakuten.tv/fi/search?q={q}",
  540: "https://elisaviihde.fi/haku?q={q}",
};

const state = {
  backendAvailable: false,
  apiBase: ".",
  staticSnapshot: window.STREAMPULSE_STATIC_DATA || null,
  clientTmdbKey: localStorage.getItem("streampulse_tmdb_key") || DEFAULT_TMDB_API_KEY,
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
  tmdbStatus: { configured: true, valid: true, message: "TMDB API Connected" },
  jwExactUrlIndex: {},
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

function buildJustWatchDirectLinkIndex() {
  if (!state.staticSnapshot || !state.staticSnapshot.catalog) return;
  const idx = {};
  for (const [countryCode, items] of Object.entries(state.staticSnapshot.catalog)) {
    for (const item of items || []) {
      if (item.tmdbId) {
        const key = `${countryCode}:${item.mediaType}:${item.tmdbId}`;
        idx[key] = item;
      }
    }
  }
  state.jwExactUrlIndex = idx;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 1000) {
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
  const isGitHubPages =
    host.endsWith(".github.io") ||
    host.endsWith(".pages.dev") ||
    host.endsWith(".netlify.app") ||
    host.endsWith(".vercel.app");
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
      const resp = await fetchWithTimeout(`${base}/api/config`, {}, 900);
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
  buildJustWatchDirectLinkIndex();
  updateWatchlistBadge();
  bindEvents();

  let config = await detectBackend();

  if (!config) {
    if (!state.staticSnapshot && window.STREAMPULSE_STATIC_DATA) {
      state.staticSnapshot = window.STREAMPULSE_STATIC_DATA;
      buildJustWatchDirectLinkIndex();
    }
    const tmdbStatus = await verifyClientTmdbKey(state.clientTmdbKey || DEFAULT_TMDB_API_KEY);
    config = {
      countries: (state.staticSnapshot && state.staticSnapshot.countries) || [
        { code: "FI", name: "Finland", flag: "🇫🇮" },
        { code: "US", name: "United States", flag: "🇺🇸" },
        { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
        { code: "SE", name: "Sweden", flag: "🇸🇪" },
        { code: "NO", name: "Norway", flag: "🇳🇴" },
        { code: "DK", name: "Denmark", flag: "🇩🇰" },
        { code: "DE", name: "Germany", flag: "🇩🇪" },
      ],
      categories: (state.staticSnapshot && state.staticSnapshot.categories) || [],
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
   Client-Side Live TMDB Engine (Powers GitHub Pages & Standalone index.html)
   ============================================================================ */
function buildTmdbFetchArgs(endpoint, extraParams = {}) {
  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  const headers = { Accept: "application/json" };
  const key = (state.clientTmdbKey || DEFAULT_TMDB_API_KEY).trim();
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
  state.clientTmdbKey = (candidateKey || DEFAULT_TMDB_API_KEY).trim();
  try {
    const { url, headers } = buildTmdbFetchArgs("/configuration");
    const resp = await fetch(url, { headers });
    if (resp.ok) {
      return {
        valid: true,
        configured: true,
        message: "Live TMDB API + Watch Providers active!",
        maskedKey: `${state.clientTmdbKey.slice(0, 4)}...${state.clientTmdbKey.slice(-4)}`,
      };
    }
    state.clientTmdbKey = prev;
    return { valid: false, configured: true, message: "Invalid TMDB API key." };
  } catch (err) {
    state.clientTmdbKey = prev;
    return { valid: false, configured: true, message: `Network error verifying TMDB key: ${err.message}` };
  }
}

function buildDirectProviderUrl(providerId, providerName, title, tmdbFallbackLink, tmdbId, mediaType) {
  // 1) Check if our JustWatch index has the exact direct URL for this (country, mediaType, tmdbId, providerId)
  if (tmdbId) {
    const jwItem = state.jwExactUrlIndex[`${state.country}:${mediaType}:${tmdbId}`];
    if (jwItem && jwItem.offers && jwItem.offers.all) {
      const exactOffer = jwItem.offers.all.find((o) => Number(o.providerId) === Number(providerId) && o.url);
      if (exactOffer) return exactOffer.url;
    }
  }

  // 2) Construct direct platform search/launch URL on that streaming service
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

function getSelectedProviderIdSet() {
  const idSet = new Set();
  for (const p of state.providers) {
    if (state.selectedProviders.has(p.shortName) || state.selectedProviders.has(String(p.id))) {
      idSet.add(Number(p.id));
    }
  }
  return idSet;
}

async function enrichTmdbRawItemClient(r, defaultType) {
  const mType = r.media_type || defaultType || "movie";
  const tmdbId = String(r.id);
  const title = r.title || r.name || "Untitled";
  const rel = r.release_date || r.first_air_date || "";
  const year = rel ? parseInt(rel.slice(0, 4), 10) : null;
  const genreIds = r.genre_ids || (r.genres ? r.genres.map((g) => g.id) : []);
  const genres = Array.from(new Set(genreIds.map((gid) => TMDB_ID_TO_GENRE_NAME[gid]).filter(Boolean)));
  const genreCodes = Array.from(new Set(genreIds.map((gid) => TMDB_ID_TO_JW_CODE[gid]).filter(Boolean)));

  // Check if we already have full JustWatch metadata in our snapshot index
  const cachedJw = state.jwExactUrlIndex[`${state.country}:${mType}:${tmdbId}`];

  let offersAll = [];
  try {
    const wpCall = buildTmdbFetchArgs(`/${mType}/${r.id}/watch/providers`);
    const wpResp = await fetch(wpCall.url, { headers: wpCall.headers });
    if (wpResp.ok) {
      const wpData = await wpResp.json();
      const regionData = (wpData.results || {})[state.country] || {};
      const fallbackLink = regionData.link || "";
      const seenProvCat = new Set();

      const mapGroup = (arr, mTypeLabel, catLabel) => {
        const out = [];
        for (const p of arr || []) {
          const dedupKey = `${p.provider_id}:${catLabel}`;
          if (seenProvCat.has(dedupKey)) continue;
          seenProvCat.add(dedupKey);
          const knownProv = state.providers.find((x) => Number(x.id) === Number(p.provider_id));
          out.push({
            providerId: p.provider_id,
            providerName: p.provider_name,
            providerShortName: knownProv ? knownProv.shortName : String(p.provider_id),
            icon: p.logo_path ? `${TMDB_IMAGE_BASE}/w92${p.logo_path}` : knownProv ? knownProv.icon : "",
            monetizationType: mTypeLabel,
            category: catLabel,
            quality: "HD",
            url: buildDirectProviderUrl(p.provider_id, p.provider_name, title, fallbackLink, tmdbId, mType),
          });
        }
        return out;
      };

      offersAll = [
        ...mapGroup(regionData.flatrate, "FLATRATE", "stream"),
        ...mapGroup(regionData.free, "FREE", "stream"),
        ...mapGroup(regionData.ads, "ADS", "stream"),
        ...mapGroup(regionData.rent, "RENT", "rent"),
        ...mapGroup(regionData.buy, "BUY", "buy"),
      ];
    }
  } catch (_e) {}

  if (!offersAll.length && cachedJw && cachedJw.offers) {
    offersAll = cachedJw.offers.all || [];
  }

  return {
    id: cachedJw ? cachedJw.id : `tmdb-${mType}-${tmdbId}`,
    tmdbId,
    mediaType: mType,
    title,
    year,
    overview: r.overview || (cachedJw && cachedJw.overview) || "",
    poster: r.poster_path
      ? `${TMDB_IMAGE_BASE}/w500${r.poster_path}`
      : cachedJw
      ? cachedJw.poster
      : null,
    backdrop: r.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w1280${r.backdrop_path}`
      : cachedJw
      ? cachedJw.backdrop
      : null,
    imdbScore: cachedJw ? cachedJw.imdbScore : null,
    tmdbScore: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
    genres: genres.length ? genres : (cachedJw && cachedJw.genres) || [],
    genreCodes: genreCodes.length ? genreCodes : (cachedJw && cachedJw.genreCodes) || [],
    offers: {
      all: offersAll,
      stream: offersAll.filter((o) => o.category === "stream"),
      rent: offersAll.filter((o) => o.category === "rent"),
      buy: offersAll.filter((o) => o.category === "buy"),
    },
  };
}

async function fetchClientTmdbCatalog(pageNum = 1) {
  const selectedIdSet = getSelectedProviderIdSet();
  const selectedIds = Array.from(selectedIdSet);
  const selectedCats = Array.from(state.selectedCategories);
  const q = state.searchQuery.trim();

  // CASE 1: User typed a search query (with optional Category, Platform, MediaType, or Era filters)
  if (q) {
    const endpoint =
      state.mediaType === "movie"
        ? "/search/movie"
        : state.mediaType === "tv"
        ? "/search/tv"
        : "/search/multi";

    // Fetch pages 1 and 2 in parallel so filtering by category or platform still yields plenty of matches
    const [r1, r2] = await Promise.all([
      fetch(buildTmdbFetchArgs(endpoint, { query: q, language: "en-US", page: pageNum }).url, {
        headers: buildTmdbFetchArgs(endpoint).headers,
      }),
      pageNum === 1
        ? fetch(buildTmdbFetchArgs(endpoint, { query: q, language: "en-US", page: 2 }).url, {
            headers: buildTmdbFetchArgs(endpoint).headers,
          })
        : Promise.resolve(null),
    ]);

    const d1 = r1 && r1.ok ? await r1.json() : { results: [], total_results: 0, total_pages: 1 };
    const d2 = r2 && r2.ok ? await r2.json() : { results: [] };
    const combinedRaw = [...(d1.results || []), ...(d2.results || [])].filter((r) => {
      const mt = r.media_type || (state.mediaType === "tv" ? "tv" : "movie");
      if (mt !== "movie" && mt !== "tv") return false;
      if (state.mediaType !== "all" && mt !== state.mediaType) return false;
      if (selectedCats.length > 0) {
        const gids = r.genre_ids || [];
        const itemCodes = gids.map((gid) => TMDB_ID_TO_JW_CODE[gid]).filter(Boolean);
        if (!selectedCats.some((c) => itemCodes.includes(c))) return false;
      }
      if (state.eraRange && state.eraRange.includes("-")) {
        const [yMin, yMax] = state.eraRange.split("-").map((n) => parseInt(n, 10));
        const rel = r.release_date || r.first_air_date || "";
        const yr = rel ? parseInt(rel.slice(0, 4), 10) : 0;
        if (yMin && yr < yMin) return false;
        if (yMax && yr > yMax) return false;
      }
      return true;
    });

    const enriched = await Promise.all(
      combinedRaw
        .slice(0, 24)
        .map((r) =>
          enrichTmdbRawItemClient(
            r,
            r.media_type || (state.mediaType === "tv" ? "tv" : "movie")
          )
        )
    );

    let finalItems = enriched;
    if (selectedIdSet.size > 0) {
      finalItems = enriched.filter((item) =>
        item.offers.all.some(
          (o) =>
            selectedIdSet.has(Number(o.providerId)) ||
            state.selectedProviders.has(o.providerShortName)
        )
      );
    }

    if (state.sortBy === "IMDB_SCORE") {
      finalItems.sort((a, b) => (b.imdbScore || b.tmdbScore || 0) - (a.imdbScore || a.tmdbScore || 0));
    } else if (state.sortBy === "RELEASE_YEAR") {
      finalItems.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    return {
      totalCount: finalItems.length,
      nextCursor: null,
      hasNextPage: false,
      items: finalItems,
    };
  }

  // CASE 2: Browsing Catalog by Category / Streaming Platform / Sort / Era
  const buildDiscoverParams = (targetType) => {
    const sortMap = {
      POPULAR: "popularity.desc",
      TRENDING: "popularity.desc",
      IMDB_SCORE: "vote_average.desc",
      RELEASE_YEAR:
        targetType === "movie" ? "primary_release_date.desc" : "first_air_date.desc",
      RANDOM: "popularity.desc",
    };
    const p = {
      watch_region: state.country,
      language: "en-US",
      page: pageNum,
      sort_by: sortMap[state.sortBy] || "popularity.desc",
    };
    if (state.sortBy === "IMDB_SCORE") p["vote_count.gte"] = 150;
    if (selectedIds.length) p.with_watch_providers = selectedIds.join("|");
    if (state.monetization === "stream") {
      p.with_watch_monetization_types = "flatrate|free|ads";
    } else {
      p.with_watch_monetization_types = "flatrate|free|ads|rent|buy";
    }
    if (selectedCats.length) {
      const gMap = targetType === "tv" ? JW_TO_TMDB_GENRE_TV : JW_TO_TMDB_GENRE_MOVIE;
      const gIds = Array.from(new Set(selectedCats.map((c) => gMap[c]).filter(Boolean)));
      if (gIds.length) p.with_genres = gIds.join(",");
    }
    if (state.eraRange && state.eraRange.includes("-")) {
      const [yMin, yMax] = state.eraRange.split("-");
      const kGte = targetType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
      const kLte = targetType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
      if (yMin) p[kGte] = `${yMin}-01-01`;
      if (yMax) p[kLte] = `${yMax}-12-31`;
    }
    return p;
  };

  let rawList = [];
  let totalResults = 0;
  let hasMore = false;

  if (state.mediaType === "all") {
    const mArgs = buildTmdbFetchArgs("/discover/movie", buildDiscoverParams("movie"));
    const tvArgs = buildTmdbFetchArgs("/discover/tv", buildDiscoverParams("tv"));
    const [mResp, tvResp] = await Promise.all([
      fetch(mArgs.url, { headers: mArgs.headers }),
      fetch(tvArgs.url, { headers: tvArgs.headers }),
    ]);
    const mData = mResp.ok ? await mResp.json() : { results: [], total_results: 0, total_pages: 1 };
    const tvData = tvResp.ok ? await tvResp.json() : { results: [], total_results: 0, total_pages: 1 };
    const mItems = (mData.results || []).slice(0, 12).map((x) => ({ ...x, media_type: "movie" }));
    const tvItems = (tvData.results || []).slice(0, 12).map((x) => ({ ...x, media_type: "tv" }));
    // Interleave movies and series
    const maxLen = Math.max(mItems.length, tvItems.length);
    for (let i = 0; i < maxLen; i++) {
      if (mItems[i]) rawList.push(mItems[i]);
      if (tvItems[i]) rawList.push(tvItems[i]);
    }
    totalResults = (mData.total_results || 0) + (tvData.total_results || 0);
    hasMore = pageNum < Math.max(mData.total_pages || 1, tvData.total_pages || 1);
  } else {
    const targetType = state.mediaType === "tv" ? "tv" : "movie";
    const dArgs = buildTmdbFetchArgs(`/discover/${targetType}`, buildDiscoverParams(targetType));
    const resp = await fetch(dArgs.url, { headers: dArgs.headers });
    const data = resp.ok ? await resp.json() : { results: [], total_results: 0, total_pages: 1 };
    rawList = (data.results || []).slice(0, 20).map((x) => ({ ...x, media_type: targetType }));
    totalResults = data.total_results || rawList.length;
    hasMore = pageNum < (data.total_pages || 1);
  }

  let items = await Promise.all(
    rawList.map((r) => enrichTmdbRawItemClient(r, r.media_type))
  );

  if (state.sortBy === "RANDOM") {
    items = [...items].sort(() => Math.random() - 0.5);
  }

  return {
    totalCount: totalResults,
    nextCursor: hasMore ? String(pageNum + 1) : null,
    hasNextPage: hasMore,
    items,
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
    els.tmdbModalStatusBox.innerHTML = `⚡ Paste a TMDB API Key below to connect.`;
  }
}

async function loadProviders() {
  els.providersRail.innerHTML = `<div style="color:var(--text-secondary);font-size:0.84rem;padding:6px;">Loading streaming platforms...</div>`;
  try {
    if (state.backendAvailable) {
      const resp = await fetch(`${state.apiBase}/api/providers?country=${encodeURIComponent(state.country)}`);
      const data = await resp.json();
      state.providers = data.providers || [];
    } else if (
      state.staticSnapshot &&
      state.staticSnapshot.providers &&
      state.staticSnapshot.providers[state.country]
    ) {
      // Use the rich provider list for FI / US (which has exact JustWatch shortNames AND TMDB IDs!)
      state.providers = state.staticSnapshot.providers[state.country];
    } else {
      // Fetch live regional providers from TMDB for any other country (SE, NO, DK, DE, GB, etc.)
      const { url, headers } = buildTmdbFetchArgs("/watch/providers/movie", { watch_region: state.country });
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      const raw = data.results || [];
      raw.sort((a, b) => {
        const pa = (a.display_priorities && a.display_priorities[state.country]) ?? a.display_priority ?? 999;
        const pb = (b.display_priorities && b.display_priorities[state.country]) ?? b.display_priority ?? 999;
        return pa - pb;
      });
      state.providers = raw.slice(0, 30).map((p) => ({
        id: p.provider_id,
        shortName: String(p.provider_id),
        name: p.provider_name,
        icon: p.logo_path ? `${TMDB_IMAGE_BASE}/w92${p.logo_path}` : "",
        isSubscription: true,
      }));
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
    } else {
      const pageNum = !reset && state.nextCursor ? parseInt(state.nextCursor, 10) : 1;
      data = await fetchClientTmdbCatalog(pageNum);
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
  const selectedIdSet = getSelectedProviderIdSet();
  if (selectedIdSet.size > 0 || state.selectedProviders.size > 0) {
    return [...allOffers].sort((a, b) => {
      const aSel =
        selectedIdSet.has(Number(a.providerId)) || state.selectedProviders.has(a.providerShortName)
          ? 0
          : 1;
      const bSel =
        selectedIdSet.has(Number(b.providerId)) || state.selectedProviders.has(b.providerShortName)
          ? 0
          : 1;
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
      if (tmdbId) {
        const { url, headers } = buildTmdbFetchArgs(`/${mediaType || "movie"}/${tmdbId}`, {
          append_to_response: "videos,credits",
        });
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const tData = await resp.json();
          d = {
            ...d,
            runtime: tData.runtime || (tData.episode_run_time && tData.episode_run_time[0]) || d.runtime,
            overview: tData.overview || d.overview,
          };
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
              ${d.tmdbScore ? `<span style="color:#38bdf8;font-weight:700;">• ★ ${d.tmdbScore} TMDB</span>` : ""}
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
    const keyVal = els.tmdbKeyInput.value.trim() || DEFAULT_TMDB_API_KEY;
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
      if (result.valid) {
        localStorage.setItem("streampulse_tmdb_key", keyVal);
      }
    }
    updateTmdbStatusUI(result);
    if (result.valid) {
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
