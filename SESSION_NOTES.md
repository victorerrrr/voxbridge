
## Session 19.06.2026
DONE: results page restored, voice tags added (1f93524), 4 orphan JSON deleted, 13/13 tests pass
BUG: voice tags not showing - check DevTools Network POST response, breathiness field
NEXT: DevTools check -> if breathiness=0 clear pycache and restart backend

## Session 19.06.2026 (вечер)
DONE: PUT /demo-language fixed (f118697) — case-insensitive listdir match instead of os.path.exists, always returns real on-disk filename. Verified live + no duplicate files. 14/14 tests pass.
NEXT: 1) verify git diff app/results/page.tsx (mt-10 margin committed?) 2) delete /tmp/main_backup.py if unneeded 3) Voice Style filter (Singing/Rap/Any) 4) admin lab radar chart font too small — increase scale (only lab version, /results version is fine)
