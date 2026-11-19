# OPEN ATLAS — Global Freedom Wall 🌍

A cinematic interactive freedom wall where people leave public thoughts on a world map.

## Features

- Real 3D, slowly rotating globe on the first screen (MapLibre GL JS)
- Moving cloud-cover transition into a draggable, zoomable world map
- Click anywhere on the map to choose a location; country detection from bundled simplified map polygons
- Username card before posting (no signup form)
- Choose your country, category and message; approximate map pins for privacy
- Live public posts, individual message views, replies, heart reactions and report buttons
- Country search, text search, newest/most-loved sorting
- 232 country options, 172 simplified shapes, responsive phone/tablet/desktop layout
- Supabase Postgres, RLS, anonymous authentication, basic server-side post rate-limit and realtime updates
- **Zero-configuration demo mode** with clearly labeled fictional example posts; your demo posts remain on your browser only
- GitHub Actions deployment workflow included

## 1. Run in VS Code (Windows PowerShell)

**Requirements:** VS Code, Node.js **22.12+** (recommended latest Node 22 LTS or newer), internet for npm packages and public map tiles. **Do not open `index.html` directly**—Vite is needed.

1. Extract the downloaded ZIP.
2. In VS Code choose **File > Open Folder** and open `Open_Atlas_Freedom_Wall` (the folder containing `package.json`).
3. Open **Terminal > New Terminal** and run:

```powershell
npm install
npm run dev
```

4. Open the local URL printed by Vite, usually **http://localhost:5173/**.
5. Alternatively, Windows users can double-click `START_WINDOWS.bat` after extracting.
6. Click **Enter the world**. You can explore, open sample posts and add demo messages immediately.

**If `npm` is not recognized:** install Node.js from https://nodejs.org/ and restart VS Code.

## 2. Enable real public posts and replies (Supabase)

Demo mode **does not** share messages between devices. You must connect a Supabase database for public comments.

1. Create a Supabase project at https://supabase.com/dashboard .
2. Open **SQL Editor**, create a query, paste the entire `supabase/schema.sql`, then click **Run**. This creates the tables, triggers, RLS, permissions, and realtime publication.
3. In **Authentication > Providers**, enable **Anonymous Sign-Ins** (required: usernames are display names, not authentication credentials).
4. Open **Project Settings > API Keys** (or **Connect**, depending on dashboard version). Get your **Project URL** and **publishable key** (older projects may call it `anon` key).
5. Duplicate `.env.example` as `.env` in the project root and add:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

6. Restart `npm run dev`. The app will display **LIVE WORLD** instead of **DEMO MODE**. A username is saved in the visitor's browser; Supabase quietly makes an anonymous authenticated guest session on their first write.
7. Verify with two different browsers or devices. A post created on one should be readable on the other; replies and hearts are shared.

**NEVER put a `service_role` key, database password, or Supabase secret key into `.env`, GitHub Actions variables, or client-side code.** The publishable/anon key is deliberately public and relies on the included database RLS policies. Keep `.env` out of git (already included in `.gitignore`).

## 3. Publish to GitHub Pages with the included workflow

> Unlike a plain HTML project, this React/TypeScript project must be **built**. The included `.github/workflows/deploy.yml` automatically builds it on every push.

1. Create a **public** GitHub repository, for example `open-atlas`.
2. In the VS Code terminal, from the folder containing `package.json`:

```powershell
git init
git add .
git commit -m "Launch Open Atlas Freedom Wall"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/open-atlas.git
git push -u origin main
```

3. GitHub repository **Settings > Pages > Build and deployment > Source > GitHub Actions** (not "Deploy from a branch").
4. If using Supabase, open **Settings > Secrets and variables > Actions > Variables**. Create both *repository variables*:
   - `VITE_SUPABASE_URL` = your project's URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your public publishable/anon key
5. Open **Actions** and check the **Deploy Open Atlas to GitHub Pages** workflow. When it succeeds, use the Pages link in Settings > Pages.
6. Your site will generally be: `https://YOUR_USERNAME.github.io/open-atlas/`.

Because `vite.config.ts` uses `base: './'`, your repo can have any name.

To publish later updates:

```powershell
git add .
git commit -m "Update Open Atlas"
git push
```

## 4. How visitors use the site

- Click **Enter the world** to watch clouds sweep over the globe, revealing the map.
- Click **Leave a message**, the green **+** button, or an open location on the world map.
- First-time writers pick a display name. This name is stored locally and can be changed via the top profile button.
- Select a country and emotion type, write 2–650 characters, then publish.
- Click a glowing pin or message card to read, heart, reply, or report a message.
- Visitors can select countries without sharing GPS location, and the app deliberately coarsens clicked coordinates.

## 5. Moderation and limits (read before opening this publicly)

- The example/sample posts are *fictional* and used only in **DEMO MODE**. A demo post is saved **only in that browser's localStorage**; other visitors won't see it.
- Public messages are visible to **anyone**, and usernames aren't verified. Avoid sensitive/confidential information.
- **Location is manually selected**, not automatically tracked. Country-level/rounded pins are illustrative and not reliable proof of origin; a user can choose any country.
- Supabase Row Level Security allows public reading of visible posts, but requires a valid anonymous guest session for posting, likes, and reports. Clients cannot change `hidden` or `reaction_count` directly.
- The SQL trigger permits up to **3 posts per minute per guest account**. This is not a strong defense against people creating many sessions. Before a larger public launch, enable CAPTCHA, add server-side abuse detection/rate limits, and maintain active moderators.
- Reports are recorded in `post_reports`. Review these manually in Supabase. To hide a reported post, edit `posts.hidden` to `true` using the Supabase Table Editor. There is **no built-in administrator dashboard or automatic moderation**.
- The feed currently loads the **350 newest parent posts**, and each thread up to **100 replies**; it does not implement production-scale pagination or clustering. Add those for a much larger audience.
- The country shape data is simplified and incomplete for some islands and disputed areas; when automatic detection is missing, choose a country manually.
- Because guest identity is stored in the browser, clearing browser data means you may lose access to the same guest session. Existing public posts remain public.
- Fonts and OpenFreeMap background tiles load over the internet. Attribution is provided on the map.
- Default theme is midnight navy, seafoam, and soft coral. Edit `src/styles.css` to customize.

## Files

```text
Open_Atlas_Freedom_Wall/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── .env.example
├── .gitignore
├── .github/workflows/deploy.yml
├── public/
│   ├── favicon.svg
│   └── countries.geojson
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── components/GlobeMap.tsx
│   ├── components/Elements.tsx
│   ├── data/countries.ts
│   └── lib/data.ts, geography.ts
└── supabase/schema.sql
```

### Technology

React + TypeScript + Vite, MapLibre GL JS, OpenFreeMap, GSAP + CSS animations, Supabase JavaScript client. MapLibre's globe/mercator projections provide the smooth globe-to-map story; no Mapbox access token is required.

## Reference documentation

- https://vite.dev/guide/
- https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-a-vector-map/
- https://openfreemap.org/quick_start/
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/realtime/postgres-changes

This project is a starter, not a fully moderated large-scale social network. Enjoy building it, and keep the public space thoughtful.
