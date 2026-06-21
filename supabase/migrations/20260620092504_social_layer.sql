-- ============================================================================
-- Chill n Go — Migracion 2: Capa social (copiada FIEL del esquema vivo de Matrix)
-- Proyecto NUEVO osbsbrpdwjstvafhzjjj. Solo estructura, SIN datos.
-- Incluye: tablas, defaults, PK/UK/CHECK/FK, indices, funciones+triggers,
-- RLS + politicas (tal cual), GRANTs y pertenencia a supabase_realtime.
-- NOTA: se replican fielmente duplicados/drift de Matrix (triggers de doble
-- conteo y politicas repetidas) y GRANTs amplios; ver reporte para endurecer.
-- ============================================================================

create extension if not exists pgcrypto;

-- ===================== FUNCIONES DE TRIGGER =====================
CREATE OR REPLACE FUNCTION public.fn_cng_new_message()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE cng_conversations
  SET last_message_at = NEW.created_at, last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  UPDATE cng_conversation_members
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cng_post_comments_counter()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cng_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cng_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cng_post_likes_counter()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cng_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cng_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cng_set_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_decrement_comments()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE cng_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_decrement_likes()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE cng_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_increment_comments()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE cng_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_increment_likes()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE cng_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_message()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  UPDATE cng_conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = CASE
        WHEN NEW.message_type = 'image' THEN '📷 Photo'
        WHEN NEW.message_type = 'video' THEN '🎬 Video'
        WHEN NEW.message_type = 'voice' THEN '🎙️ Voice message'
        WHEN NEW.message_type = 'document' THEN '📄 Document'
        WHEN NEW.message_type = 'location' THEN '📍 Location'
        WHEN NEW.message_type = 'chilliums' THEN '💰 Chilliums enviados'
        WHEN NEW.message_type = 'poll' THEN '📊 Encuesta'
        ELSE LEFT(NEW.content, 100)
      END
  WHERE id = NEW.conversation_id;
  UPDATE cng_conversation_members
  SET unread_count = COALESCE(unread_count, 0) + 1
  WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_story_likes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE cng_stories SET likes_count = likes_count + 1 WHERE id = NEW.story_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE cng_stories SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.story_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_story_views()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  UPDATE cng_stories SET views_count = views_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$function$;

-- ===================== TABLAS (columnas + defaults) =====================
create table public.cng_posts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  member_id uuid,
  media_url text,
  media_type text default 'image'::text,
  thumbnail_url text,
  caption text,
  category text default 'general'::text,
  location_name text,
  location_lat numeric,
  location_lng numeric,
  likes_count integer default 0,
  comments_count integer default 0,
  bookmarks_count integer default 0,
  shares_count integer default 0,
  is_featured boolean default false,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
create table public.cng_post_likes (
  id uuid not null default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now()
);
create table public.cng_post_comments (
  id uuid not null default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid not null,
  content text not null,
  parent_comment_id uuid,
  likes_count integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);
create table public.cng_post_bookmarks (
  id uuid not null default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now()
);
create table public.cng_follows (
  id uuid not null default gen_random_uuid(),
  follower_id uuid not null,
  following_id uuid not null,
  created_at timestamp with time zone default now()
);
create table public.cng_conversations (
  id uuid not null default gen_random_uuid(),
  type text default 'direct'::text,
  name text,
  created_by uuid not null,
  last_message_at timestamp with time zone default now(),
  last_message_preview text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  avatar_url text,
  admin_id uuid,
  description text
);
create table public.cng_conversation_members (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text,
  unread_count integer default 0,
  last_read_at timestamp with time zone,
  joined_at timestamp with time zone default now(),
  is_muted boolean default false,
  is_archived boolean default false,
  is_pinned boolean default false,
  cleared_at timestamp with time zone
);
create table public.cng_messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid not null,
  content text,
  message_type text default 'text'::text,
  media_url text,
  reply_to_id uuid,
  is_edited boolean default false,
  is_deleted boolean default false,
  created_at timestamp with time zone default now(),
  reactions jsonb default '{}'::jsonb,
  delivery_status text default 'sent'::text,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  edited_at timestamp with time zone,
  is_view_once boolean default false,
  viewed_once_at timestamp with time zone,
  story_id uuid
);
create table public.cng_message_reactions (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  emoji text not null,
  created_at timestamp with time zone default now()
);
create table public.cng_starred_messages (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  message_id uuid not null,
  conversation_id uuid not null,
  created_at timestamp with time zone default now()
);
create table public.cng_deleted_messages (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  deleted_at timestamp with time zone not null default now()
);
create table public.cng_blocked_users (
  id uuid not null default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamp with time zone default now()
);
create table public.cng_reports (
  id uuid not null default gen_random_uuid(),
  reporter_id uuid not null,
  reported_user_id uuid,
  message_id uuid,
  conversation_id uuid,
  reason text not null,
  details text,
  status text default 'pending'::text,
  created_at timestamp with time zone default now()
);
create table public.cng_notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text,
  body text,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);
create table public.cng_stories (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  media_url text not null,
  media_type text not null default 'image'::text,
  caption text,
  category text,
  views_count integer default 0,
  likes_count integer default 0,
  expires_at timestamp with time zone not null default (now() + '24:00:00'::interval),
  created_at timestamp with time zone default now()
);
create table public.cng_story_views (
  id uuid not null default gen_random_uuid(),
  story_id uuid not null,
  viewer_id uuid not null,
  viewed_at timestamp with time zone default now()
);
create table public.cng_story_replies (
  id uuid not null default gen_random_uuid(),
  story_id uuid not null,
  sender_id uuid not null,
  content text not null,
  created_at timestamp with time zone default now()
);
create table public.cng_story_reactions (
  id uuid not null default gen_random_uuid(),
  story_id uuid not null,
  user_id uuid not null,
  reaction text not null default 'like'::text,
  created_at timestamp with time zone default now()
);
create table public.cng_polls (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  creator_id uuid not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  is_anonymous boolean default false,
  is_multiple_choice boolean default false,
  closes_at timestamp with time zone,
  created_at timestamp with time zone default now()
);
create table public.cng_poll_votes (
  id uuid not null default gen_random_uuid(),
  poll_id uuid not null,
  user_id uuid not null,
  option_index integer not null,
  created_at timestamp with time zone default now()
);
create table public.user_presence (
  user_id uuid not null,
  last_seen_at timestamp with time zone not null default now(),
  is_online boolean not null default false,
  updated_at timestamp with time zone not null default now()
);

-- ===================== PRIMARY KEYS =====================
alter table public.cng_blocked_users add constraint cng_blocked_users_pkey PRIMARY KEY (id);
alter table public.cng_conversation_members add constraint cng_conversation_members_pkey PRIMARY KEY (id);
alter table public.cng_conversations add constraint cng_conversations_pkey PRIMARY KEY (id);
alter table public.cng_deleted_messages add constraint cng_deleted_messages_pkey PRIMARY KEY (id);
alter table public.cng_follows add constraint cng_follows_pkey PRIMARY KEY (id);
alter table public.cng_message_reactions add constraint cng_message_reactions_pkey PRIMARY KEY (id);
alter table public.cng_messages add constraint cng_messages_pkey PRIMARY KEY (id);
alter table public.cng_notifications add constraint cng_notifications_pkey PRIMARY KEY (id);
alter table public.cng_poll_votes add constraint cng_poll_votes_pkey PRIMARY KEY (id);
alter table public.cng_polls add constraint cng_polls_pkey PRIMARY KEY (id);
alter table public.cng_post_bookmarks add constraint cng_post_bookmarks_pkey PRIMARY KEY (id);
alter table public.cng_post_comments add constraint cng_post_comments_pkey PRIMARY KEY (id);
alter table public.cng_post_likes add constraint cng_post_likes_pkey PRIMARY KEY (id);
alter table public.cng_posts add constraint cng_posts_pkey PRIMARY KEY (id);
alter table public.cng_reports add constraint cng_reports_pkey PRIMARY KEY (id);
alter table public.cng_starred_messages add constraint cng_starred_messages_pkey PRIMARY KEY (id);
alter table public.cng_stories add constraint cng_stories_pkey PRIMARY KEY (id);
alter table public.cng_story_reactions add constraint cng_story_reactions_pkey PRIMARY KEY (id);
alter table public.cng_story_replies add constraint cng_story_replies_pkey PRIMARY KEY (id);
alter table public.cng_story_views add constraint cng_story_views_pkey PRIMARY KEY (id);
alter table public.user_presence add constraint user_presence_pkey PRIMARY KEY (user_id);

-- ===================== UNIQUE =====================
alter table public.cng_blocked_users add constraint cng_blocked_users_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);
alter table public.cng_conversation_members add constraint cng_conversation_members_conversation_id_user_id_key UNIQUE (conversation_id, user_id);
alter table public.cng_deleted_messages add constraint cng_deleted_messages_message_id_user_id_key UNIQUE (message_id, user_id);
alter table public.cng_follows add constraint cng_follows_follower_id_following_id_key UNIQUE (follower_id, following_id);
alter table public.cng_message_reactions add constraint cng_message_reactions_message_id_user_id_key UNIQUE (message_id, user_id);
alter table public.cng_poll_votes add constraint cng_poll_votes_poll_id_user_id_option_index_key UNIQUE (poll_id, user_id, option_index);
alter table public.cng_post_bookmarks add constraint cng_post_bookmarks_post_id_user_id_key UNIQUE (post_id, user_id);
alter table public.cng_post_likes add constraint cng_post_likes_post_id_user_id_key UNIQUE (post_id, user_id);
alter table public.cng_starred_messages add constraint cng_starred_messages_user_id_message_id_key UNIQUE (user_id, message_id);
alter table public.cng_story_reactions add constraint cng_story_reactions_story_id_user_id_key UNIQUE (story_id, user_id);
alter table public.cng_story_views add constraint cng_story_views_story_id_viewer_id_key UNIQUE (story_id, viewer_id);

-- ===================== CHECK =====================
alter table public.cng_conversation_members add constraint cng_conversation_members_role_check CHECK ((role = ANY (ARRAY['member'::text, 'admin'::text])));
alter table public.cng_conversations add constraint cng_conversations_type_check CHECK ((type = ANY (ARRAY['direct'::text, 'group'::text])));
alter table public.cng_follows add constraint cng_follows_check CHECK ((follower_id <> following_id));
alter table public.cng_messages add constraint cng_messages_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['sending'::text, 'sent'::text, 'delivered'::text, 'read'::text])));
alter table public.cng_messages add constraint cng_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'video'::text, 'voice'::text, 'document'::text, 'location'::text, 'chilliums'::text, 'poll'::text])));
alter table public.cng_notifications add constraint cng_notifications_type_check CHECK ((type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'message'::text, 'mention'::text, 'system'::text])));
alter table public.cng_posts add constraint cng_posts_category_check CHECK ((category = ANY (ARRAY['travel'::text, 'nutrition'::text, 'store'::text, 'realestate'::text, 'candystakes'::text, 'online'::text, 'general'::text])));
alter table public.cng_posts add constraint cng_posts_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'story'::text])));
alter table public.cng_stories add constraint cng_stories_category_check CHECK ((category = ANY (ARRAY['travel'::text, 'nutrition'::text, 'store'::text, 'realestate'::text, 'candystakes'::text, NULL::text])));
alter table public.cng_stories add constraint cng_stories_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text])));

-- ===================== FOREIGN KEYS =====================
alter table public.cng_conversation_members add constraint cng_conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES cng_conversations(id) ON DELETE CASCADE;
alter table public.cng_conversation_members add constraint cng_conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_conversations add constraint cng_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_deleted_messages add constraint cng_deleted_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES cng_messages(id) ON DELETE CASCADE;
alter table public.cng_deleted_messages add constraint cng_deleted_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_follows add constraint cng_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_follows add constraint cng_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_message_reactions add constraint cng_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES cng_messages(id) ON DELETE CASCADE;
alter table public.cng_messages add constraint cng_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES cng_conversations(id) ON DELETE CASCADE;
alter table public.cng_messages add constraint cng_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES cng_messages(id) ON DELETE SET NULL;
alter table public.cng_messages add constraint cng_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_messages add constraint cng_messages_story_id_fkey FOREIGN KEY (story_id) REFERENCES cng_stories(id) ON DELETE SET NULL;
alter table public.cng_notifications add constraint cng_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_poll_votes add constraint cng_poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES cng_polls(id) ON DELETE CASCADE;
alter table public.cng_post_bookmarks add constraint cng_post_bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES cng_posts(id) ON DELETE CASCADE;
alter table public.cng_post_bookmarks add constraint cng_post_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_post_comments add constraint cng_post_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES cng_post_comments(id) ON DELETE CASCADE;
alter table public.cng_post_comments add constraint cng_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES cng_posts(id) ON DELETE CASCADE;
alter table public.cng_post_comments add constraint cng_post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_post_likes add constraint cng_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES cng_posts(id) ON DELETE CASCADE;
alter table public.cng_post_likes add constraint cng_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_posts add constraint cng_posts_member_id_fkey FOREIGN KEY (member_id) REFERENCES identity_profiles(id) ON DELETE SET NULL;
alter table public.cng_posts add constraint cng_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_starred_messages add constraint cng_starred_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES cng_messages(id) ON DELETE CASCADE;
alter table public.cng_stories add constraint cng_stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_story_reactions add constraint cng_story_reactions_story_id_fkey FOREIGN KEY (story_id) REFERENCES cng_stories(id) ON DELETE CASCADE;
alter table public.cng_story_reactions add constraint cng_story_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_story_replies add constraint cng_story_replies_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cng_story_replies add constraint cng_story_replies_story_id_fkey FOREIGN KEY (story_id) REFERENCES cng_stories(id) ON DELETE CASCADE;
alter table public.cng_story_views add constraint cng_story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES cng_stories(id) ON DELETE CASCADE;
alter table public.cng_story_views add constraint cng_story_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_presence add constraint user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ===================== INDICES =====================
CREATE INDEX idx_cng_conv_members_user ON public.cng_conversation_members USING btree (user_id);
CREATE INDEX idx_cng_conv_members_conv ON public.cng_conversation_members USING btree (conversation_id);
CREATE INDEX idx_cng_conversations_last_msg ON public.cng_conversations USING btree (last_message_at DESC);
CREATE INDEX idx_cng_deleted_messages_user ON public.cng_deleted_messages USING btree (user_id, message_id);
CREATE INDEX idx_cng_follows_follower ON public.cng_follows USING btree (follower_id);
CREATE INDEX idx_cng_follows_following ON public.cng_follows USING btree (following_id);
CREATE INDEX idx_reactions_message ON public.cng_message_reactions USING btree (message_id);
CREATE INDEX idx_reactions_user ON public.cng_message_reactions USING btree (user_id);
CREATE INDEX idx_cng_messages_sender ON public.cng_messages USING btree (sender_id);
CREATE INDEX idx_cng_messages_conv_created ON public.cng_messages USING btree (conversation_id, created_at DESC);
CREATE INDEX idx_messages_content_search ON public.cng_messages USING gin (to_tsvector('spanish'::regconfig, COALESCE(content, ''::text)));
CREATE INDEX idx_cng_notifications_user_unread ON public.cng_notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX idx_cng_post_bookmarks_user ON public.cng_post_bookmarks USING btree (user_id);
CREATE INDEX idx_cng_post_comments_created ON public.cng_post_comments USING btree (created_at);
CREATE INDEX idx_cng_post_comments_post ON public.cng_post_comments USING btree (post_id);
CREATE INDEX idx_cng_post_comments_user ON public.cng_post_comments USING btree (user_id);
CREATE INDEX idx_cng_post_comments_parent ON public.cng_post_comments USING btree (parent_comment_id) WHERE (parent_comment_id IS NOT NULL);
CREATE INDEX idx_cng_post_likes_post ON public.cng_post_likes USING btree (post_id);
CREATE INDEX idx_cng_post_likes_user ON public.cng_post_likes USING btree (user_id);
CREATE INDEX idx_cng_posts_user_id ON public.cng_posts USING btree (user_id);
CREATE INDEX idx_cng_posts_created ON public.cng_posts USING btree (created_at DESC);
CREATE INDEX idx_cng_posts_category ON public.cng_posts USING btree (category);
CREATE INDEX idx_cng_posts_active ON public.cng_posts USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_cng_posts_featured ON public.cng_posts USING btree (is_featured) WHERE (is_featured = true);
CREATE INDEX idx_starred_user ON public.cng_starred_messages USING btree (user_id);
CREATE INDEX idx_starred_conv ON public.cng_starred_messages USING btree (conversation_id);
CREATE INDEX idx_stories_user_expires ON public.cng_stories USING btree (user_id, expires_at DESC);
CREATE INDEX idx_stories_expires ON public.cng_stories USING btree (expires_at DESC);
CREATE INDEX idx_story_views_viewer ON public.cng_story_views USING btree (viewer_id);
CREATE INDEX idx_story_views_story ON public.cng_story_views USING btree (story_id);
CREATE INDEX idx_user_presence_last_seen ON public.user_presence USING btree (last_seen_at);

-- ===================== TRIGGERS (fieles, incluye duplicados de Matrix) =====================
CREATE TRIGGER on_new_message AFTER INSERT ON public.cng_messages FOR EACH ROW EXECUTE FUNCTION handle_new_message();
CREATE TRIGGER trg_cng_new_message AFTER INSERT ON public.cng_messages FOR EACH ROW EXECUTE FUNCTION fn_cng_new_message();
CREATE TRIGGER trg_cng_post_comments_dec AFTER DELETE ON public.cng_post_comments FOR EACH ROW EXECUTE FUNCTION fn_cng_post_comments_counter();
CREATE TRIGGER trg_cng_post_comments_inc AFTER INSERT ON public.cng_post_comments FOR EACH ROW EXECUTE FUNCTION fn_cng_post_comments_counter();
CREATE TRIGGER trg_comments_decrement AFTER DELETE ON public.cng_post_comments FOR EACH ROW EXECUTE FUNCTION fn_decrement_comments();
CREATE TRIGGER trg_comments_increment AFTER INSERT ON public.cng_post_comments FOR EACH ROW EXECUTE FUNCTION fn_increment_comments();
CREATE TRIGGER trg_cng_post_likes_dec AFTER DELETE ON public.cng_post_likes FOR EACH ROW EXECUTE FUNCTION fn_cng_post_likes_counter();
CREATE TRIGGER trg_cng_post_likes_inc AFTER INSERT ON public.cng_post_likes FOR EACH ROW EXECUTE FUNCTION fn_cng_post_likes_counter();
CREATE TRIGGER trg_likes_decrement AFTER DELETE ON public.cng_post_likes FOR EACH ROW EXECUTE FUNCTION fn_decrement_likes();
CREATE TRIGGER trg_likes_increment AFTER INSERT ON public.cng_post_likes FOR EACH ROW EXECUTE FUNCTION fn_increment_likes();
CREATE TRIGGER trg_cng_posts_updated_at BEFORE UPDATE ON public.cng_posts FOR EACH ROW EXECUTE FUNCTION fn_cng_set_updated_at();
CREATE TRIGGER trg_increment_story_likes AFTER INSERT OR DELETE ON public.cng_story_reactions FOR EACH ROW EXECUTE FUNCTION increment_story_likes();
CREATE TRIGGER trg_increment_story_views AFTER INSERT ON public.cng_story_views FOR EACH ROW EXECUTE FUNCTION increment_story_views();

-- ===================== RLS ENABLE =====================
alter table public.cng_posts enable row level security;
alter table public.cng_post_likes enable row level security;
alter table public.cng_post_comments enable row level security;
alter table public.cng_post_bookmarks enable row level security;
alter table public.cng_follows enable row level security;
alter table public.cng_conversations enable row level security;
alter table public.cng_conversation_members enable row level security;
alter table public.cng_messages enable row level security;
alter table public.cng_message_reactions enable row level security;
alter table public.cng_starred_messages enable row level security;
alter table public.cng_deleted_messages enable row level security;
alter table public.cng_blocked_users enable row level security;
alter table public.cng_reports enable row level security;
alter table public.cng_notifications enable row level security;
alter table public.cng_stories enable row level security;
alter table public.cng_story_views enable row level security;
alter table public.cng_story_replies enable row level security;
alter table public.cng_story_reactions enable row level security;
alter table public.cng_polls enable row level security;
alter table public.cng_poll_votes enable row level security;
alter table public.user_presence enable row level security;

-- ===================== POLITICAS (copiadas tal cual de Matrix) =====================
create policy "Blocked: user can delete own" on public.cng_blocked_users as PERMISSIVE for DELETE to authenticated using ((blocker_id = auth.uid()));
create policy "Blocked: user can insert own" on public.cng_blocked_users as PERMISSIVE for INSERT to authenticated with check ((blocker_id = auth.uid()));
create policy "Blocked: user can read own" on public.cng_blocked_users as PERMISSIVE for SELECT to authenticated using ((blocker_id = auth.uid()));
create policy conv_members_insert_any on public.cng_conversation_members as PERMISSIVE for INSERT to authenticated with check (true);
create policy conv_members_select_any on public.cng_conversation_members as PERMISSIVE for SELECT to authenticated using (true);
create policy conv_members_update_own on public.cng_conversation_members as PERMISSIVE for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy conversations_insert_any on public.cng_conversations as PERMISSIVE for INSERT to authenticated with check (true);
create policy conversations_select_any on public.cng_conversations as PERMISSIVE for SELECT to authenticated using (true);
create policy conversations_update_admin on public.cng_conversations as PERMISSIVE for UPDATE to public using (((admin_id = auth.uid()) OR (created_by = auth.uid()))) with check (((admin_id = auth.uid()) OR (created_by = auth.uid())));
create policy "Users can manage their own deleted messages" on public.cng_deleted_messages as PERMISSIVE for ALL to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy follows_delete_own on public.cng_follows as PERMISSIVE for DELETE to authenticated using ((auth.uid() = follower_id));
create policy follows_insert_own on public.cng_follows as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = follower_id));
create policy follows_select on public.cng_follows as PERMISSIVE for SELECT to authenticated using (true);
create policy "Reactions: authenticated can read" on public.cng_message_reactions as PERMISSIVE for SELECT to authenticated using (true);
create policy "Reactions: user can delete own" on public.cng_message_reactions as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Reactions: user can insert own" on public.cng_message_reactions as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Conversation members can update message status" on public.cng_messages as PERMISSIVE for UPDATE to public using ((conversation_id IN ( SELECT cng_conversation_members.conversation_id FROM cng_conversation_members WHERE (cng_conversation_members.user_id = auth.uid())))) with check ((conversation_id IN ( SELECT cng_conversation_members.conversation_id FROM cng_conversation_members WHERE (cng_conversation_members.user_id = auth.uid()))));
create policy "Messages: sender can delete own" on public.cng_messages as PERMISSIVE for DELETE to authenticated using ((sender_id = auth.uid()));
create policy "Messages: sender can update own" on public.cng_messages as PERMISSIVE for UPDATE to authenticated using ((sender_id = auth.uid())) with check ((sender_id = auth.uid()));
create policy messages_insert_member on public.cng_messages as PERMISSIVE for INSERT to authenticated with check (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1 FROM cng_conversation_members WHERE ((cng_conversation_members.conversation_id = cng_messages.conversation_id) AND (cng_conversation_members.user_id = auth.uid()))))));
create policy messages_select_member on public.cng_messages as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1 FROM cng_conversation_members WHERE ((cng_conversation_members.conversation_id = cng_messages.conversation_id) AND (cng_conversation_members.user_id = auth.uid())))));
create policy notifications_select_own on public.cng_notifications as PERMISSIVE for SELECT to authenticated using ((auth.uid() = user_id));
create policy notifications_update_own on public.cng_notifications as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Votes: authenticated can read" on public.cng_poll_votes as PERMISSIVE for SELECT to authenticated using (true);
create policy "Votes: user can delete own" on public.cng_poll_votes as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Votes: user can insert own" on public.cng_poll_votes as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Polls: authenticated can read" on public.cng_polls as PERMISSIVE for SELECT to authenticated using (true);
create policy "Polls: creator can insert" on public.cng_polls as PERMISSIVE for INSERT to authenticated with check ((creator_id = auth.uid()));
create policy post_bookmarks_delete_own on public.cng_post_bookmarks as PERMISSIVE for DELETE to authenticated using ((auth.uid() = user_id));
create policy post_bookmarks_insert_own on public.cng_post_bookmarks as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = user_id));
create policy post_bookmarks_select_own on public.cng_post_bookmarks as PERMISSIVE for SELECT to authenticated using ((auth.uid() = user_id));
create policy post_comments_delete_own on public.cng_post_comments as PERMISSIVE for DELETE to authenticated using ((auth.uid() = user_id));
create policy post_comments_insert_authenticated on public.cng_post_comments as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = user_id));
create policy post_comments_select on public.cng_post_comments as PERMISSIVE for SELECT to authenticated using (true);
create policy post_comments_update_own on public.cng_post_comments as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy post_likes_delete_own on public.cng_post_likes as PERMISSIVE for DELETE to authenticated using ((auth.uid() = user_id));
create policy post_likes_insert_own on public.cng_post_likes as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = user_id));
create policy post_likes_select on public.cng_post_likes as PERMISSIVE for SELECT to authenticated using (true);
create policy posts_delete_own on public.cng_posts as PERMISSIVE for DELETE to authenticated using ((auth.uid() = user_id));
create policy posts_insert_own on public.cng_posts as PERMISSIVE for INSERT to authenticated with check ((auth.uid() = user_id));
create policy posts_select_authenticated on public.cng_posts as PERMISSIVE for SELECT to authenticated using ((is_active = true));
create policy posts_update_own on public.cng_posts as PERMISSIVE for UPDATE to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Reports: user can insert own" on public.cng_reports as PERMISSIVE for INSERT to authenticated with check ((reporter_id = auth.uid()));
create policy "Reports: user can read own" on public.cng_reports as PERMISSIVE for SELECT to authenticated using ((reporter_id = auth.uid()));
create policy "Starred: user can delete own" on public.cng_starred_messages as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Starred: user can insert own" on public.cng_starred_messages as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Starred: user can read own" on public.cng_starred_messages as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));
create policy "Stories: anyone can read active" on public.cng_stories as PERMISSIVE for SELECT to authenticated using ((expires_at > now()));
create policy "Stories: owner can delete" on public.cng_stories as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Stories: owner can insert" on public.cng_stories as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Stories: owner delete" on public.cng_stories as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Stories: owner insert" on public.cng_stories as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Stories: read active" on public.cng_stories as PERMISSIVE for SELECT to authenticated using ((expires_at > now()));
create policy "Reactions: delete own" on public.cng_story_reactions as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Reactions: insert own" on public.cng_story_reactions as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Reactions: read all" on public.cng_story_reactions as PERMISSIVE for SELECT to authenticated using (true);
create policy "Story reactions: anyone can read" on public.cng_story_reactions as PERMISSIVE for SELECT to authenticated using (true);
create policy "Story reactions: authenticated can insert" on public.cng_story_reactions as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
create policy "Story reactions: owner can delete" on public.cng_story_reactions as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
create policy "Replies: insert own" on public.cng_story_replies as PERMISSIVE for INSERT to authenticated with check ((sender_id = auth.uid()));
create policy "Replies: read relevant" on public.cng_story_replies as PERMISSIVE for SELECT to authenticated using (((story_id IN ( SELECT cng_stories.id FROM cng_stories WHERE (cng_stories.user_id = auth.uid()))) OR (sender_id = auth.uid())));
create policy "Story replies: sender can insert" on public.cng_story_replies as PERMISSIVE for INSERT to authenticated with check ((sender_id = auth.uid()));
create policy "Story replies: story owner can read" on public.cng_story_replies as PERMISSIVE for SELECT to authenticated using (((story_id IN ( SELECT cng_stories.id FROM cng_stories WHERE (cng_stories.user_id = auth.uid()))) OR (sender_id = auth.uid())));
create policy "Story views: authenticated can insert" on public.cng_story_views as PERMISSIVE for INSERT to authenticated with check ((viewer_id = auth.uid()));
create policy "Story views: story owner can read" on public.cng_story_views as PERMISSIVE for SELECT to authenticated using ((story_id IN ( SELECT cng_stories.id FROM cng_stories WHERE (cng_stories.user_id = auth.uid()))));
create policy "Views: insert own" on public.cng_story_views as PERMISSIVE for INSERT to authenticated with check ((viewer_id = auth.uid()));
create policy "Views: owner reads" on public.cng_story_views as PERMISSIVE for SELECT to authenticated using (((story_id IN ( SELECT cng_stories.id FROM cng_stories WHERE (cng_stories.user_id = auth.uid()))) OR (viewer_id = auth.uid())));
create policy "Anyone authenticated can read presence" on public.user_presence as PERMISSIVE for SELECT to public using (true);
create policy "Users can update their own presence" on public.user_presence as PERMISSIVE for INSERT to public with check ((user_id = auth.uid()));
create policy "Users can update their own presence row" on public.user_presence as PERMISSIVE for UPDATE to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- ===================== GRANTS (fieles a Matrix: default amplio Supabase) =====================
grant delete, insert, references, select, trigger, truncate, update on public.cng_posts to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_post_likes to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_post_comments to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_post_bookmarks to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_follows to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_conversations to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_conversation_members to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_messages to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_message_reactions to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_starred_messages to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_deleted_messages to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_blocked_users to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_reports to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_notifications to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_stories to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_story_views to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_story_replies to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_story_reactions to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_polls to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.cng_poll_votes to anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.user_presence to anon, authenticated, service_role;

-- ===================== REALTIME (fiel a Matrix) =====================
alter publication supabase_realtime add table public.cng_messages;
alter publication supabase_realtime add table public.cng_message_reactions;
alter publication supabase_realtime add table public.cng_notifications;
alter publication supabase_realtime add table public.cng_polls;
alter publication supabase_realtime add table public.cng_poll_votes;
