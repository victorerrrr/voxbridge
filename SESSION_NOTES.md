## SAVE POINT 25.07.2026 (Matching Engine philosophy + thin modules)

**Решение user:** вариант B — документ + аккуратно модули, без резкого rewrite.

### Зафиксировано
- `docs/MATCHING_ENGINE_PHILOSOPHY.md` — сливки research (больница специалистов, IP = scoring, три фильтра).
- `voice-matching-service/matching_modules/` — контракты, registry, scoring; `main.combine_scores` зовёт `assemble_match_score`.
- Реальный DSP по-прежнему в `main.py` — ничего не выбрасывали (feedback, pairwise, demos целы).

### Сделано без user (продолжение 25.07)
- На `/results`: счётчики **Да/Нет** + кнопка **Сбросить** по демо.
- API: `GET /feedback/demo/{filename}`, `POST /feedback/reset`, `POST /feedback/pairwise/reset`, `GET /matching/specialists`.
- «Чёткость» → **«Запись»** (качество записи ≠ плохой голос); вес quality в singing снижен до 2%.

### От user нужно
- Продолжать слушать / Да-Нет / дуэли.
- Говорить «ок» на следующий маленький шаг.
- Не обязательно трогать код самой.

### NEXT (только после ок)
- `profile_gender` vs timbre type в продукте.
- Подмена одного специалиста, когда найдём лучшую модель.

---

## SAVE POINT 12.07.2026 (перед перезагрузкой Mac)

**Ветка:** `home-rebuild-v2` (ahead origin на 1 коммит + много uncommitted).  
**Не коммитили** по запросу — всё лежит в рабочей копии на диске.

### После reboot — запуск

```bash
# Terminal 1 — сайт
cd /Users/galina/Desktop/Voxbridge && npm run dev

# Terminal 2 — Python matching
cd /Users/galina/Desktop/Voxbridge/voice-matching-service && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000
```

Сайт: `http://localhost:3000` · Matching: `/search` → `/results`  
Тест-аккаунт producer: **Tunares**

### Где файлы

| Что | Путь |
|-----|------|
| Живые демо для метчинга | `voice-matching-service/demos/` |
| AI-референсы (загрузки) | `voice-matching-service/ai_uploads/` |
| Да/Нет feedback | `voice-matching-service/feedback.json` |
| Парные сравнения A vs B | `voice-matching-service/pairwise_feedback.json` |
| Кэш фич демо | `voice-matching-service/demo_profiles/` |
| Калибровочные кейсы | `voice-matching-service/calibration_cases.json` |

AI уже в `ai_uploads/`: `Stay wm2n.mp3`, `Onde o Ritmo R.mp3`, `Tepliy vozduh. AI vocal.mp3`, `Оля, проми.wav`

### Что сделано в этой сессии (matching)

1. **Пол/язык/имя из имени файла** (`RU female …`, `EN male …`) — больше не «безымянные female» и мужчины не маскируются под female.
2. **Фильтр Female/Male** реально режет список (раньше был dead code после return).
3. **Калибровка на `/results`:** Да/Нет + панель «Ближе к AI / Дальше от AI» → `POST /feedback/pairwise`.
4. **Pairwise boost** в ranking (+5/−5 за победу/поражение, cap ±20), привязан к имени AI-файла.
5. **Demucs silent fallback:** если после Demucs тишина в первых 10с — retry на full mix (фикс для `Onde o Ritmo R`).
6. Понятные ошибки matching на `/search`.

### Калибровка уже сохранена

- **Stay wm2n.mp3** — 6 пар + Да/Нет по male демо (см. `pairwise_feedback.json` / `feedback.json`).
- **Tepliy vozduh** — earlier: Sofia good, Elena bad (в feedback).
- **Onde o Ritmo R** — матч падал на silent Demucs; после reboot перезапустить API и повторить матч с **оригинальным .mp3**.

### Протокол теста (не менять)

1. Один AI-вокал → Gender + Singing + Language **Any** → Match.  
2. Да/Нет на топ + спорные.  
3. 5–10 пар «кто ближе к AI».  
4. Следующий AI-файл → снова.

### User notes mid-session

- Хочет **подрезать длинные демо** в `demos/` (система и так берёт ~10с — важно, чтобы вокал был в начале).  
- После обрезки: то же имя файла + удалить соответствующий `demo_profiles/*.json`.  
- Стратегия: гибрид (ECAPA + human feedback + позже timbre-focus / pairwise ranker); готового «честного casting API» нет.

### NEXT после reboot

1. Запустить npm + uvicorn.  
2. Добить калибровку: `Onde o Ritmo R`, потом `Tepliy vozduh` ещё раз.  
3. Когда накопятся пары по 3–5 референсам — сверить feedback и подкрутить веса (timbre-focus mode).  
4. По запросу user — git commit (сейчас не коммитить).

В новый чат:
```
Прочитай SESSION_NOTES.md (SAVE POINT 12.07.2026) и AGENTS.md — продолжаем калибровку AI matching.
```

---

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
