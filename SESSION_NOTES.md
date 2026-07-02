## Session 02.07.2026
DONE: E2E flow tested live (Tunares → Magdolina OlyaPromi): request → accept → workspace → preview → stems → review ★5 on profile. Fixed accept order producer_id bug, orders fetch without fragile joins, reviews → Supabase, workspace review modal portal + status hints, RLS SQL doc for orders accept.
NEXT: run reviews INSERT policy SQL in Supabase if not yet; commit pushed.

## Session 02.06.2026
DONE: полный handoff `HANDOFF_FULL_2026.md` (Supabase, voice matching v5, API, scoring, git, промпт для нового чата).
NEXT: закоммитить uncommitted diff (workspace, reviews, vocalist-profile-view); синхронизировать HANDOFF_RU.md / AGENTS.md с Supabase.

## Session 19.06.2026
DONE: results page restored, voice tags added (1f93524), 4 orphan JSON deleted, 13/13 tests pass
BUG: voice tags not showing - check DevTools Network POST response, breathiness field
NEXT: DevTools check -> if breathiness=0 clear pycache and restart backend

## Session 19.06.2026 (вечер)
DONE: PUT /demo-language fixed (f118697) — case-insensitive listdir match instead of os.path.exists, always returns real on-disk filename. Verified live + no duplicate files. 14/14 tests pass.
NEXT: 1) verify git diff app/results/page.tsx (mt-10 margin committed?) 2) delete /tmp/main_backup.py if unneeded 3) Voice Style filter (Singing/Rap/Any) 4) admin lab radar chart font too small — increase scale (only lab version, /results version is fine)

## Session 21.06.2026
DONE: cleanup - removed duplicate /demo-audio route (6e9bf4a), dead hnr var in vocal classification (a200677), deleted 5 stale demo_profiles JSON cache files from debug endpoint, removed __pycache__ from git tracking (ca19607)
TESTED: ML lang-id (speechbrain/lang-id-voxlingua107-ecapa, VoxLingua107, 107 langs incl. af/hi/es/en) on 8 active demos - raw audio 4/8 match, Demucs-isolated vocals 3/8 match. Confidence score does NOT correlate with correctness (e.g. Marcus: yo/Yoruba at 0.874 conf, wrong; Elena: es/Spanish at 0.150 conf, correct).
CONCLUSION: lang-id model trained on speech (YouTube), not singing - domain shift too large, Demucs vocal isolation doesn't fix it. Confidence threshold strategy won't work since confidence isn't calibrated for singing. NOT integrating into production. Manual language entry (PUT /demo-language) stays as-is.
NEXT (if revisited): only worth retrying if a lang-id model trained/fine-tuned specifically on singing becomes available. Don't re-test VoxLingua107/CommonLanguage as-is, already disproven on our 8 voices.
