-- anon read-only — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- Revoca INSERT y UPDATE de anon en las 20 tablas cng_* + user_presence.
-- NO toca SELECT (catalogo marketplace y lectura publica social intactos).
-- NO toca authenticated ni service_role. DELETE/TRUNCATE ya fueron revocados antes.
REVOKE INSERT, UPDATE ON TABLE
  public.cng_blocked_users,
  public.cng_conversation_members,
  public.cng_conversations,
  public.cng_deleted_messages,
  public.cng_follows,
  public.cng_message_reactions,
  public.cng_messages,
  public.cng_notifications,
  public.cng_poll_votes,
  public.cng_polls,
  public.cng_post_bookmarks,
  public.cng_post_comments,
  public.cng_post_likes,
  public.cng_posts,
  public.cng_reports,
  public.cng_starred_messages,
  public.cng_stories,
  public.cng_story_reactions,
  public.cng_story_replies,
  public.cng_story_views,
  public.user_presence
FROM anon;
