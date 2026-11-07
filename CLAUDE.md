# Instrucciones para Claude Code — Chill N Go

## Reglas operativas obligatorias

### 1. NO usar worktrees de Git
NUNCA crear worktrees bajo `.claude/worktrees/` ni en ningún otro lado.
Trabajar siempre directamente en la carpeta principal del proyecto,
en la rama `main`.

Si estás tentado a usar `git worktree add` para separar tareas, en su
lugar pregunta al usuario cómo prefiere proceder.

### 2. Cambios quirúrgicos y revisables
Cada fix debe ser:
- Alcance mínimo (solo lo pedido, nada más)
- Mostrar el diff propuesto ANTES de aplicarlo
- Esperar confirmación explícita del usuario antes de escribir archivos

### 3. Contexto de negocio
El usuario es Oscar Jovani, CEO de Chill N Go International LLC.
Chilliums son un programa de lealtad (NO dinero), valor interno 1:1 USD
pero NUNCA mostrado así al usuario final.

### 4. Recompensas (Chilliums) — modelo vigente
Antes de tocar código relacionado con Chilliums, webhooks de pago, o el
reparto de recompensas, ten presente el modelo vigente: reparto 50/50 —
mitad para el comprador, mitad para quien lo invitó directo (2 niveles:
nivel 0 comprador, nivel 1 invitador directo). El diseño anterior de
50/35/15 (etapa Stripe) quedó OFICIALMENTE MUERTO.

## Arquitectura

- **Supabase:** `osbsbrpdwjstvafhzjjj` = Chill n Go International (producción nueva, us-east-1). `jahnlhzbjcbmjnuzxsvj` = Chill n Go Matrix: **NO TOCAR** salvo instrucción explícita. Confirmar el project_id antes de aplicar migraciones o cambios de BD.
- **Repo:** frontend React/Vite (Vercel, www.chillngointernational.com); edge functions `cng-*` en `supabase/functions/` (compartidos en `_shared/`); migraciones en `supabase/migrations/`.
- **Membresía (Mercado Pago, 140 MXN/mes):** `cng-mp-create-subscription` usa Card Payment Brick (card_token) + `POST /preapproval` enganchado al plan guardado en `platform_config.membership_plan_id`, con `external_reference=user.id`. `cng-mp-webhook` mapea al usuario por `external_reference`; la activación pasa por `rpc_apply_mp_subscription_event` (idempotente). Índice único `subscriptions_one_active_per_user`. Consentimientos en `payment_consents`.
- **Activación:** el muro `/activate` pide PAGO → VERIFICACIÓN (Verificamex: INE + CURP + selfie). `membership_status='active'` solo si (pagado O `membership_override`) **Y** `identity_verification_status='verified'`; lo calcula `_recompute_membership(user_id)`, que llaman `cng-mp-webhook` y `cng-verificamex-webhook`. El pago solo ya no activa.
- **Verificamex:** `cng-create-identity-verification` exige pago previo, máx. 3 intentos y anti-duplicado fail-closed (índice `uq_idv_one_in_progress`). El webhook no trae firma → siempre re-consultar la sesión por GET. Los booleanos van en `data.ine.data.result.status` y `data.renapo.data.result.status` (con `.result`). No se guardan imágenes, solo resultado + CURP. El redirect va siempre a `SITE_URL`, nunca al origin del request.
- **Vendedores (GoShop):** vender NO requiere membresía, requiere verificación de vendedor. Tablas `sellers`, `seller_fiscal_data`, `seller_verification_payments`; persona física o empresa; cuota de 249/499 MXN que cubre 3 intentos (`cng-mp-create-seller-fee` + `cng-mp-seller-fee-webhook` → `rpc_apply_seller_fee_payment`). El INE se comparte a nivel persona (no se re-cobra). Alta pública en `/vender` (`cng-seller-signup`, `cng-create-seller-verification`). Bucket privado `cng-fiscal` para constancias.
- **Tiendas y admin:** una tienda por vendedor. Aprobación en `/admin` → `cng-admin-store-decision` → `rpc_admin_decide_store` (atómico, registra `store_moderation`). Admin = `platform_roles` (platform `cng_store`, role `admin`), separado de la membresía; helper `cng_is_admin`. Página pública `/tienda/:slug`.
- **Productos:** 1 `listing` + 1 variante default oculta (precio/stock y peso/dimensiones en `listing_variants`) + imágenes en el bucket `cng-store-assets`. Se escribe con `rpc_upsert_product` (SECURITY INVOKER: la RLS de dueño gatea). `listings.status` ∈ draft/active/suspended. Pantallas `/mi-tienda/productos`, `/mi-tienda/ventas`, `/producto/:id`.
- **GoShop:** vista unificada en `/app/explore` (`MarketplaceScreen.jsx`); los LOBs (`store, store_local, nutrition, real_estate, travel`) son filtros. Travel es contenido fijo de frontend (`TravelShowcase.jsx`) y el link de Expedia TAAP solo se entrega a miembros activos.
- **Checkout y payout (sandbox; `platform_config.checkout_live=false`):** `cng-mp-create-order` + `cng-mp-order-webhook` (2ª integración MP; tokens `MP_CHECKOUT_ACCESS_TOKEN` / `MP_CHECKOUT_ACCESS_TOKEN_LIVE`), envío con Envia (`cng-shipping-quote`, `_shared/envia-rate.ts`) y `cng-mark-shipped`. RPCs C-6: `rpc_mark_shipped`, `rpc_mark_delivered`, `rpc_release_order_payout`, `rpc_buyer_confirm_receipt`, `rpc_refund_order`; tesoro `platform_treasury` + `treasury_ledger`. C-5: `rpc_award_order_chilliums` (no fatal dentro del release) + `rpc_retry_pending_chilliums`. pg_cron: `cng-auto-release-payouts` (08:07 UTC) y `cng-retry-chilliums` (08:17 UTC). Todas son SECURITY DEFINER, solo service_role, y los ids son `identity_profiles.id`.
- **Chilliums:** `apply_chilliums(...)` es el primitivo atómico de UN usuario (soporta débito). El invitador directo vive en `identity_profiles.referred_by`.

## Reglas del proyecto

- **NUNCA** dar `GRANT UPDATE` a nivel de tabla a `authenticated` en `identity_profiles`: permitía auto-activarse, auto-verificarse y regalarse Chilliums. El UPDATE del cliente va restringido por columna.
- Toda tabla nueva con `revoke all ... from public` necesita `grant` explícito a `service_role` de lo que use un edge: service_role se salta la RLS pero NO los GRANTs, y la query falla en silencio (`data: null`). Ya pasó con `seller_addresses` y `shipping_carriers`.
- Tablas sensibles (fiscales, pagos, estados de verificación): sin policy de escritura para el cliente; solo escriben edge functions/RPCs con service_role.
- Webhooks de MP: validar el HMAC `x-signature` con `MP_WEBHOOK_SECRET`, re-consultar el recurso en MP (nunca confiar en el payload), aplicar con un RPC atómico e idempotente y devolver 500 para que MP reintente. Membresía, cuota de vendedor y compras usan funciones e idempotencia **separadas** (regla dura).
- Los kill-switches `checkout_live` y `shipping_live` se leen fail-closed (`=== true`; null/error = sandbox). No encender dinero real sin instrucción explícita.
- `rpc_apply_identity_verification` marca verified solo con `status='FINISHED'`, `result=100` e INE y RENAPO en true: no debilitarlo.
- Las columnas del wizard en `identity_profiles` (nombres, fecha de nacimiento, teléfono, dirección, `accepted_*`) son NULLABLE porque los altas crean perfiles parciales: preservarlo y no reportar "NOT NULL blocker" sin re-verificar `information_schema.columns`.
- En altas desde edge, poner `membership_status='pending'` explícito (el default de la columna es `'active'`).
- No consultar Verificamex en ráfaga desde el entorno local (límite 30 req/min por endpoint; el rate-limit por IP produjo 401 falsos). Probar E2E desde la URL pública.

## Decisiones

- La membresía (140 MXN/mes por MP) **no reparte Chilliums**; el modelo de la etapa Stripe de los documentos viejos no aplica.
- Chilliums en compras: se **acuñan al liberar** la orden (no al pagar), sin clawback. El 70% de la comisión se acuña (`platform_config.chilliums_reward_pct`, default 70) y el 30% queda para la empresa; ese pool se reparte 50/50 fijo entre comprador (nivel 0) e invitador directo (nivel 1); sin invitador, y los redondeos, van al tesoro. 1 Chillium = 1 peso de comisión.
- Cobrar antes de verificar identidad (la verificación cuesta tokens). Las cuentas fundador/activas previas quedaron grandfathered como verified.
- Abrir tienda depende de ser vendedor verificado; los productos se publican al instante (sin aprobación por producto).
- Órdenes mono-ítem / mono-origen. CFDI y retenciones al SAT quedan fuera por ahora (la estructura fiscal ya existe).

## Referencias operativas

- Correo de soporte: contact@chillngointernational.com. Tienda de prueba viva: DealNorte (`/tienda/dealnorte`).
- Secrets (solo nombres): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_CHECKOUT_ACCESS_TOKEN`, `MP_CHECKOUT_ACCESS_TOKEN_LIVE`, `VERIFICAMEX_ACCESS_TOKEN`, `SITE_URL`, `ENVIA_TOKEN_TEST`; frontend `VITE_MP_PUBLIC_KEY`.
- Mercado Pago MX: una suscripción enganchada a un plan EXIGE `card_token_id` (no hay flujo hospedado pending). `account_money` no se puede excluir; la tarjeta se excluye por preference con `payment_methods.excluded_payment_types`. Los pagos no inmediatos (SPEI/OXXO) se confirman por webhook + `GET /v1/payments/{id}`, nunca por el redirect.
- La cuota de vendedor usa el `MP_ACCESS_TOKEN` de producción: las tarjetas de prueba requieren credenciales TEST aparte.
- Envia: `/ship/generate/` cobra saldo (cotizar es gratis) y no acepta Idempotency-Key.

## Pendientes

- **E-6 (guía Envia):** las migraciones `20260628120000_e6_label_foundation.sql` y `20260628140000_e6_label_claim_lock.sql` (`orders.label_state` y snapshots, `platform_config.shipping_live`, `rpc_claim_label`/`rpc_release_label`) se aplicaron a prod pero **no están en el repo**; el snapshot de origen/paquete en `cng-mp-create-order` también se desplegó sin commit. Hay que versionarlos. Falta el edge `cng-generate-label` (claim → Envia → `rpc_mark_shipped` / `rpc_release_label`), el botón "Generar guía" en `MisVentas.jsx` y que `rpc_mark_shipped` ponga `label_state='generated'`.
- Encender el checkout real: el retiro al banco del vendedor y el reembolso real en MP siguen gated por legal (`checkout_live=false`).
- `cng-validate-rfc` (el paso RFC en `/vender` dice "Próximamente").
- Búsqueda IA con DeepSeek en GoShop (hoy es por texto).
- Si se quiere un `suspended` de admin no revertible por el vendedor, blindar `listings.status` (column-grant o RPC admin).
- Diseñar el lado de **gasto** de Chilliums (aún no existe dónde canjearlos).
- Aclarar el valor del Chillium: C-5 acuña 1 Chillium por cada peso de comisión, mientras que la regla 3 dice valor interno 1:1 USD.
