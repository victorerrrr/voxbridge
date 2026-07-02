# HANDOFF FULL — VoxBridge (июнь 2026)

> **Назначение:** единый документ для переноса контекста в новый чат Cursor / другую машину.  
> **Дата сверки:** 2 июня 2026.  
> **Ветка:** `home-rebuild-v2` (tracking `origin/home-rebuild-v2`).

Скопируйте в новый чат:
```
Прочитай HANDOFF_FULL_2026.md, AGENTS.md и SESSION_NOTES.md — продолжаем VoxBridge с этого состояния.
```

---

## 1. Что такое VoxBridge

MVP маркетплейса: **продюсеры** загружают AI-вокал (Suno/Udio и т.п.) → получают ранжированный список **реальных вокалистов** по акустическому сходству. Вокалисты ведут профиль, демо, принимают запросы, работают в **workspace** (чат, превью, ревизии, сдача).

| Слой | Технология |
|------|------------|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Auth + данные | **Supabase** (Auth, PostgreSQL) — уже подключён в коде |
| AI matching | Python **FastAPI** `voice-matching-service/` (ECAPA, librosa, Demucs) |
| Дизайн | Тёмная тема, modern music / AI SaaS |

**Важно:** `AGENTS.md` и `HANDOFF_RU.md` частично устарели (ещё пишут «только localStorage»). Реальность на июнь 2026 — **Supabase для auth, профилей, заказов, запросов, отзывов**. Mock/localStorage остаётся для части UI (upload context, saved vocalists, admin stats и т.д.).

---

## 2. Быстрый запуск

### Next.js

```bash
cd /Users/galina/Desktop/Voxbridge
npm install
# Создать .env.local (не в git):
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
# NEXT_PUBLIC_VOICE_MATCH_API_URL=http://127.0.0.1:8000
npm run dev   # http://localhost:3000
```

### Python voice-matching

```bash
cd voice-matching-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --port 8000
```

### Проверка

| URL | Что |
|-----|-----|
| `http://127.0.0.1:8000/health` | `{"status":"ok"}` |
| `http://localhost:3000/admin/ai-voice-matching` | Admin AI Lab (login: `admin` / `admin`) |
| `http://localhost:3000/search` | Producer upload → real API → `/results` |

### Тесты Python

```bash
cd voice-matching-service && source .venv/bin/activate
pip install pytest
python3 -m pytest test_voxbridge.py -q
# SESSION_NOTES: последний прогон 14/14 pass (21.06.2026)
```

Sanity без аудио:
```bash
VOICE_MATCH_SCORING_SANITY=1 python3 main.py
```

---

## 3. Карта маршрутов (актуальное)

### Публичный producer flow (с реальным AI)

```
/ → /signup → /home → /search → POST /voice-match-producer → /results → /vocalists/[id] → workspace
```

- **`/search`** (`app/search/page.tsx`) — загрузка AI vocal, теги genre, gender override, языки → `fetch("http://localhost:8000/voice-match-producer")` → `sessionStorage.voxbridge_match_results` → `/results`.
- **`/results`** (`app/results/page.tsx`) — читает sessionStorage, показывает match %, voice tags, radar, кнопки Best Match / AI Vocal.

### Admin AI Lab (ручное тестирование)

- **`/admin/ai-voice-matching`** — загрузка AI + произвольные demo-файлы → POST `/voice-match` (не папка demos/).
- Компонент: `components/admin/ai-voice-matching-lab.tsx`
- Логика API: `lib/admin-ai-voice-matching.ts`

### Workspace / заказы

- `/workspace`, `/workspace/[orderId]` — совместная работа producer ↔ vocalist.
- Заказы: `lib/orders.ts` → Supabase `orders`.
- Запросы вокалисту: `lib/vocalist-requests.ts` → Supabase `vocalist_requests`.
- Отзывы: `lib/reviews.ts` → Supabase (есть **незакоммиченные** правки).

### Vocalist

- `/vocalist/onboarding`, `/vocalist/tags`, `/vocalist/demos`, `/vocalist/orders`, `/vocalist/requests/[requestId]`
- Профиль: `lib/vocalist-profile.ts` → Supabase `vocalist_profiles`, `vocalist_demos`, `users`.

### Admin

- Login: **`admin` / `admin`** → `/admin`
- AI Lab, users, orders, moderation и т.д.

Полная карта: `PROJECT_MEMO.md`, обзор для людей: `docs/VOXBRIDGE_BRIEFING.md`.

---

## 4. Supabase — что уже мигрировано

| Модуль | Файл | Таблицы / API |
|--------|------|----------------|
| Auth | `lib/auth.ts` | `supabase.auth`, `users` |
| Профиль вокалиста | `lib/vocalist-profile.ts` | `vocalist_profiles`, `vocalist_demos`, `users` |
| Заказы | `lib/orders.ts` | `orders` |
| Запросы | `lib/vocalist-requests.ts` | `vocalist_requests` |
| Отзывы | `lib/reviews.ts` | reviews (см. diff) |
| Клиент | `lib/supabase-client.ts` | требует `.env.local` |

**Последние коммиты (git log):**
- `4e8f6dc` — auth → Supabase
- `7a01406` — vocalist profile → Supabase
- `4b92ea1` — orders → Supabase
- `25cd677` — vocalist requests + fix request flow
- `05cef3b` — RLS fix via `user_public_profile` view; hide Request for demo vocalists

**Миграции SQL в репозитории нет** — схема живёт в Supabase dashboard. При переносе нужны credentials из `.env.local`.

**Что ещё на localStorage:** upload context (`lib/upload-context.ts`), saved vocalists, часть admin mock, старые ключи — см. таблицу в `PROJECT_MEMO.md`.

---

## 5. Voice Matching Service — архитектура

### Файлы

| Путь | Роль |
|------|------|
| `voice-matching-service/main.py` | ~4776 строк — весь pipeline |
| `voice-matching-service/README.md` | Подробная документация scoring (частично v4.x, код уже v5) |
| `voice-matching-service/demos/*.wav` | Демо для producer flow (`/voice-match-producer`) |
| `voice-matching-service/demos/tags.json` | Теги tonal/emotional/movement/density/gender/style |
| `voice-matching-service/test_voxbridge.py` | 14+ unit-тестов |
| `lib/admin-ai-voice-matching.ts` | TypeScript типы, FormData, маппинг ответа API |
| `components/admin/ai-voice-matching-lab.tsx` | UI лаборатории |

### API endpoints

| Method | Path | Назначение |
|--------|------|------------|
| GET | `/health` | Health check |
| POST | `/voice-match` | Admin Lab: AI + uploaded demos |
| POST | `/voice-match-producer` | Producer: AI vs все файлы в `demos/` |
| POST | `/voice-match-batch` | Batch matching |
| POST | `/precompute-demo` | Кэш embeddings в `demo_profiles/` |
| PUT | `/demo-language` | Ручная установка языка демо |
| POST | `/feedback` | Feedback boost для ранжирования |
| GET | `/demo-audio/{filename}` | Раздача демо |
| GET | `/ai-audio/{filename}` | Раздача последнего AI upload |

### Pipeline (кратко)

1. Декод → trim **10 s** mono 16 kHz.
2. **Demucs** на AI vocal (`USE_DEMUCS = True` на диске). Демо — trimmed mix (быстрее).
3. **ECAPA-TDNN** (SpeechBrain) — chunk averaging 5×2 s → `speaker_score_ecapa`.
4. Pitch / timbre / quality scores.
5. **`compute_vocal_character_features`** — breathiness, vibrato, vocal_weight, pitch_stability, articulation_speed, dynamic_range → `vocal_character_score`.
6. **`combine_scores`** — v5 веса + опционально genre weights из `query_tags`.
7. Vocal type classification (multi-feature, не только pitch).
8. v4.2 **cross-demo stretch** similarity (28–85 band).
9. **`final_ranking_score`** — сортировка (ниже).
10. `generate_match_explanation` — текст для UI.

### Scoring v5 (текущие веса в `main.py`)

```python
V4_WEIGHTS = {  # имя историческое, фактически v5
    "speaker": 0.15,
    "timbre": 0.42,
    "pitch": 0.30,
    "quality": 0.05,
    "vocal_character": 0.08,
}
```

**Genre overrides** (`_genre_weights` / `query_tags.genre`):
- `opera`, `classical` — больше pitch
- `rnb`, `soul` — больше timbre
- `rap`, `hip-hop` — больше speaker + timbre
- `singing` — явная ветка с базовыми v5 весами

**`final_ranking_score`** (сортировка, не то же что `similarity` в UI):

```
final_ranking_score =
  similarity
  − vocal_type_distance × 20
  − gender_mismatch_penalty (0 / 35 / 40)
  − gender_priority_tier_penalty (0 / 50)
  − max(0, 35 − pitch_score) × 1.2
  + tag_bonus (из tags.json × query_tags)
  + feedback_boost
```

Tie-break: tier ↑, timbre ↓.

**Tag bonus** (`_compute_tag_bonus`): tonal 35%, emotional 25%, movement 15%, density 5%, genre 15%; max ~20 pts per category overlap; +3 за style match.

### Классификация пола / AI reference

- **`classify_vocal_type_multi_feature`** — pitch MIDI + timbre (centroid, MFCC, low-band).
- **AI Suno/Udio fix:** если `high_pitched_male` и `pitch_avg > 55` → female.
- **Filename override:** `"AI vocal"`, `"теплый воздух"` → female.
- **Manual demo gender** (`MANUAL_DEMO_GENDER_SUBSTRINGS`):
  - `real vocal 1` → male, `2`/`4`/`5` → female, `3` → male
  - exact: `real_voice_1.wav` → male
- **`demo_display_names`** — JSON в multipart; manual gender по **оригинальному** имени файла (не `demo_0.wav`).
- **`gender_override`** form field — принудительный пол AI ref (`auto` / `female` / `male`) в Lab и search.
- **High-pitched male** — cosine vs prototype `real_voice_1.wav`.

### Язык

- `ai_language`, `part_language` в form-data.
- Penalty если язык демо не совпадает с `ai_language`.
- ML lang-id (VoxLingua107) **отклонён** — не работает на пении (SESSION_NOTES 21.06). Ручной `PUT /demo-language` остаётся.

### Кэш демо

- `_save_demo_profile` / `_load_demo_profile` — JSON в `demo_profiles/` (waveform, embeddings, pitch, timbre, vocal_character, language).

### Константы (шпаргалка)

| Константа | Значение |
|-----------|----------|
| `VOCAL_CLASSIFY_PITCH_HIGH_MIDI` | 55 |
| `VOCAL_TYPE_RANK_DISTANCE_WEIGHT` | 20 |
| `GENDER_MISMATCH_RANK_PENALTY` | 35 |
| `GENDER_MISMATCH_HARD_RANK_PENALTY` | 40 |
| `GENDER_PRIORITY_TIER_2_PENALTY` | 50 |
| `NORMALIZE_TARGET_TOP / BOTTOM` | 85 / 28 |
| `MIN_SIMILARITY_FLOOR` | 20 |

---

## 6. Frontend AI — что реализовано

### Admin Lab (`ai-voice-matching-lab.tsx`)

- Upload AI vocal + demos с `originalFileName`.
- **Voice Character** chips: tonal, emotional, movement, density → `query_tags`.
- **Voice Style** (genre): Singing / Rap / Any — обязателен genre для Run (guard в UI).
- **Gender override:** Авто / Женский / Мужской.
- **AI language** + **part language** selectors.
- POST на `NEXT_PUBLIC_VOICE_MATCH_API_URL/voice-match`.
- Timeout 120 s.

### Producer search + results

- Реальный API (не mock `lib/matching.ts`).
- Results: match %, confidence, voice character tags, radar chart, feature tags.
- `sessionStorage` ключ: `voxbridge_match_results`.

### `lib/admin-ai-voice-matching.ts`

- `buildVoiceMatchFormData(aiVocal, demos, queryTags, genderOverride, aiLanguage, partLanguage)`
- `mapVoiceMatchResultsFromApi`, radar chart helpers, confidence levels.
- Большой файл (~2500 строк) — типы + UI helpers.

---

## 7. История работ (по сессиям)

### Voice matching (основной блок работ)

1. **AI ref misclassified as male** — override для Suno/Udio female vocals (HPM + pitch > 55, filename rules).
2. **Manual demo gender** — substrings + `demo_display_names` + `original_filename` в ответе.
3. **Speaker weight experiments** — пробовали 60% speaker в rank; эксперимент «только spk+timbre» **откатили** (matchPercent упал до ~0.7%).
4. **Musical supplement speaker** — ECAPA + melodicity + MFCC + centroid (см. README; в v5 основной акцент сместился на timbre/pitch/vocal_character в `combine_scores`).
5. **Query tags** — UI + backend `_compute_tag_bonus` + genre weights.
6. **Vocal character features** — 8 признаков, `_vocal_character_similarity`, 8% в composite.
7. **Producer flow wired** — `/search` → `/voice-match-producer` → `/results`.
8. **Language** — manual PUT, penalty в rank; ML lang-id отвергнут.
9. **Feedback boost** — POST `/feedback` влияет на rank.

### Platform (git commits)

- Supabase auth, profiles, orders, requests.
- Docs: `VOXBRIDGE_BRIEFING.md`, `USER_GUIDE.md`, `ADMIN_PLAYBOOK.md`.
- Cleanup mock vocalists, RLS fixes, demo vocalist request button hidden.

### SESSION_NOTES.md (кратко)

- 19.06: results restored, voice tags, 13→14 tests; PUT /demo-language fix.
- 21.06: cleanup, lang-id tested and rejected for singing.

---

## 8. Известные проблемы и открытые задачи

| # | Проблема | Статус |
|---|----------|--------|
| 1 | Real vocal 5 иногда выше Real vocal 2 при лучшем speaker у #2 | `similarity` stretch + gender distance penalties доминируют; нужна калибровка rank strategy |
| 2 | `HANDOFF_RU.md`, `AGENTS.md`, `PROJECT_MEMO` — расхождение с Supabase | Обновить при следующей сессии |
| 3 | Voice tags на `/results` — проверить `breathiness` в Network response | SESSION_NOTES BUG |
| 4 | Admin lab radar chart — мелкий шрифт | TODO в SESSION_NOTES |
| 5 | Voice Style filter (Singing/Rap/Any) на search | частично в Lab, проверить search |
| 6 | `app/search` хардкод `localhost:8000` | лучше `NEXT_PUBLIC_VOICE_MATCH_API_URL` |
| 7 | Незакоммиченные изменения | см. §9 |
| 8 | `.env.local` не в git | нужен бэкап credentials отдельно |

**Не делать без запроса:** новый Supabase scope, Stripe, production deploy.

---

## 9. Git состояние (на 02.06.2026)

**Ветка:** `home-rebuild-v2`

**Незакоммиченные изменения:**
```
app/workspace/[orderId]/page.tsx
components/vocalist-profile-view.tsx
lib/admin.ts
lib/reviews.ts
```

Voice-matching файлы **закоммичены** в истории ветки (проверять `git log -- voice-matching-service/`).

---

## 10. Демо-файлы для тестов

Папка `voice-matching-service/demos/`:

| Файл | Примечание |
|------|------------|
| Real vocal 1 (м в аф).wav | male (manual) |
| Real vocal 2 girl.wav | female |
| Real vocal 3 boy.wav | male |
| Real vocal 4 girl high.wav | female |
| Real vocal 5 girl на одной ноте.wav | female, monotone — тест melodicity |
| Real vocal spanish/indian/african girl *.wav | языковые тесты |
| tags.json | теги для tag_bonus |

Типичный тест: female AI ref (`AI vocal` / Suno) vs Real vocal 2 vs 5 — смотреть `speaker_score`, `final_ranking_score`, `manual_gender`, `vocal_type_match` в JSON.

---

## 11. Другие документы

| Файл | Содержание |
|------|------------|
| `AGENTS.md` | Правила для AI-агентов (частично устарело) |
| `PROJECT_MEMO.md` | Карта routes + localStorage (Supabase — устарело в §данные) |
| `HANDOFF_RU.md` | Старый handoff (localStorage only) |
| `SESSION_NOTES.md` | Короткие заметки последних сессий |
| `docs/VOXBRIDGE_BRIEFING.md` | Обзор для команды |
| `docs/USER_GUIDE.md` | Публичный гайд |
| `docs/ADMIN_PLAYBOOK.md` | Внутренний admin гайд |
| `docs/АРХИТЕКТУРА_VOICE_MATCHING.md` | Архитектура matching (может отставать от v5) |
| `docs/ПРОГРЕСС_ПРОЕКТА.md` | ⚠️ устарело |
| `docs/ПЛАН_ДАЛЬШЕ.md` | ⚠️ устарело (май 2026) |
| `voice-matching-service/README.md` | Актуальнее по scoring |

**Транскрипт чата** (если нужны детали решений):  
`.cursor/projects/Users-galina-Desktop-Voxbridge/agent-transcripts/f8b2c6d9-fe7c-46b2-a339-fe82b93aedcc.jsonl`

---

## 12. Промпт для продолжения в новом чате

```
Проект: VoxBridge (/Users/galina/Desktop/Voxbridge).
Ветка: home-rebuild-v2.

Обязательно прочитай:
- HANDOFF_FULL_2026.md (главный контекст)
- SESSION_NOTES.md
- AGENTS.md

Стек: Next.js 16 + Supabase + Python voice-matching на :8000.
Реальный AI matching: Admin Lab (/admin/ai-voice-matching) и producer flow (/search → /results).
Scoring v5 в voice-matching-service/main.py (speaker 15%, timbre 42%, pitch 30%, quality 5%, vocal_character 8%).

[ВСТАВЬ СЮДА СВОЮ ЗАДАЧУ]
```

---

## 13. Env checklist при переносе на другую машину

- [ ] Клонировать репозиторий, ветка `home-rebuild-v2`
- [ ] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VOICE_MATCH_API_URL`
- [ ] `npm install` + `voice-matching-service` venv + `pip install -r requirements.txt`
- [ ] Запустить uvicorn :8000 и `npm run dev`
- [ ] Проверить `/health` и Admin Lab Run matching
- [ ] Восстановить незакоммиченный diff из §9 если нужен

---

*Документ создан для восстановления контекста после потери чата. Обновляйте при крупных изменениях архитектуры или scoring.*
