# Competitive Analysis — VoxBridge vs рынок

> **Живой документ.** Обновлять при каждом крупном релизе у нас или у конкурентов.  
> **Дата создания:** 2 июня 2026.  
> **Ориентир:** не догонять SoundBetter по всему — **опережать** за счёт AI match + мост Suno→human, но **внутрянку** маркетплейса довести до industry standard.

---

## Наша позиция (одна фраза)

**SoundBetter** — найти по репутации и портфолио.  
**Voices.com** — найти по имени / job + audition.  
**Suno** — создать AI-вокал (не маркетплейс найма).  
**VoxBridge** — услышал AI-вокал → найди человека с похожим звучанием → закажи по-взрослому (деньги, файлы, ревизии).

**Уникальность (не копировать у других):** акустический match + explainability + Suno/stem pipeline.  
**Паритет (нужен как у лидеров):** escrow, файлы, workroom, trust, discovery.

---

## Конкуренты для сравнения

| Платформа | Роль в сравнении |
|-----------|------------------|
| **SoundBetter** | Эталон music session marketplace (вокал, workroom, escrow) |
| **Voices.com** | Эталон search + browse + job + auditions |
| **BeatStars** | Пакеты, лицензии, storefront, сплиты |
| **Fiverr** | Простые gig-пакеты, сроки |
| **Suno** | Источник спроса (AI vocal → наш вход), не конкурент по найму |

---

## Матрица насыщенности (обновлять вручную)

Шкала: ●●●●● = стандарт рынка, ● = почти нет.  
**Последняя сверка VoxBridge:** июнь 2026.

| Блок | SoundBetter | Voices | VoxBridge |
|------|-------------|--------|-----------|
| Каталог / browse | ●●●●● | ●●●●● | ●● |
| Поиск по имени | ●●●● | ●●●●● | ●●● |
| AI / smart match | ●● | ●●● | ● (API готов, продукт — позже) |
| Request → workroom | ●●●●● | ●●●● | ●●● |
| Отзывы | ●●●●● | ●●●●● | ●●● |
| Оплата / escrow | ●●●●● | ●●●●● | ○ |
| Реальные файлы | ●●●●● | ●●●●● | ●●● |
| Уведомления | ●●●●● | ●●●●● | ● |
| Share / viral | ●●● | ●●● | ●●● |
| Контракты / пакеты | ●●●● | ●●●● | ● |

**Оценка «внутрянки» vs SoundBetter:** ~25% (июнь 2026).  
**E2E flow на Supabase:** request → accept → workspace → review — **работает**.

---

## Что уже хорошо у нас (не ломать)

- Request → Accept → Workspace (не мгновенный заказ)
- Supabase: auth, profiles, requests, orders, reviews
- Статусы: preview → approve → stems → complete → review
- Поиск по имени (hero + global nav) + Share profile
- Demo vs Real разделение на UI
- Admin lab + Python match engine (отдельно от продукта)

---

## Roadmap без матчинга (приоритеты)

Пока вокалисты для match подключаются отдельно — **улучшаем маркетплейс** по списку ниже.

### P0 — без этого не «настоящий» маркетплейс

| # | Задача | Эталон | Статус |
|---|--------|--------|--------|
| 1 | **Реальная загрузка аудио** (ref, preview, stems) → Supabase Storage | SoundBetter workroom | ✅ |
| 2 | **Stripe Connect + escrow** (prefund → release on complete) | SoundBetter | ⬜ |
| 3 | **Email / in-app уведомления** (новый request, accept, preview…) | Voices | ⬜ (есть polling ~10с) |
| 4 | **Saved vocalists в Supabase** (не localStorage) | Voices favorites | ⬜ |
| 5 | **Реальный чат** в workspace (или хотя бы messages в БД) | SoundBetter | ⬜ (mock chat) |

### P1 — паритет с лидерами

| # | Задача | Эталон | Статус |
|---|--------|--------|--------|
| 6 | **Browse /vocalists** — каталог с фильтрами (жанр, range, budget, ★) | Voices browse | ⬜ |
| 7 | **Пакеты услуг** на профиле (lead / hook / full, цена, срок) | Fiverr, BeatStars | ⬜ |
| 8 | **Proposal / counter-offer** после request | SoundBetter | ⬜ |
| 9 | **Admin из реальной БД** (users, orders, reports) | — | ⬜ (частично mock) |
| 10 | **Профиль: реальные demo uploads** + play с CDN | SoundBetter | ⬜ |
| 11 | **Revision policy** в UI (сколько ревизий included) | SoundBetter | ⬜ |
| 12 | **Vocalist availability** (open for work / busy) | Voices | ⬜ |

### P2 — опережение (без match engine)

| # | Задача | Зачем |
|---|--------|-------|
| 13 | **Project templates** («Replace Suno vocal», «Topline only») | Быстрый brief |
| 14 | **Side-by-side** на профиле: ref vs demo (ручной upload ref) | Доверие до match |
| 15 | **Audition** (короткий тест до accept) | Снижение риска |
| 16 | **Публичный storefront** SEO `/vocalists/[slug]` | Сарафан + Google |
| 17 | **Диспуты / support** flow в admin | SoundBetter trust |

### Отдельно — матчинг (когда будут вокалисты)

| # | Задача |
|---|--------|
| M1 | Подключить `POST /voice-match` к `/search` → `/results` |
| M2 | Match % + explanations в UI |
| M3 | Suno stem / vocal upload как первый шаг flow |
| M4 | Compare page с реальным match score |

---

## Что НЕ копировать

- Генерацию музыки / Studio из Suno — только **вход** (upload ref/stems)
- Полный legal stack BeatStars — взять **идею пакетов**, не всё
- Каталог всех вокалистов на Home — только **Browse** отдельно
- Гонку цен как Fiverr — positioning на **качество голоса**

---

## Как обновлять этот документ

1. После каждого спринта — колонка **Статус** (⬜ → 🔄 → ✅).
2. Раз в квартал — пересмотреть матрицу ● (SoundBetter, Voices, Suno changelog).
3. Записывать **дату** и 1–2 строки «что изменилось у нас» внизу.

### Changelog

| Дата | Изменение |
|------|-----------|
| 2026-07-03 | Реальные файлы в workspace: `order_files` + Storage upload UI (нужен `docs/supabase_order_files_storage.sql`). |
| 2026-06-02 | Первый анализ. E2E на Supabase. My requests, search by name, share profile, workspace labels, polling. |

---

*Связанные файлы: `ROADMAP_RU.md`, `VOXBRIDGE_BRIEFING.md`, `PROJECT_MEMO.md`*
