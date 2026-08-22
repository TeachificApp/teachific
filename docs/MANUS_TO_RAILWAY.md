# Manus → Railway: every GitHub-synced app

Manus already pushes source to GitHub. Railway should deploy **web apps from GitHub**, not from Manus. A **web** repo is not migrated until it boots, stores files, talks to a database, authenticates users, and calls an LLM **without** Manus Forge, Manus OAuth, or `*.manus.space`.

Electron desktop apps are a different class: they ship as Windows/Mac installers from GitHub Releases. They authenticate against the Teachific web API. They do **not** become Railway services.

Do one web app at a time. Finish cutover on that app before starting the next.

## Full GitHub inventory (TeachificApp)

This agent’s GitHub token can list **public** org repos only (`public_repos: 5`). Private repos return 404. The private Electron apps below are included from the org listing you shared; there may be more private repos this token cannot see.

### Web apps — these go to Railway

| GitHub repo | Visibility | Product | Last push | Railway files today | Still depends on Manus at runtime? | Treat as |
|---|---|---|---|---|---|---|
| [teachific](https://github.com/TeachificApp/teachific) | public | Teachific LMS (web) | 2026-08-13 | `Dockerfile`, `railway.toml`, data-copy scripts | Runtime now uses Railway MySQL, S3/R2, OpenAI, SendGrid, and Teachific auth. | **Canonical web — migrate first** |
| [ultrasound-app](https://github.com/TeachificApp/ultrasound-app) | public | UltrasoundAssist (web). Current repo. iHeartEcho / EchoAssist are built in. Package name is still `ultrasound-assist`. | 2026-08-13 | `nixpacks.toml`, `railway.toml`, `railway.json`, `RAILWAY_DEPLOY.md` | **Yes.** Storage and LLM still require Forge. | **Canonical UltrasoundAssist — migrate** |
| [teachificapp](https://github.com/TeachificApp/teachificapp) | public | Older Teachific snapshot | 2026-06-23 | `Dockerfile`, `railway.toml` | Same Manus coupling as old Teachific | Likely **archive** after confirming no unique domain/data |

`teachificapp` still gets a Railway project if it has a live Manus URL or a database anyone still uses. Otherwise archive it after Teachific is live.

### Ignore — do not migrate

iHeartEcho and EchoAssist are no longer separate products. They live inside **ultrasound-app**. The old `ultrasound-assist` GitHub repo is not the current source.

| GitHub repo / name | Why skip |
|---|---|
| [ultrasound-assist](https://github.com/TeachificApp/ultrasound-assist) | Old UltrasoundAssist snapshot — superseded by `ultrasound-app` |
| [echo-assist](https://github.com/TeachificApp/echo-assist) | iHeartEcho — folded into `ultrasound-app` |
| echoassist (any leftover Manus/GitHub name) | Same — folded into `ultrasound-app` |

Leave those GitHub repos as-is (or archive later). Do not copy their databases onto Railway as standalone apps.

### Electron desktop apps — these do **not** go to Railway

These are private installer products. Login, billing, downloads, and `app_versions` already live in the **teachific** web app (`/creator`, `/studio`, `/quiz-creator-app` dashboards). Moving Teachific to Railway is what those apps need.

| GitHub repo | Visibility | Product | What “moved off Manus” means |
|---|---|---|---|
| [quizcreator-desktop](https://github.com/TeachificApp/quizcreator-desktop) | private | Teachific QuizCreator™ (Electron) | Keep GitHub Actions → `.exe` / `.dmg` releases. Point the app at the Railway Teachific API (`VITE_APP_URL` / API base). Do not create a Railway web service for the Electron process. |
| [studio-desktop](https://github.com/TeachificApp/studio-desktop) | private | Teachific Studio™ (Electron) | Same: GitHub Releases + Teachific API on Railway. |
| [creator-desktop](https://github.com/TeachificApp/creator-desktop) | private | TeachificCreator™ (Electron) | Same: GitHub Releases + Teachific API on Railway. |

Older notes in `todo.md` also mention `teachific-quizcreator-desktop`, `teachific-studio-desktop`, `teachific-creator-desktop`, and a combined `teachific-desktop-apps` repo. If those still exist, treat them as rename leftovers: confirm they match the three private repos above, then archive duplicates.

If a desktop app currently calls Manus Forge for AI/storage, change it to the Teachific Railway API (or OpenAI/R2) the same way the web apps do. That is a code change in the Electron repo, not a Railway deploy of Electron.

## What “moved to Railway” means

| Concern | Manus today | Railway target |
|---|---|---|
| Source | Manus editor → GitHub | GitHub `main` is the deploy source |
| Compute | Manus `*.manus.space` | One Railway **project per GitHub repo** |
| Database | Manus TiDB (`gateway*.tidbcloud.com`) | Railway MySQL (`DATABASE_URL`) |
| Files | Forge `v1/storage/*` / `files.manuscdn.com` | Cloudflare R2 or AWS S3 |
| LLM | Forge `gemini-2.5-flash` | `OPENAI_API_KEY` (Teachific already switches) |
| Auth | Manus OAuth (`api.manus.im`) | Built-in email/password (already in teachific and UltrasoundAssist) |
| Payments / email | Stripe + SendGrid | Same keys; **webhook URLs** must change |

Hosting on Railway while still calling Forge is not a migration. `ultrasound-app`’s current `RAILWAY_DEPLOY.md` still lists Forge and Manus OAuth as required — that is the gap to close.

## Shared Railway layout

Use **one Railway workspace**, then **one project per web app**:

```
Railway workspace
├── teachific         → GitHub TeachificApp/teachific       + MySQL
├── ultrasound-app    → GitHub TeachificApp/ultrasound-app  + MySQL
│                       (UltrasoundAssist; iHeartEcho is inside this app)
└── teachificapp      → only if still serving users

Ignore (do not deploy):
├── ultrasound-assist   (old snapshot)
├── echo-assist / echoassist / iHeartEcho

Not Railway services (GitHub Releases only):
├── quizcreator-desktop
├── studio-desktop
└── creator-desktop
```

Do not put unrelated apps in one Railway project as multiple services. They have different domains, databases, Stripe webhooks, and secrets.

Shared accounts (Stripe, SendGrid, OpenAI, Cloudflare R2) can be reused. Give each app its **own MySQL** and its **own R2/S3 prefix or bucket**.

## Repeatable process (every repo)

### 0. Confirm the live Manus URL and GitHub repo

For each app, write down:

- Manus URL (`*.manus.space` / `*.manus.computer`)
- GitHub repo
- Custom domain that should end up on Railway
- Whether email/password login already works
- Whether the GitHub repo is the latest Manus export (if Manus still has unpushed work, push it first)

### 1. Make GitHub `main` boot on Railway without Forge

In the GitHub repo (not in Manus):

1. Keep **one** Railway config. Prefer `railway.toml`. Delete duplicate `railway.json` if both exist (`ultrasound-app` has both).
2. Build with Nixpacks **or** Docker, not both. Current split:
   - `teachific` / `teachificapp`: Docker
   - `ultrasound-app`: Nixpacks
3. Production must:
   - Read `process.env.PORT` and bind `0.0.0.0`
   - Expose `GET /api/health` (or change `healthcheckPath` to a route that exists — `ultrasound-app` currently health-checks `/api/trpc`, which is a poor liveness probe)
   - Run `pnpm build` then `node dist/index.js` (or `pnpm start`)
4. Storage must succeed when Forge env vars are **unset**:
   - Teachific: AWS S3 or Cloudflare R2 when the S3-compatible storage variables in `.env.railway.example` are set
   - Echo-assist: R2 when `R2_ENDPOINT` is set
   - **UltrasoundAssist still throws if Forge is missing** — copy Teachific’s S3 switch (or the R2 dual-backend pattern) before cutover
5. AI must succeed when Forge is unset (`OPENAI_API_KEY` for LLM, image generation, TTS, and transcription). Port Teachific `server/_core/llm.ts` into `ultrasound-app` if it still only calls Forge.
6. Auth: confirm email/password works with `JWT_SECRET`. Manus OAuth is not used by Teachific runtime.
7. Vite `VITE_*` values are baked in at **build** time. Pass them as Railway build args / variables. Do not rely on a committed `.env.production` that still points at Forge.

### 2. Create the Railway project (staging)

In [railway.app](https://railway.app):

1. **New Project → Deploy from GitHub repo** → that app’s repository.
2. **+ New → Database → MySQL**. Railway injects `DATABASE_URL`.
3. Set variables (see checklists below). Do **not** attach the custom domain yet.
4. Wait for a green deploy on the Railway `*.up.railway.app` URL.
5. Run schema on the new database:

   ```bash
   # from a laptop with mysql client, using Railway's TCP proxy
   for f in drizzle/*.sql; do mysql "$DATABASE_URL" < "$f"; done
   ```

   Or `pnpm db:push` only if you accept Drizzle generating against the empty Railway DB.

### 3. Copy data and files (Manus still primary)

Keep Manus live. Copy **to** Railway.

**Database (TiDB → Railway MySQL)**

```bash
# Example: this repo's script, driven by env vars (no secrets in git)
export SOURCE_DB_HOST=... SOURCE_DB_PORT=4000 SOURCE_DB_USER=... SOURCE_DB_PASS=... SOURCE_DB_NAME=...
export RAILWAY_DB_HOST=... RAILWAY_DB_PORT=... RAILWAY_DB_USER=... RAILWAY_DB_PASS=... RAILWAY_DB_NAME=railway
pnpm transfer:db
```

`scripts/migrate-to-railway.mjs` **drops Railway tables** before copy. Only run it against the new Railway database.

**Files**

- List objects from Manus storage (Forge download URLs, or Manus S3 if you have keys).
- Upload into that app’s R2/S3 bucket with the **same keys** the database already stores.
- If rows contain `files.manuscdn.com` or `api.manus.im/v1/storage` URLs, rewrite them to the R2/S3 public URL after copy.

```bash
export SOURCE_S3_BUCKET=teachific
export SOURCE_AWS_ACCESS_KEY_ID=...
export SOURCE_AWS_SECRET_ACCESS_KEY=...
export SOURCE_AWS_REGION=us-east-1

export CF_R2_ACCOUNT_ID=...
export CF_R2_BUCKET_NAME=teachific
export CF_R2_ACCESS_KEY_ID=...
export CF_R2_SECRET_ACCESS_KEY=...
export CF_R2_PUBLIC_URL=https://files.example.com

pnpm transfer:files
```

Then rewrite old URL bases in the Railway database:

```bash
export DATABASE_URL='mysql://...railway...'
export OLD_STORAGE_BASE_URL='https://old-file-domain.example'
export NEW_STORAGE_BASE_URL="$CF_R2_PUBLIC_URL"
DRY_RUN=1 pnpm transfer:rewrite-urls
pnpm transfer:rewrite-urls
```

Other apps need the same idea pointed at their source and destination buckets.

### 4. Smoke-test on the Railway URL

Do not touch DNS until all of these pass on `*.up.railway.app`:

- [ ] `/api/health` returns 200
- [ ] Homepage / app shell loads (no Manus runtime overlay)
- [ ] Email signup + login
- [ ] File upload and playback (SCORM / images / videos as applicable)
- [ ] Stripe test checkout (update the webhook to the Railway URL first)
- [ ] Transactional email
- [ ] One AI feature (course generator, report builder, etc.)

### 5. Cut over DNS and webhooks

1. Freeze writes on Manus if you can (maintenance window).
2. Run the DB + file copy **one last time**.
3. Point Stripe / SendGrid / Thinkific webhooks at the custom domain (or the Railway URL if DNS is not ready).
4. In Railway: **Settings → Networking → Custom Domain**.
5. At the DNS host, CNAME (and wildcard if the app uses org subdomains) to the Railway target.
6. Confirm TLS, then keep Manus up for a few days as read-only fallback.
7. When Railway has been clean, delete or pause the Manus deployment.

### 6. After cutover

- Remove `BUILT_IN_FORGE_*`, `OAUTH_SERVER_URL`, and old `VITE_OAUTH_PORTAL_URL` values from Railway; Teachific runtime no longer reads them.
- Stop committing `.manus/db` query dumps and `.env.production` Forge keys.
- Rotate any secret that was ever committed to GitHub (`replication-config.json` in this repo historically contained live DB passwords).

## Suggested order

1. **teachific** (web) — furthest along; desktop apps and download hubs depend on this API.
2. **ultrasound-app** (UltrasoundAssist web) — current repo. Includes iHeartEcho. Add R2/S3 + OpenAI fallbacks, then deploy (`app.allaboutultrasound.com`).
3. **teachificapp** — deploy only if it still has users; otherwise archive.
4. **quizcreator-desktop / studio-desktop / creator-desktop** — after Teachific is on Railway, point each Electron app at the new API URL and ship a release. No Railway project.

Skip **ultrasound-assist** (old snapshot), **echo-assist**, EchoAssist, and iHeartEcho as their own Railway projects.

## Per-app variable checklists

Shared on every app:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Injected by Railway MySQL |
| `JWT_SECRET` | `openssl rand -hex 64` |
| `NODE_ENV` | `production` |
| `PORT` | Set by Railway; do not hardcode |

**teachific** — see `.env.railway.example`. Required extras: `AWS_*` **or** `CF_R2_*`, `OPENAI_API_KEY`, Stripe, SendGrid.

**ultrasound-app** (UltrasoundAssist) — see that repo’s `RAILWAY_DEPLOY.md`, but **replace** the Forge block with:

| Variable | Purpose |
|---|---|
| `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | Files without Forge |
| `OPENAI_API_KEY` | LLM without Forge |
| `VITE_APP_URL` | `https://app.allaboutultrasound.com` |
| Stripe, SendGrid, Thinkific, BookVault, Printful, Shopify | Copy from Manus env; do not skip |

Also add `/api/health` and point `healthcheckPath` at it.

Capacitor/mobile, if still used, is a separate store pipeline. Railway only hosts the web API/app. Do not deploy `echo-assist` or the old `ultrasound-assist` repo separately.

## ultrasound-app code gap (must land before its Railway cutover)

`server/storage.ts` currently requires `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`. Use Teachific’s S3 switch or this R2 pattern:

```ts
function useR2(): boolean {
  return !!(ENV.r2Endpoint && ENV.r2AccessKeyId && ENV.r2SecretAccessKey);
}
```

Add the matching `r2*` fields to `server/_core/env.ts`. In `storagePut` / `storageGet`, call R2 when `useR2()` is true.

For LLM, port Teachific’s `isOpenAIConfigured()` branch in `server/_core/llm.ts` so `OPENAI_API_KEY` is used when Forge is absent.

This agent can only open PRs on `TeachificApp/teachific`. Apply those storage/LLM patches in the other repos (or add those repos to this Cursor environment) before their Railway projects go live.

## What this agent cannot do from the teachific checkout

- Create Railway projects or set Railway variables (needs a Railway account token).
- List or push **private** org repos (`quizcreator-desktop`, `studio-desktop`, `creator-desktop`, and any others). This token sees only the five public repos.
- Push branches to the other in-scope web repos (`ultrasound-app`, `teachificapp`). `ultrasound-assist` and `echo-assist` are out of scope.
- Dump a live Manus TiDB or copy production files without those credentials in the environment.

Once a Railway API token and org-wide GitHub access are available, the web-app loop is: connect repo → MySQL → variables → migrate data → smoke test → DNS. Desktop apps then get a new release aimed at the Railway Teachific URL.

## Teachific-specific runbook

After this repo’s Railway service exists:

1. Confirm `railway.toml` + `Dockerfile` build on the connected GitHub branch.
2. Apply `drizzle/*.sql` in order on Railway MySQL.
3. Copy Manus TiDB → Railway with `node scripts/migrate-to-railway.mjs`.
4. Copy files to S3/R2.
5. Point `teachific.app` / `www` / `*.teachific.app` at Railway (see `DEPLOYMENT.md` steps 7–8).
6. Update Stripe webhook to `https://teachific.app/api/stripe/webhook`.
