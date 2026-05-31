# ROADMAP — VoxBridge (планы после MVP)

Приоритеты и направления. **Не начинать без согласования** с владельцем продукта.

---

## Ближайшие (логичное продолжение MVP)

### 1. Реальный AI matching в продукте
- Сейчас: mock на `/results` (`lib/matching.ts`).
- Уже есть: Python API + Admin Lab (`/admin/ai-voice-matching`).
- Задача: подключить тот же `POST /voice-match` (или обёртку) к producer flow после `/search`, с теми же FormData (`ai_vocal`, `demos`).
- Учесть: время обработки 5–20 с, loader, CORS, порт 3000.

### 2. Слияние веток home
- Актуальная UX-ветка: `home-rebuild-v2`.
- Слить в `main` после финального ревью explore/matching.

### 3. Legacy-маршруты
- Редиректы или удаление stub-страниц: `/upload`, `/matches`, `/order/*`, `/request/*`, `/auth`, старые dashboard stubs.
- Один канонический путь: `/search` → `/results`.

### 4. Документация
- Обновить [`AGENTS.md`](AGENTS.md) под актуальные маршруты (`/home`, `/workspace`, admin, …).
- Держать [`PROJECT_MEMO.md`](PROJECT_MEMO.md) в актуальном состоянии.

---

## Средний срок

### Backend и данные
- **Supabase / PostgreSQL** — только по явному запросу.
- Реальная auth, хранение файлов (S3), multi-user.
- Синхронизация заказов и чата между устройствами.

### Workspace
- Реальный chat (WebSocket или polling).
- Загрузка файлов (preview, stems) на storage.
- Уведомления (новая заявка, revision, delivery).

### Marketplace
- Платежи (Stripe) — есть stub `/order/create`.
- Рейтинги и отзывы уже частично в `lib/reviews.ts` — вывести в продуктовый UI.

### Admin
- Реальные users/orders из БД вместо mock в `lib/admin.ts`.
- Модерация контента с persistence.

---

## Долгий срок

- Настоящий AI: не только speaker embedding, но timbre/style models.
- Мобильная адаптация / PWA.
- Локализация (EN/RU).
- Аналитика для продюсеров и вокалистов.

---

## Технический долг (известный)

| Область | Проблема |
|---------|----------|
| Lint | `set-state-in-effect` в части страниц (dashboard, shell) |
| Hydration | Решено через `useClientAuth` / `useMounted` — не откатывать |
| CORS | API разрешает `localhost:3000`; другой порт — править `voice-matching-service` |
| Пароли | В localStorage открытым текстом (demo only) |
| Audio | Нет реальной загрузки на сервер — только имена файлов в MVP |

---

## Явно не делать без запроса

- Supabase, Stripe production, email auth.
- Глобальный редизайн без задачи.
- `useSyncExternalStore` для localStorage без согласования.
- Коммиты и push в remote без просьбы пользователя.

---

*Обновляйте этот файл при смене приоритетов.*
