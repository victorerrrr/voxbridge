# CHANGELOG — сессии разработки VoxBridge

Хронология **по темам** (не дословные логи чатов). Нужна, чтобы новый агент или вы после переустановки понимали, **почему** код устроен так.

---

## Фаза 1 — MVP страницы и mock matching

- Созданы маршруты: `/`, `/search`, `/results`, `/vocalists/[id]`, `/become-vocalist`.
- Mock-вокалисты: `lib/mockVocalists.ts`, карточки, match reasons в `lib/matching.ts`.
- Dark premium UI, Tailwind.

---

## Фаза 2 — Auth и личный кабинет

- `/signup`, `/login`, `/dashboard` (profile, settings).
- Fake auth: `voxbridge_auth_state`, миграция с `voxbridge_user`.
- Avatar в localStorage, `PasswordInput` с toggle глаза.
- Logout: сессия сбрасывается, **аккаунт сохраняется**.

---

## Фаза 3 — Landing и hero

- Переработка `/`: premium hero, animated glow, Sign in → `/login`.
- Role CTA: Upload AI Vocal → producer signup; Add your voice → vocalist signup.
- Убраны дублирующие кнопки внизу hero.

---

## Фаза 4 — Producer flow end-to-end

- Upload context: `lib/upload-context.ts` → `/results`.
- `/compare/[id]`, Request Vocalist → `lib/orders.ts` → `/workspace/[orderId]`.
- Workspace: preview, revision, delivery, completed, reviews.
- `/saved-vocalists`, producer projects в dashboard.

---

## Фаза 5 — Vocalist flow

- Onboarding `/vocalist/onboarding`, demos, tags (из профиля + custom «+»).
- `/vocalist/orders`, `/vocalist/requests/[requestId]`.
- Accept не удаляет заявку — статус `accepted`, Go to workspace.
- Vocalist workspace: те же orders в `voxbridge_producer_orders`.

---

## Фаза 6 — Navigation shell

- `InternalShell`: группы меню producer/vocalist, логотип → `/home`.
- Sidebar: pin (булавка), pinned/auto, hover close 200ms.
- Role badge: Producer mode / Vocalist mode.
- `/home` как внутренняя главная (не только dashboard).

---

## Фаза 7 — Стабильность client state

- Убран `useSyncExternalStore` для localStorage (infinite loop).
- Паттерн: `subscribe` + cached snapshot в lib + hooks (`use-producer-orders`, …).
- Hydration: `useClientAuth`, `useMounted`, loading до чтения storage.

---

## Фаза 8 — Home: несколько итераций

1. **Block layout** — track list + detail panel + mini player.
2. **Explore vs Matching** — `hasAiVocalUpload()` / `voxbridge_upload_context` (только реальный `fileName` или `hasAiVocalFile`).
3. **Full rebuild** (`home-rebuild-v2`): explore landing (hero, transformation demo, featured, feed) + отдельный matching UI после upload.
4. Поиск: фильтрация на клиенте, без редиректа на `/search` с home.

Ветки: `home-redesign-v1`, `home-rebuild-v2`, backup-коммит `ed833ef`.

---

## Фаза 9 — Admin control center

- Login admin/admin → `/admin`, отдельный `AdminShell`.
- Страницы: users, orders, workspaces, messages, moderation, …
- Admin не видит My Profile / My Demos как обычный vocalist.
- Preview Producer | Vocalist | Back to Admin.

---

## Фаза 10 — AI Voice Matching Lab

- `/admin/ai-voice-matching` — UI lab.
- Интеграция с `voice-matching-service` (FastAPI, port 8000).
- FormData: `ai_vocal`, `demos` — только реальный API, без mock на success.
- UI: top match, confidence High/Medium/Low, explanation text.
- `use-lab-audio-playback`: одно аудио за раз, Play/Stop toggle.

---

## Фаза 11 — UX polish (точечные фиксы)

- Typography (`text-vox-*`), glow orbs, workspace 3-column + chat resize.
- Vocalist range / Recording Setup / external links.
- Sidebar: Upload AI Vocal label, `/workspace` list, admin role switch global.
- Login по username; upload → results redirect fix.

---

## Фаза 12 — Документация (текущая задача)

- `PROJECT_MEMO.md`, `HANDOFF_RU.md`, `ROADMAP_RU.md`, `CURSOR_BACKUP_RU.md`, этот файл.

---

## Как использовать с новым агентом

1. Дайте агенту: `PROJECT_MEMO.md` + `AGENTS.md` + при необходимости этот CHANGELOG.
2. Укажите ветку: обычно `home-rebuild-v2` для актуального home.
3. Напомните: **no Supabase**, **localStorage only**, unless asked.

---

*Дополняйте секцией «Фаза N» после крупных блоков работ.*
