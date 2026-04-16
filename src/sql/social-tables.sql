-- ============================================================
-- CHILL N GO INTERNATIONAL — Social Media Core
-- Supabase SQL · Designed for millions of users
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. POSTS (feed content)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_posts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  member_id      uuid        REFERENCES identity_profiles (id) ON DELETE SET NULL,
  media_url      text,
  media_type     text        DEFAULT 'image'
                             CHECK (media_type IN ('image', 'video', 'story')),
  thumbnail_url  text,
  caption        text,
  category       text        DEFAULT 'general'
                             CHECK (category IN (
                               'travel', 'nutrition', 'store',
                               'realestate', 'candystakes', 'online', 'general'
                             )),
  location_name  text,
  location_lat   decimal,
  location_lng   decimal,
  likes_count    integer     DEFAULT 0,
  comments_count integer     DEFAULT 0,
  bookmarks_count integer    DEFAULT 0,
  shares_count   integer     DEFAULT 0,
  is_featured    boolean     DEFAULT false,
  is_active      boolean     DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_cng_posts_user_id    ON cng_posts (user_id);
CREATE INDEX idx_cng_posts_category   ON cng_posts (category);
CREATE INDEX idx_cng_posts_created    ON cng_posts (created_at DESC);
CREATE INDEX idx_cng_posts_active     ON cng_posts (is_active) WHERE is_active = true;
CREATE INDEX idx_cng_posts_featured   ON cng_posts (is_featured) WHERE is_featured = true;

-- ────────────────────────────────────────────────────────────
-- 2. POST LIKES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_post_likes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES cng_posts (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX idx_cng_post_likes_post ON cng_post_likes (post_id);
CREATE INDEX idx_cng_post_likes_user ON cng_post_likes (user_id);

-- ────────────────────────────────────────────────────────────
-- 3. POST COMMENTS (with nested replies)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_post_comments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid        NOT NULL REFERENCES cng_posts (id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content           text        NOT NULL,
  parent_comment_id uuid        REFERENCES cng_post_comments (id) ON DELETE CASCADE,
  likes_count       integer     DEFAULT 0,
  is_active         boolean     DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_cng_post_comments_post    ON cng_post_comments (post_id);
CREATE INDEX idx_cng_post_comments_user    ON cng_post_comments (user_id);
CREATE INDEX idx_cng_post_comments_created ON cng_post_comments (created_at);
CREATE INDEX idx_cng_post_comments_parent  ON cng_post_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. POST BOOKMARKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_post_bookmarks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES cng_posts (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX idx_cng_post_bookmarks_user ON cng_post_bookmarks (user_id);

-- ────────────────────────────────────────────────────────────
-- 5. FOLLOWS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_follows (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  following_id uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX idx_cng_follows_follower  ON cng_follows (follower_id);
CREATE INDEX idx_cng_follows_following ON cng_follows (following_id);

-- ────────────────────────────────────────────────────────────
-- 6. CONVERSATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_conversations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                 text        DEFAULT 'direct'
                                   CHECK (type IN ('direct', 'group')),
  name                 text,
  created_by           uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  last_message_at      timestamptz DEFAULT now(),
  last_message_preview text,
  is_active            boolean     DEFAULT true,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_cng_conversations_last_msg ON cng_conversations (last_message_at DESC);

-- ────────────────────────────────────────────────────────────
-- 7. CONVERSATION MEMBERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_conversation_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES cng_conversations (id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role            text        DEFAULT 'member'
                              CHECK (role IN ('member', 'admin')),
  unread_count    integer     DEFAULT 0,
  last_read_at    timestamptz,
  joined_at       timestamptz DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_cng_conv_members_user ON cng_conversation_members (user_id);
CREATE INDEX idx_cng_conv_members_conv ON cng_conversation_members (conversation_id);

-- ────────────────────────────────────────────────────────────
-- 8. MESSAGES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES cng_conversations (id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content         text,
  message_type    text        DEFAULT 'text'
                              CHECK (message_type IN (
                                'text', 'image', 'video', 'voice', 'location', 'system'
                              )),
  media_url       text,
  reply_to_id     uuid        REFERENCES cng_messages (id) ON DELETE SET NULL,
  is_edited       boolean     DEFAULT false,
  is_deleted      boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_cng_messages_conv_created ON cng_messages (conversation_id, created_at DESC);
CREATE INDEX idx_cng_messages_sender       ON cng_messages (sender_id);

-- ────────────────────────────────────────────────────────────
-- 9. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cng_notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type       text        NOT NULL
                         CHECK (type IN (
                           'like', 'comment', 'follow', 'message', 'mention', 'system'
                         )),
  title      text,
  body       text,
  data       jsonb       DEFAULT '{}'::jsonb,
  is_read    boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cng_notifications_user_unread
  ON cng_notifications (user_id, is_read, created_at DESC);


-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- ── updated_at auto-touch ───────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cng_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cng_posts_updated_at
  BEFORE UPDATE ON cng_posts
  FOR EACH ROW EXECUTE FUNCTION fn_cng_set_updated_at();

-- ── Likes counter ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cng_post_likes_counter()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cng_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cng_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cng_post_likes_inc
  AFTER INSERT ON cng_post_likes
  FOR EACH ROW EXECUTE FUNCTION fn_cng_post_likes_counter();

CREATE TRIGGER trg_cng_post_likes_dec
  AFTER DELETE ON cng_post_likes
  FOR EACH ROW EXECUTE FUNCTION fn_cng_post_likes_counter();

-- ── Comments counter ────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_cng_post_comments_counter()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cng_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cng_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cng_post_comments_inc
  AFTER INSERT ON cng_post_comments
  FOR EACH ROW EXECUTE FUNCTION fn_cng_post_comments_counter();

CREATE TRIGGER trg_cng_post_comments_dec
  AFTER DELETE ON cng_post_comments
  FOR EACH ROW EXECUTE FUNCTION fn_cng_post_comments_counter();

-- ── New message → update conversation + unread counts ───────
CREATE OR REPLACE FUNCTION fn_cng_new_message()
RETURNS trigger AS $$
BEGIN
  -- Update conversation metadata
  UPDATE cng_conversations
  SET last_message_at      = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;

  -- Increment unread for every member except sender
  UPDATE cng_conversation_members
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id <> NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cng_new_message
  AFTER INSERT ON cng_messages
  FOR EACH ROW EXECUTE FUNCTION fn_cng_new_message();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- ── cng_posts ───────────────────────────────────────────────
ALTER TABLE cng_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_authenticated"
  ON cng_posts FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "posts_insert_own"
  ON cng_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_own"
  ON cng_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete_own"
  ON cng_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── cng_post_likes ──────────────────────────────────────────
ALTER TABLE cng_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_likes_select"
  ON cng_post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "post_likes_insert_own"
  ON cng_post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_likes_delete_own"
  ON cng_post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── cng_post_comments ───────────────────────────────────────
ALTER TABLE cng_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_comments_select"
  ON cng_post_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "post_comments_insert_authenticated"
  ON cng_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_update_own"
  ON cng_post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_comments_delete_own"
  ON cng_post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── cng_post_bookmarks ──────────────────────────────────────
ALTER TABLE cng_post_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_bookmarks_select_own"
  ON cng_post_bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "post_bookmarks_insert_own"
  ON cng_post_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_bookmarks_delete_own"
  ON cng_post_bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── cng_follows ─────────────────────────────────────────────
ALTER TABLE cng_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select"
  ON cng_follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "follows_insert_own"
  ON cng_follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete_own"
  ON cng_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- ── cng_conversations ───────────────────────────────────────
ALTER TABLE cng_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_member"
  ON cng_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cng_conversation_members
      WHERE conversation_id = cng_conversations.id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "conversations_insert_authenticated"
  ON cng_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- ── cng_conversation_members ────────────────────────────────
ALTER TABLE cng_conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_members_select"
  ON cng_conversation_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cng_conversation_members cm
      WHERE cm.conversation_id = cng_conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

-- ── cng_messages ────────────────────────────────────────────
ALTER TABLE cng_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_member"
  ON cng_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cng_conversation_members
      WHERE conversation_id = cng_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert_member"
  ON cng_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM cng_conversation_members
      WHERE conversation_id = cng_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- ── cng_notifications ───────────────────────────────────────
ALTER TABLE cng_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON cng_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON cng_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cng_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE cng_notifications;


-- ============================================================
-- DONE ✓  Social Media Core ready for Chill N Go International
-- ============================================================
