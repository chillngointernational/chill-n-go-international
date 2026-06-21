-- anon revoke messaging SELECT — proyecto osbsbrpdwjstvafhzjjj (Chill n Go International)
-- Defensa en profundidad: quita el SELECT de anon en las tablas de mensajeria privada.
-- RLS ya estaba habilitado y sin politica SELECT que incluyera a anon; esto ademas
-- lo bloquea a nivel de privilegio. NO toca authenticated ni service_role.
-- NO toca feed/posts/stories ni el catalogo del marketplace (SELECT de anon intacto ahi).
-- Idempotente: REVOKE de un privilegio inexistente es no-op.
REVOKE SELECT ON TABLE
  public.cng_messages,
  public.cng_conversations,
  public.cng_conversation_members,
  public.cng_notifications,
  public.cng_blocked_users,
  public.cng_starred_messages,
  public.cng_deleted_messages
FROM anon;
