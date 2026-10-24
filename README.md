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

## 🚀 Deploying to GitHub Pages

The repository is structured with [`index.html`](./index.html), [`manifest.json`](./manifest.json), [`sw.js`](./sw.js), and [`.nojekyll`](./.nojekyll) in the **project root** so GitHub Pages can host it directly without a build step:

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: StreamPulse streaming search & catalog app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings** → **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, choose **`main`** and **`/ (root)`**, and click **Save**.
4. Your app will be live at `https://<your-username>.github.io/<your-repo>/`!
   - Visitors can immediately browse and filter the built-in catalog snapshot or click **Setup TMDB Key** in the top-right corner to enter a free TMDB API key for live client-side search across all regions.

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
