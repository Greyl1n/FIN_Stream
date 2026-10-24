# StreamPulse — Universal Streaming Search & Inventory App

**StreamPulse** is a Desktop & Mobile Progressive Web App (PWA) that aggregates movie and TV series catalogs across streaming services (**Netflix, Disney+, Amazon Prime Video, Apple TV+, Max, Yle Areena, Ruutu, SkyShowtime, Viaplay**, and 40+ more) and opens the selected title directly inside the streaming platform.

---

## ✨ Key Features

- **Universal Cross-Platform Search:** Search any movie, TV series, or keyword across all major streaming services in your selected country (`FI`, `US`, `GB`, `SE`, `NO`, `DK`, `DE`, `FR`, `ES`, `CA`, `AU`, `NL`).
- **Search & Browse by Category:**
  - Select a category directly inside the search bar (`💥 Action & Adventure`, `🚀 Sci-Fi`, `😂 Comedy`, `🕵️ Mystery & Thriller`, `🎭 Drama`, `🚓 Crime`, `🔪 Horror`, `🎨 Animation`, `🌍 Documentary`, `🐉 Fantasy`, `❤️ Romance`, `👨‍👩‍👧 Kids & Family`, etc.) or combine **multiple category pills** at once.
  - Includes smart category keyword detection, release decade/era filtering, and sorting (`Most Popular`, `Trending Now`, `Highest Rated (IMDb)`, `Newest Releases`, `Surprise Me`).
- **Combined Platform Inventory Filter:** Toggle your subscribed streaming services (e.g., *Netflix + Disney+ + Yle Areena*) to browse only what is available on your platforms.
- **One-Click Direct Launch:** Clicking any streaming service badge on a title card (or inside the title details modal) launches the movie or series directly on that streaming platform.
- **Works Both on GitHub Pages (Static) & Local Python Server:**
  - **GitHub Pages Mode (Zero-Server):** Uses the root [`index.html`](./index.html) with a built-in catalog snapshot ([`static/fallback_catalog.json`](./static/fallback_catalog.json)) for instant zero-key browsing, plus **100% client-side TMDB API integration** directly in the browser when a user enters a free TMDB API key.
  - **Local Python FastAPI Mode:** Runs a live dual-engine backend ([`app.py`](./app.py)) combining **TMDB API** and **JustWatch GraphQL** in real time.

---

## 🌐 Why `app.py` Works Better Than Pure GitHub Pages (And How to Share Online)

When you run `python app.py` on your PC, the Python server queries JustWatch's live GraphQL API (`https://apis.justwatch.com/graphql`) from the backend.
- **Browser CORS Limitation on GitHub Pages:** JustWatch's server sets `Access-Control-Allow-Origin: https://www.justwatch.com`, which means web browsers block static websites (like `https://<username>.github.io`) from querying JustWatch's live GraphQL API directly from browser JavaScript.
- Because **GitHub Pages only serves static files and cannot run Python (`app.py`)**, you have **two ways** to get full live search + real streaming platform availability when sharing the app online:

### Option A (Best — Identical to `app.py`, Zero API Keys Needed): Deploy `app.py` Free on Render.com
This repository includes a [`render.yaml`](./render.yaml) blueprint so you can host the live Python `app.py` server for free:
1. Push this repository to GitHub.
2. Sign in to [render.com](https://render.com) (Free) with your GitHub account.
3. Click **New +** → **Web Service** → select your GitHub repository.
4. Render automatically detects `requirements.txt` and starts `uvicorn app:app --host 0.0.0.0 --port $PORT`.
5. You get a public URL (`https://your-app.onrender.com`) that runs `app.py` 24/7 with the exact same live search, categories, and direct streaming links as on your PC!

### Option B (Static GitHub Pages + Free TMDB API Key)
Unlike JustWatch, **TMDB's API (`https://api.themoviedb.org/3`) allows direct browser requests (`Access-Control-Allow-Origin: *`)**:
1. Host [`index.html`](./index.html) on GitHub Pages (**Settings** → **Pages** → **Deploy from branch `main` `/ (root)`**).
2. Open your GitHub Pages URL, click **Setup TMDB Key** in the top-right corner, and paste a free TMDB API Key from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).
3. With a TMDB key active, the browser queries TMDB's live `/search`, `/discover`, and `/watch/providers` endpoints directly from GitHub Pages!

### Updating the Static Catalog Snapshot (Optional)
To refresh the built-in zero-key snapshot ([`static/fallback_catalog.json`](./static/fallback_catalog.json)) before pushing to GitHub Pages, run:
```bash
python -c "import asyncio, json; from backend.streaming_client import StreamingInventoryClient, SUPPORTED_COUNTRIES, CATEGORIES_METADATA
async def main():
    c = StreamingInventoryClient()
    snap = {'countries': SUPPORTED_COUNTRIES, 'categories': CATEGORIES_METADATA, 'providers': {'FI': await c.get_providers('FI'), 'US': await c.get_providers('US')}, 'catalog': {'FI': (await c.browse_or_search_justwatch('FI', first=60))['items'], 'US': (await c.browse_or_search_justwatch('US', first=40))['items']}}
    await c.aclose()
    open('static/fallback_catalog.json', 'w', encoding='utf-8').write(json.dumps(snap, ensure_ascii=False))
asyncio.run(main())"
```

---

## 💻 Running Locally with Python (Full Live Dual-Engine)

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Start the server:**
   ```bash
   python app.py
   ```
3. **Open in your browser:**
   - Visit **http://127.0.0.1:8080** (the startup log prints the exact free port selected).

---

## 🔑 Getting a Free TMDB API Key

1. Sign up for a free account at [themoviedb.org/signup](https://www.themoviedb.org/signup).
2. Go to [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) and create a free **Developer** API key.
3. Click **Setup TMDB Key** in the top-right corner of StreamPulse, paste your **API Key (v3)** or **API Read Access Token (v4)**, and click **Verify & Save**.

---

## 📁 Project Structure

```text
Stream_app/
├── index.html                   # Root entry point (GitHub Pages & FastAPI)
├── manifest.json                # PWA manifest for Desktop/Mobile installation
├── sw.js                        # Service worker for offline caching
├── .nojekyll                    # Ensures GitHub Pages serves static assets directly
├── app.py                       # FastAPI backend server with automatic port selection
├── requirements.txt             # Python dependencies
├── backend/
│   └── streaming_client.py      # Dual-engine TMDB + JustWatch GraphQL async client
└── static/
    ├── styles.css               # Responsive dark-mode cinema UI styles
    ├── app.js                   # Hybrid frontend (FastAPI backend + GitHub Pages client-side mode)
    └── fallback_catalog.json    # Pre-loaded live catalog snapshot for GitHub Pages
```
