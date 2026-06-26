-- ============================================================================
-- VoxBridge — Postgres schema draft (Supabase-ready)
-- ============================================================================
-- Status: DRAFT FOR REVIEW — not yet applied anywhere. No Supabase project
-- exists yet. This is groundwork so that once Vlad/Vladimir sign off and a
-- Supabase project is created, the schema is ready to apply immediately.
--
-- Design approach: hybrid normalization.
--   - Stable, frequently-joined, frequently-filtered fields -> real columns
--     with foreign keys (users, vocalist_profiles, orders, etc.)
--   - Small, fixed-shape, always-present-together structs (RecordingSetup)
--     -> flattened into columns on the parent table, not JSONB, not a
--     separate table (they're not independent entities).
--   - Tag-like string arrays from a known/managed option list (genres,
--     moods, voice types, voice tones, voice characteristics, languages)
--     -> Postgres TEXT[] columns with GIN indexes. Simpler than JSONB for
--     flat string lists, supports fast containment queries (@>, &&).
--   - One-to-many real entities (demos, reference links) -> separate
--     tables / jsonb depending on whether they're independently queried.
--     Demos are independently queried/deleted -> own table.
--     Reference links are small and never queried standalone -> jsonb.
--
-- Naming: snake_case throughout (Postgres convention), even though the
-- TypeScript interfaces use camelCase. Supabase auto-generates camelCase
-- client types from snake_case columns, so this is a non-issue at the
-- application layer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
-- Maps to: lib/auth.ts -> AuthUser / StoredAccount
--
-- NOTE: if migrating to Supabase Auth (recommended — gives real sessions,
-- password hashing, magic links, etc. "for free"), this table becomes a
-- companion/profile table keyed by auth.users.id (Supabase's built-in auth
-- schema), NOT a replacement for it. Plaintext password storage (current
-- lib/auth.ts behavior) goes away entirely once Supabase Auth handles auth.
create table users (
  id            uuid primary key default gen_random_uuid(),
  -- if using Supabase Auth: id references auth.users(id) on delete cascade instead
  email         text not null unique,
  username      text not null unique,
  role          text not null check (role in ('producer', 'vocalist', 'admin')),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_users_role on users(role);

-- external_links: spotify/soundcloud/youtube/instagram/website
-- Maps to: lib/external-links.ts -> ExternalLinks
-- Small, fixed key set, read together with the user -> flatten into users
-- rather than a separate table or jsonb (avoids a join for a rarely-changing,
-- always-fetched-together field group).
alter table users add column external_link_spotify    text;
alter table users add column external_link_soundcloud  text;
alter table users add column external_link_youtube     text;
alter table users add column external_link_instagram   text;
alter table users add column external_link_website     text;

-- ----------------------------------------------------------------------------
-- VOCALIST PROFILES
-- ----------------------------------------------------------------------------
-- Maps to: lib/vocalist-profile.ts -> VocalistProfile (+ RecordingSetup, VocalistTags)
create table vocalist_profiles (
  id                          uuid primary key default gen_random_uuid(),
  owner_id                    uuid not null unique references users(id) on delete cascade,
  bio                         text not null default '',

  -- VocalistProfile.voiceTones / voiceCharacteristics / genres / languages
  -- (flat string lists from a managed option list -> array + GIN index)
  voice_tones                 text[] not null default '{}',
  voice_characteristics       text[] not null default '{}',
  genres                      text[] not null default '{}',
  languages                   text[] not null default '{}',

  vocal_range                 text not null default '',

  -- legacy free-text studio equipment summary (kept alongside structured
  -- recording_setup_* columns below — VocalistProfile has both fields today)
  studio_equipment             text not null default '',

  -- RecordingSetup, flattened (fixed shape, always fetched with the profile)
  recording_setup_microphone               text not null default '',
  recording_setup_audio_interface          text not null default '',
  recording_setup_daw                      text not null default '',
  recording_setup_environment              text not null default '',
  recording_setup_studio_sessions_available boolean, -- nullable: tri-state (true/false/unknown)

  -- VocalistTags: genres (dup of profile.genres by current TS shape — kept
  -- separate to match VocalistTags exactly; see note below), moods, voiceTypes
  tags_genres                 text[] not null default '{}',
  tags_moods                  text[] not null default '{}',
  tags_voice_types            text[] not null default '{}',

  onboarding_complete         boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_vocalist_profiles_owner on vocalist_profiles(owner_id);
create index idx_vocalist_profiles_genres on vocalist_profiles using gin (genres);
create index idx_vocalist_profiles_voice_tones on vocalist_profiles using gin (voice_tones);
create index idx_vocalist_profiles_languages on vocalist_profiles using gin (languages);
create index idx_vocalist_profiles_tags_genres on vocalist_profiles using gin (tags_genres);
create index idx_vocalist_profiles_tags_moods on vocalist_profiles using gin (tags_moods);
create index idx_vocalist_profiles_tags_voice_types on vocalist_profiles using gin (tags_voice_types);

-- NOTE for Galina: VocalistProfile.genres and VocalistProfile.tags.genres
-- are two separate fields in the current TypeScript type (lines 187 and 94
-- of lib/vocalist-profile.ts) — this schema preserves that duplication
-- faithfully rather than silently merging them, since I don't know from
-- the type alone whether they're meant to diverge (e.g. one syncs from
-- onboarding, the other is admin-curated) or whether merging them is safe.
-- Worth asking before the real migration: are these ever different in
-- practice, or is one redundant?

-- ----------------------------------------------------------------------------
-- VOCALIST DEMOS
-- ----------------------------------------------------------------------------
-- Maps to: lib/vocalist-profile.ts -> VocalistDemo[] (profile.demos)
-- One-to-many, independently addressable (a single demo can be deleted/
-- replaced without touching the rest of the profile) -> own table.
create table vocalist_demos (
  id                  uuid primary key default gen_random_uuid(),
  vocalist_profile_id uuid not null references vocalist_profiles(id) on delete cascade,
  track_name          text not null,
  description         text not null default '',
  file_name           text not null,
  -- file_url: where the actual audio file lives once real file storage
  -- exists (e.g. Supabase Storage). Not in the current TS type because
  -- there's no real file storage today — added here as the obvious next
  -- field once files are stored for real instead of just a fileName string.
  file_url            text,
  created_at          timestamptz not null default now()
);

create index idx_vocalist_demos_profile on vocalist_demos(vocalist_profile_id);-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
-- Maps to: lib/orders.ts -> ProducerOrder + CreateOrderOptions
create table orders (
  id                  uuid primary key default gen_random_uuid(),
  vocalist_profile_id uuid not null references vocalist_profiles(id) on delete cascade,
  producer_id         uuid not null references users(id) on delete cascade,

  track_name          text not null,
  vibe                text not null default '',

  status              text not null default 'in_progress'
                       check (status in (
                         'in_progress', 'preview_pending', 'revision_requested',
                         'preview_approved', 'delivery_ready', 'completed'
                       )),

  revision_count      integer not null default 0,
  delivery_note        text not null default '',

  project_name        text,
  description         text,
  reference           text,
  budget               numeric(10, 2),

  has_preview          boolean not null default false,
  has_stems             boolean not null default false,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_orders_vocalist on orders(vocalist_profile_id);
create index idx_orders_producer on orders(producer_id);
create index idx_orders_status on orders(status);

-- ----------------------------------------------------------------------------
-- VOCALIST REQUESTS
-- ----------------------------------------------------------------------------
-- Maps to: lib/vocalist-requests.ts -> VocalistRequest (+ ReferenceLink[])
create table vocalist_requests (
  id                  uuid primary key default gen_random_uuid(),
  vocalist_profile_id uuid not null references vocalist_profiles(id) on delete cascade,
  producer_id         uuid not null references users(id) on delete cascade,

  project_name        text not null,
  description         text not null default '',
  brief               text not null default '',
  reference           text not null default '',
  budget              numeric(10, 2) not null default 0,

  status              text not null default 'pending'
                       check (status in ('pending', 'accepted', 'declined')),

  -- tag-like arrays, same array+GIN treatment as vocalist_profiles
  genre_tags          text[] not null default '{}',
  mood_tags           text[] not null default '{}',
  voice_tags          text[] not null default '{}',

  bpm                 text not null default '', -- kept as text: TS type is
                                                  -- string, not number — may
                                                  -- be a free-text "120-130" range
  musical_key         text not null default '',

  -- ReferenceLink[]: small, fixed-shape {label, url} pairs, never queried
  -- standalone (always fetched as part of the request) -> jsonb array
  reference_links     jsonb not null default '[]',

  deadline            timestamptz,

  -- set once a request is accepted and converted into a real order
  order_id            uuid references orders(id) on delete set null,

  created_at          timestamptz not null default now()
);

create index idx_vocalist_requests_vocalist on vocalist_requests(vocalist_profile_id);
create index idx_vocalist_requests_producer on vocalist_requests(producer_id);
create index idx_vocalist_requests_status on vocalist_requests(status);
create index idx_vocalist_requests_genre_tags on vocalist_requests using gin (genre_tags);

-- ----------------------------------------------------------------------------
-- REVIEWS
-- ----------------------------------------------------------------------------
-- Maps to: lib/reviews.ts -> VocalistReview
create table reviews (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  vocalist_profile_id uuid not null references vocalist_profiles(id) on delete cascade,
  producer_id         uuid not null references users(id) on delete cascade,
  rating              smallint not null check (rating >= 1 and rating <= 5),
  comment             text not null default '',
  created_at          timestamptz not null default now(),

  -- one review per order, consistent with addVocalistReview's current
  -- usage (called once per completed order in app/workspace/[orderId])
  unique (order_id)
);

create index idx_reviews_vocalist on reviews(vocalist_profile_id);-- ----------------------------------------------------------------------------
-- ADMIN: REPORTS, MODERATION, CONVERSATIONS
-- ----------------------------------------------------------------------------
-- Maps to: lib/admin.ts -> AdminReport, ModerationItem, AdminConversation,
-- AdminMessage. These were previously backed by hardcoded MOCK_* arrays +
-- localStorage overrides — now real tables. AdminUserRecord and
-- AdminDashboardStats are NOT separate tables: they're derived/computed
-- views over users/orders/vocalist_requests/reviews (same as today's
-- getAdminDashboardStats(), just as a SQL view or application-level query
-- instead of an in-memory computation).

create table admin_reports (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('user', 'message', 'content')),
  subject     text not null,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now()
);

create table moderation_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('demo', 'profile', 'link', 'report')),
  title        text not null,
  owner_id     uuid references users(id) on delete set null,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now()
);

create table conversations (
  id           uuid primary key default gen_random_uuid(),
  -- participants as an array of user ids rather than the current TS type's
  -- free-text "AlexProducer ↔ LunaVox" string -- this is the one place this
  -- draft intentionally improves on the current shape, since a real DB can
  -- enforce referential integrity here where localStorage couldn't.
  participant_ids uuid[] not null,
  flagged          boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references users(id) on delete cascade,
  body            text not null,
  sent_at         timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id);

-- ----------------------------------------------------------------------------
-- updated_at auto-touch trigger (applies to all tables with updated_at)
-- ----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at before update on users
  for each row execute function touch_updated_at();
create trigger trg_vocalist_profiles_updated_at before update on vocalist_profiles
  for each row execute function touch_updated_at();
create trigger trg_orders_updated_at before update on orders
  for each row execute function touch_updated_at();
create trigger trg_conversations_updated_at before update on conversations
  for each row execute function touch_updated_at();