-- CombMap database schema (interactions + optional ranking)
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  is_guest boolean NOT NULL DEFAULT true,
  display_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_url text,
  gender text,
  age integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invites (
  code text PRIMARY KEY,
  email text,
  used_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.likes (
  tomb_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tomb_id, user_id)
);
CREATE INDEX IF NOT EXISTS likes_tomb_id_idx ON public.likes (tomb_id);

CREATE TABLE IF NOT EXISTS public.checkins (
  id uuid PRIMARY KEY,
  tomb_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkins_tomb_id_idx ON public.checkins (tomb_id);
CREATE INDEX IF NOT EXISTS checkins_user_id_idx ON public.checkins (user_id);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY,
  tomb_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_tomb_id_idx ON public.comments (tomb_id);
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON public.comments (user_id);

CREATE TABLE IF NOT EXISTS public.favorites (
  tomb_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tomb_id, user_id)
);
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites (user_id);

-- Tomb search ranking (counts how often users "search-hit" a tomb)
CREATE TABLE IF NOT EXISTS public.tomb_search_counts (
  tomb_id text PRIMARY KEY,
  search_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tomb_search_counts_count_idx ON public.tomb_search_counts (search_count DESC);
