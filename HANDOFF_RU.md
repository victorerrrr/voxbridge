# HANDOFF — VoxBridge (перед переустановкой Windows)

Документ для **вас** и для восстановления проекта без потери контекста.  
Дата сверки: май 2026.

---

## Что это за проект

**VoxBridge** — MVP маркетплейса для **продюсеров** и **вокалистов**:

- Продюсер загружает AI-вокал (или описывает голос) → получает подбор вокалистов (сейчас **mock** на `/results`, реальный AI — в **Admin Lab**).
- Запрос вокалисту → заказ в **Supabase** → общая **workspace** (чат, превью, ревизии, сдача, отзыв).
- Вокалист: онбординг, демо, теги, входящие заявки, работа в workspace.

**Backend:** **Supabase** (auth, профили, заявки, заказы, отзывы).  
**Mock/localStorage:** featured vocalists на `/home`, upload context, saved vocalists, admin preview override.

Стек: **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**, **Supabase**.

---

## Что уже реализовано (кратко)

### Публичная часть
- Лендинг `/` — premium hero, glow, CTA: Upload AI Vocal (producer) / Add your voice (vocalist).
- `/signup` — кнопки ролей Producer / Vocalist, `?role=` из лендинга.
- `/login` — email **или** username + password.

### Auth и аккаунт
- Fake auth: `lib/auth.ts`, ключ `voxbridge_auth_state`.
- Logout **не удаляет** аккаунт — только `isAuthenticated: false`.
- Dashboard `/dashboard` — profile, settings, projects (producer), saved vocalists.
- Avatar и external links (Spotify, SoundCloud, …) в profile.

### Внутренняя главная `/home`
- **Explore mode** (по умолчанию): нет загруженного AI-вокала → hero, демо «Hear the transformation», featured vocalists, лента transformations, strip «Continue working». **Без match %**.
- **Matching mode**: после upload на `/search` (есть `fileName` / `hasAiVocalFile` в `voxbridge_upload_context`) → «AI matching results», match %, compare, AI vs Real в панели и mini player.
- Поиск на matching-экране фильтрует список **на месте**, без редиректа.

### Producer flow
- `/search` → brief + upload → `/results` (mock matching).
- `/compare/[id]`, `/vocalists/[id]`, Request → `/request/[vocalistId]` → **`/my-requests`** (статус заявок).
- Accept вокалистом → `/workspace/[orderId]`.
- `/workspace` — список проектов; `/workspace/[orderId]` — 3 колонки (info | chat | files/actions).
- `/dashboard?tab=projects` — **My Projects** из Supabase orders.
- `/saved-vocalists` — сохранённые вокалисты.

**E2E (проверено):** Request → Accept → Workspace → Preview → Approve → Deliver → Complete & review → отзыв на профиле.

**Featured на `/home`** — демо-профили (бейдж Demo), не реальные вокалисты. Реальный тестовый вокалист — через прямую ссылку на профиль.

### Vocalist flow
- Signup vocalist → `/vocalist/onboarding` → tags → demos → `/home`.
- `/vocalist/orders`, `/vocalist/requests/[requestId]` — accept → `/workspace/[orderId]?side=vocalist`.
- Профиль: vocal range (Soprano…Bass), voice characteristics, Recording Setup.

### Admin (отдельный control center)
- Login: **admin** / **admin** → `/admin`.
- Разделы: overview, users, vocalists, producers, orders, workspaces, messages, reports, moderation, settings.
- **AI Voice Matching Lab**: `/admin/ai-voice-matching` — реальный POST на Python API.
- Preview: View as Producer / Vocalist (не путать с обычным пользователем).

### UI / shell
- `InternalShell` — sidebar, pin (булавка), role badge, admin switch.
- Glow background (12 orbs), `AnimatedButton`, hydration-safe hooks (`useClientAuth`, `useMounted`).

### Voice matching service (Python)
- Папка `voice-matching-service/` — FastAPI, порт **8000**, endpoint `POST /voice-match`.
- Модель ECAPA в `pretrained_models/` (тяжёлая — лучше копировать при переносе).

---

## localStorage (осталось) и Supabase

| Хранилище | Что |
|-----------|-----|
| **Supabase** | auth, profiles, vocalist_profiles, vocalist_requests, orders, reviews |
| `voxbridge_upload_context` | AI vocal / brief продюсера (режим matching на `/home`) |
| `voxbridge_saved_vocalists` | ID сохранённых вокалистов |
| `voxbridge_sidebar_mode` | pinned / auto для sidebar |
| `voxbridge_admin_role_override` | Preview role для admin |

**RLS (важно):** при Accept вокалистом нужна политика `vocalist_insert_order_on_accept` — см. `docs/supabase_fix_orders_accept_rls.sql`.

Подробнее: [`PROJECT_MEMO.md`](PROJECT_MEMO.md).

---

## Git: ветки и коммиты (ориентир)

Проверьте локально: `git branch -a`, `git log --oneline -20`.

| Ветка / коммит | Смысл |
|----------------|--------|
| `main` | Базовая ветка |
| `home-rebuild-v2` | Актуальная переработка `/home` (explore landing + matching) |
| `home-redesign-v1` | Ранний redesign home |
| `206be35` | Добавлен `PROJECT_MEMO.md` |
| `ed833ef` | backup: before home redesign |
| `1d0afc7` | Rebuild /home explore vs matching |
| `d953748` | Premium explore landing |
| `a672678` | Admin AI Voice Matching Lab |

**Рекомендация:** для продолжения работы с новым home — ветка **`home-rebuild-v2`** (или merge в `main`, когда будете готовы).

---

## Как поднять проект после переустановки Windows

### 1. Frontend (Next.js)

```bash
cd "путь/к/voxbridge"
npm install
```

Создайте `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_VOICE_MATCH_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Открыть: http://localhost:3000  

Для AI Lab и matching API фронт должен быть на **порту 3000** (CORS бэкенда).

### 2. Voice matching API (опционально, для Admin Lab)

```powershell
cd voice-matching-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
.\scripts\run-server.ps1
```

Проверка: http://localhost:8000/health → `{"status":"ok"}`  

Подробности: [`voice-matching-service/README.md`](voice-matching-service/README.md)  
Нужны: **Python 3.10+**, **ffmpeg** в PATH.

Переменная (если API не на 8000):

```env
NEXT_PUBLIC_VOICE_MATCH_API_URL=http://localhost:8000
```

### 3. Быстрый smoke-test

| Действие | URL / данные |
|----------|----------------|
| Лендинг | `/` |
| Регистрация producer | `/signup?role=producer` |
| Home explore | `/home` (без `voxbridge_upload_context`) |
| Upload → matching | `/search` + файл → `/home` |
| Producer requests | `/my-requests` |
| Producer projects | `/dashboard?tab=projects` |
| Admin | `/login` → admin / admin → `/admin` |
| AI Lab | `/admin/ai-voice-matching` |

---

## Что копировать при переносе

### Обязательно
- Вся папка **`voxbridge`** (исходники + эти `.md`).
- Папка Cursor (история агентов): см. [`CURSOR_BACKUP_RU.md`](CURSOR_BACKUP_RU.md).
- **Git**: `git push` на remote **или** `git bundle create voxbridge-backup.bundle --all`.

### Желательно (экономит время)
- `voice-matching-service/pretrained_models/` — веса SpeechBrain (иначе долгая загрузка).

### Не копировать — восстановить командами
- `node_modules/`
- `.next/`
- `voice-matching-service/.venv/`

---

## Связанные документы в репозитории

| Файл | Для кого |
|------|----------|
| [`PROJECT_MEMO.md`](PROJECT_MEMO.md) | AI-агенты в Cursor (техническая карта) |
| [`ROADMAP_RU.md`](ROADMAP_RU.md) | Планы на будущее |
| [`CHANGELOG_SESSION_RU.md`](CHANGELOG_SESSION_RU.md) | Хронология доработок в сессиях |
| [`CURSOR_BACKUP_RU.md`](CURSOR_BACKUP_RU.md) | Как сохранить чаты Cursor |
| [`AGENTS.md`](AGENTS.md) | Краткие правила (частично устарел) |

---

*Сохраните этот файл вместе с папкой проекта на флешку или в облако.*
