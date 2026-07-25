# Project Instructions

## Project
We are building an AI-powered marketplace for vocalists and music producers.

The core idea:
- Vocalists create profiles and upload voice samples.
- Producers upload a vocal reference or describe the desired voice.
- The site shows matching vocalists.
- At the MVP stage, matching on `/results` uses mock data and tags.
- Real AI voice matching runs in Admin Lab (`/admin/ai-voice-matching`) via Python API.

## Tech Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- React components
- **Supabase** — auth, profiles, vocalist requests, orders, reviews (live)
- File uploads API uses `SUPABASE_SECRET_KEY` in `.env.local` (server only)
- Mock/demo data for featured vocalists on `/home` and legacy matching UI
- Python voice-matching service (port 8000) for Admin Lab **and** producer `/search` → `/results`

## Development Rules
- Do not rewrite the whole project unless necessary.
- Prefer small, safe changes.
- Keep components clean and readable.
- Use dark modern music/AI style.
- Keep UI responsive.
- After each change, explain briefly what files were changed.
- If something is unclear, make a reasonable assumption and continue.

## Current MVP Pages
- / (landing)
- /signup, /login
- /home (explore + matching modes; featured vocalists are **demo** profiles)
- /search, /results, /compare/[id], /vocalists/[id]
- /request/[vocalistId], /my-requests (producer outgoing requests)
- /workspace, /workspace/[orderId]
- /dashboard, /saved-vocalists
- /vocalist/* (onboarding, orders, requests, demos, tags)
- /admin/* (admin login: admin/admin)
- /admin/ai-voice-matching (AI lab + Python API)

See **PROJECT_MEMO.md** and **HANDOFF_RU.md** for full route map.

## Product strategy
- **Differentiator:** acoustic AI vocal matching (user calibrates with real vocalists).
- **Matching philosophy:** do not build a voice model from scratch — combine specialists (embedding, pitch, timbre, style, recording quality) and own the **scoring / decision layer**. See **`docs/MATCHING_ENGINE_PHILOSOPHY.md`** and `voice-matching-service/matching_modules/`.
- Producer path `/search` → Python API → `/results` is **live lab** (not mock). Yes/No + pairwise duels calibrate ranking.
- **Without matching:** improve marketplace parity — see **`docs/COMPETITIVE_ANALYSIS.md`** (living doc; update status after sprints).
- Discovery: Match (primary) · Search by name · Browse later (not Home hero).

## Data layer (Supabase)
- Auth + `profiles` / `user_public_profile`
- `vocalist_profiles`, `vocalist_requests`, `orders`, `reviews`
- Producer order flow: Request → Accept → Workspace → Review (E2E tested)
- RLS: vocalist accept needs `vocalist_insert_order_on_accept` — see `docs/supabase_fix_orders_accept_rls.sql`
- Order files: `order_files` table + `order-files` bucket — see `docs/supabase_order_files_storage.sql` (run once in SQL Editor)

Still in **localStorage**: upload context (`voxbridge_upload_context`), admin role override, some admin UI prefs.

## Design Direction
- Dark theme
- Modern music platform
- AI/SaaS feeling
- Not corporate
- Not old marketplace style
- Clean cards, clear buttons, readable layout

## Important
The user does not want copy-paste code instructions.
When asked to implement something, edit the files directly.
