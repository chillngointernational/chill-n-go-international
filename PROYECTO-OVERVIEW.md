# PROYECTO-OVERVIEW — Chill N Go International

> **Auditoría técnica de solo lectura** (no se modificó código de la app).
> **Fecha:** 2026-06-20 · **Rama auditada:** `compliance-pass` · **Proyecto Supabase:** `jahnlhzbjcbmjnuzxsvj` ("Chill n Go Matrix").
> **Método:** lectura directa del repo + exploración multi-agente por subsistema + introspección **en vivo** de la base de datos vía Supabase MCP (`execute_sql`, `list_edge_functions`, `get_advisors`).
> **Objetivo de contexto (NO implementado aquí):** preparar la base para una futura tienda de ropa de inventario central, marca blanca (white-label), con varios revendedores y vitrinas por subdominio/dominio.

---

## Nota metodológica y correcciones clave

Durante la auditoría se verificó la base de datos en vivo y se **corrigieron dos hallazgos automáticos erróneos** y se resolvieron varios "drift" que solo eran confirmables consultando Supabase:

1. **SÍ existen foreign keys (216 en total, 54 en tablas `cng_*`).** Un primer barrido reportó "0 FKs / sin integridad referencial"; era un **artefacto de query** (comparó `pg_constraint.contype='F'` en mayúscula cuando Postgres almacena `'f'` minúscula). La integridad referencial **sí está declarada en la base** (ver §4).
2. **El programa de lealtad "banking-grade" SÍ está desplegado en la base** (FKs `ON DELETE RESTRICT` en `chilliums_ledger`, RPC `apply_chilliums(bigint, …)`), aunque el **código del webhook commiteado en la rama** (`supabase/functions/cng-stripe-webhook/index.ts`) es una **revisión anterior** que no usa esa RPC (ver §7 y §12).
3. **Las "funciones fantasma" sí están desplegadas.** `cng-create-portal` y `cng-issue-welcome-session` existen en Supabase aunque su código no está (completo) en la rama; y varias funciones CNG se **desplegaron desde un worktree** local (`.claude/worktrees/…`), lo que CLAUDE.md prohíbe (ver §7 y §9).
4. **Existe una tabla de roles real (`platform_roles`)** que un primer análisis no había cruzado; cambia la conclusión sobre el sistema de roles (ver §6).

---

## 1. Resumen del proyecto

**Chill N Go International** es una aplicación web (SPA React 19.2 + Vite 8 + React Router 7, **sin TypeScript**) propiedad de **Chill N Go International LLC**. El nombre de paquete es `chill-n-go-international` (`package.json`) y el `<title>` de `index.html` es "Chill N Go International". Backend en **Supabase** (Postgres 17.6 + Auth + Storage bucket `cng-media` + Edge Functions Deno), pagos/KYC vía **Stripe** (Checkout hospedado + Stripe Identity; `index.html` carga `https://js.stripe.com/dahlia/stripe.js`), frontend desplegado en **Vercel**.

Es una **super-app de membresía** con dos capas que hoy conviven en tensión en el repo:

- **Capa social verificada (lo más construido y maduro):** feed tipo TikTok, mensajería casi-WhatsApp, stories, red de referidos. Toda con backend real en Supabase.
- **Capa marketplace de 5 categorías (aspiracional):** Travel, Nutrition, Real Estate, Store (online) y Store Local. Hoy son **maquetas estáticas con datos hardcodeados**, sin backend ni checkout real.

El producto se monetiza con la **membresía CNG+** y opera una economía interna de lealtad llamada **Chilliums**.

### Propuesta de valor al usuario (`src/pages/Landing.jsx`)

La landing pública, recién rediseñada en clave legal (commit `3eb5936`, rama `compliance-pass`), vende un **marketplace con recompensas**, no una red social. Estructura:

- **Membresía CNG+ a $7 USD/mes** (`/join`), renovable y cancelable.
- **Cinco categorías** (`LOBS`): Travel, Nutrition, Real Estate, Store, Online, con "precios de socio".
- **Chilliums** como "saldo de recompensas" (cashback por compra y por referidos).
- **Referidos de UN SOLO nivel**, recompensa solo sobre compras reales ("nunca por inscribir gente").
- Texto legal `LEGAL` verbatim: Chilliums no son dinero / no retirables / no transferibles; referidos de un nivel financiados por la comisión de CNG; "no es inversión ni esquema de ingresos"; acceso "por invitación".

### Contradicción documentada (landing legal ↔ código ↔ doc de arquitectura)

El documento `CNG_PLUS_ARCHITECTURE.md` (v1.1, 19-abr-2026) describe un producto **distinto y anterior**: una "red social verificada con membresía" tipo TikTok, **$10 primer mes + $7/mes**, y reparto **50/35/15 a 2 niveles de upline**. La landing de cumplimiento dice **$7 y 1 nivel**. **El código vivo coincide con el doc, NO con la landing** (ver §7 y §12 — es el hallazgo de compliance central):

| Dimensión | `CNG_PLUS_ARCHITECTURE.md` | Código vivo (webhook/checkout) | `Landing.jsx` (compliance) |
|---|---|---|---|
| Producto | Red social verificada | Membresía + reparto Chilliums | Marketplace de 5 categorías |
| Precio | $10 primer mes + $7/mes | **$10 activación + $7/mes (trial 30d)** | $7/mes |
| Niveles de cashback | L0 50% / L1 35% / L2 15% | **L0 50% / L1 35% / L2 15%** | 1 solo nivel |

### Rol de Chilliums y de la membresía

- **CNG+** = única fuente de ingreso recurrente y llave de acceso al ecosistema.
- **Chilliums** = programa de lealtad (NO dinero). Internamente 1 Chillium = 1 USD para contabilidad, **nunca mostrado así al usuario**. Persistidos como **centi-chilliums (`bigint`), 1 CHL = 100 centi**, vía la RPC `apply_chilliums` (`SECURITY DEFINER`, lock `FOR UPDATE`); display con `src/lib/chilliums.js::formatChilliums`. Columnas en `identity_profiles.chilliums_balance/_total_earned/_total_spent` y tabla `chilliums_ledger`.

### Modelo de negocio / red

Programa de **referidos de afiliados con cashback**, estructurado deliberadamente para **no ser MLM/piramidal**. La regla legal explícita es: recompensas financiadas por la comisión de CNG sobre ventas reales, no por reclutar. (El "1 nivel" de la landing y el "2 niveles" del motor de pago aún no están conciliados — §12.)

---

## 2. Stack tecnológico

ESM puro (`"type": "module"`). Frontend React/Vite; backend serverless Supabase Edge Functions (Deno) + Postgres. `vite.config.js` es mínimo (solo `plugins: [react()]`).

### Frontend (producción) — versión declarada / resuelta (`package-lock.json`)

| Paquete | Declarada | Resuelta | Uso |
|---|---|---|---|
| `react` | `^19.2.4` | `19.2.4` | UI base |
| `react-dom` | `^19.2.4` | `19.2.4` | Render web |
| `react-router-dom` | `^7.14.0` | `7.14.0` | Ruteo SPA |
| `@supabase/supabase-js` | `^2.101.1` | `2.101.1` | Cliente Supabase (auth, DB, RPC, storage, realtime) |
| `emoji-mart` | `^5.6.0` | `5.6.0` | Picker de emojis (chat) |
| `@emoji-mart/data` | `^1.2.1` | `1.2.1` | Dataset de emojis |
| `@emoji-mart/react` | `^1.1.1` | `1.1.1` | Componente React del picker |

### Tooling (devDependencies)

| Paquete | Declarada | Resuelta | Uso |
|---|---|---|---|
| `vite` | `^8.0.1` | `8.0.3` | Bundler / dev server |
| `@vitejs/plugin-react` | `^6.0.1` | `6.0.1` | Plugin React (Fast Refresh/JSX) |
| `eslint` | `^9.39.4` | `9.39.4` | Linter (flat config) |
| `@eslint/js` | `^9.39.4` | `9.39.4` | Reglas base |
| `eslint-plugin-react-hooks` | `^7.0.1` | `7.0.1` | Reglas de hooks |
| `eslint-plugin-react-refresh` | `^0.5.2` | `0.5.2` | Compat Fast Refresh |
| `globals` | `^17.4.0` | `17.4.0` | Globals para ESLint |
| `@types/react` | `^19.2.14` | `19.2.14` | Tipos (solo dev; el código es `.jsx`) |
| `@types/react-dom` | `^19.2.3` | `19.2.3` | Tipos (solo dev) |

### Backend / Edge Functions (Deno)

Imports por URL (versión tomada del especificador en cada `index.ts`):

| Import | Versión | Funciones |
|---|---|---|
| `https://deno.land/std@0.168.0/http/server.ts` | std **0.168.0** | las 4 |
| `https://esm.sh/@supabase/supabase-js@2` | **@2** (mayor) | las 4 |
| `https://esm.sh/stripe@17?target=denonext` | Stripe SDK **17** | `cng-stripe-webhook`, `cng-create-verification`, `cng-identity-webhook` |

- `cng-create-checkout/index.ts` **no importa el SDK de Stripe**: llama a `POST https://api.stripe.com/v1/checkout/sessions` con `URLSearchParams`.
- `deno.json` no fija versiones remotas. `cng-create-checkout/deno.json` mapea `"@supabase/functions-js": "jsr:@supabase/functions-js@^2"`. `cng-create-verification` y `cng-identity-webhook` **no tienen `deno.json` propio**.

### Gestor de paquetes y runtime

| Elemento | Valor | Fuente |
|---|---|---|
| Gestor | **npm** (`package-lock.json`; sin pnpm/yarn) | — |
| Config npm | `legacy-peer-deps=true` (`.npmrc`) | necesario por React 19 + emoji-mart |
| Runtime Node (entorno) | **Node v24.13.0** | no fijado en repo (sin `.nvmrc` ni `engines`) |
| Runtime Edge | **Deno** (Supabase) | imports por URL |
| Base de datos | **PostgreSQL 17.6** (Supabase) | `supabase/.temp/postgres-version` |
| Scripts | `dev`→`vite`, `build`→`vite build`, `lint`→`eslint .`, `preview`→`vite preview` | `package.json` |

---

## 3. Estructura del repositorio

### Tipo: **PROYECTO ÚNICO (no monorepo)**

Un solo `package.json` raíz (sin `workspaces`, `pnpm-workspace.yaml`, `lerna.json`, `turbo.json` ni `packages/`). Conviven en la misma raíz el **SPA React** (`src/` → build a `dist/`) y las **Edge Functions Deno** (`supabase/functions/`, fuera del grafo npm). Dos targets de despliegue (Vercel / Supabase CLI), pero un único paquete.

### Árbol principal

```
chill-n-go-international/
├── src/                          # Frontend SPA (React 19 + Vite)
│   ├── main.jsx                  # Bootstrap (ReactDOM.createRoot, StrictMode)
│   ├── App.jsx                   # Router raíz (BrowserRouter + rutas)
│   ├── stitch.jsx                # Design system JS (tokens C/FONT/GRADIENT, Icon, useDesktop) — CÓDIGO VIVO
│   ├── assets/                   # hero.png, react.svg, vite.svg
│   ├── components/               # AppShell, TopBar, BackButton, ProtectedRoute, RegistrationWizard
│   ├── context/                  # AuthContext.jsx
│   ├── hooks/                    # usePresence.js
│   ├── lib/                      # supabase.js, chilliums.js
│   ├── pages/                    # Landing, Login, Join, Dashboard, Network
│   │   └── app/                  # Pantallas internas (Feed, Chat, Store, Travel, …)
│   ├── sql/                      # social-tables.sql (script suelto, aplicado a mano)
│   └── utils/                    # memberStatus.js
├── supabase/
│   ├── functions/                # 4 Edge Functions Deno (cng-*)
│   ├── migrations/               # 20260615154049_remove_candystakes_category.sql
│   ├── .temp/                    # estado local del CLI (project-ref, postgres-version, linked-project.json…)
│   └── config.toml               # config Supabase (untracked en git)
├── public/                       # favicon.png, apple-touch-icon.png
├── dist/                         # build de producción (generado)
├── auditoria-chilliums-2026-04-16/   # 2 .md de auditoría previa de Chilliums
├── CNG_PLUS_ARCHITECTURE.md      # doc de arquitectura (~55 KB, v1.1)
├── CLAUDE.md                     # reglas operativas (untracked)
├── README.md                     # genérico de Vite (no documenta el producto)
├── vercel.json, vite.config.js, eslint.config.js, .npmrc, .env, .env.local
└── .claude/                      # config + worktrees (ver nota)
```

### Carpeta → responsabilidad (resumen)

| Carpeta | Contenido |
|---|---|
| `src/components/` | `AppShell.jsx` (router interno + layout), `ProtectedRoute.jsx` (guard), `RegistrationWizard.jsx` (alta multi-paso), `TopBar.jsx`, `BackButton.jsx` |
| `src/context/` | `AuthContext.jsx` (sesión + `member` global) |
| `src/lib/` | `supabase.js` (clientes `supabase` y `supabasePublic`), `chilliums.js` (helpers centi-chilliums) |
| `src/pages/` + `src/pages/app/` | Páginas públicas y pantallas internas (ver §8) |
| `src/sql/` | `social-tables.sql` (~20 KB; esquema social, **fuera de migraciones**) |
| `supabase/functions/` | 4 Edge Functions (`cng-create-checkout`, `cng-stripe-webhook`, `cng-create-verification`, `cng-identity-webhook`) |
| `supabase/migrations/` | 1 sola migración (candystakes, **sin aplicar** — §4) |
| `auditoria-chilliums-2026-04-16/` | `AUDITORIA_WEBHOOK_ESTADO_ACTUAL.md`, `SESION_1_MAPEO.md` (auditoría forense previa de Chilliums) |

**Nota de higiene:** `.claude/worktrees/` contiene **copias completas del repo** (`stupefied-heyrovsky-e4bbad`, `peaceful-williamson-e9ae02`, `quizzical-tu-e281f1`, etc.), cada una con su `node_modules/`. Esto **contradice la regla de `CLAUDE.md` (no usar worktrees)** y, peor aún, **varias Edge Functions de producción se desplegaron desde una de esas worktrees** (ver §7/§9). Algunas retienen archivos ya eliminados del repo principal (p. ej. `CandyStakesScreen.jsx`).

---

## 4. Base de datos

**Motor:** PostgreSQL **17.6** (Supabase). **Instancia compartida:** el esquema `public` tiene **~159 tablas** de múltiples productos (`luzdevida_*`, `marco_*`, `nomina_*`, `capital_*`, `matrix_*`, `crm_*`, `agent_*`, `telnyx_*`, `wa_*`, `camila_*`…). El dominio **Chill N Go** son **32 tablas `cng_*`** más `identity_profiles`, `chilliums_ledger`, `referral_tree`, `transactions`, `subscriptions`, `platform_roles`, `cngp_quote_requests`.

### 4.1 Tablas del dominio CNG (columnas en vivo)

#### `identity_profiles` (perfil maestro: usuario + KYC + Chilliums) — PK `id`
| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | YES | — | enlace a `auth.users` |
| account_type | text | NO | **'client'** | el código lo escribe siempre como `'member'` (§6) |
| email | text | NO | — | |
| first_name / last_name / maternal_last_name / full_name | text | YES | — | wizard (NULLABLE) |
| date_of_birth | date | YES | — | |
| gender / nationality / country_of_residence | text | YES | — | |
| government_id_type/_number/_country, secondary_id_* | text | YES | — | KYC |
| phone / phone_country_code / secondary_phone | text | YES | — | |
| address_street/_unit/_neighborhood/_city/_state/_zip/_country | text | YES | — | dirección (pensada para KYC) |
| identity_verification_status | text | YES | 'pending' | Stripe Identity |
| stripe_verification_session_id / verified_at / last_kyc_error | text/timestamptz/text | YES | — | KYC |
| avatar_url / display_name / bio | text | YES | — | |
| ref_code | text | YES | — | código de referido propio |
| referred_by | uuid | YES | — | referidor |
| referral_depth / direct_referrals_count / network_size | integer | YES | 0 | |
| **chilliums_balance / _total_earned / _total_spent** | **bigint** | YES | 0 | **centi-chilliums** |
| stripe_customer_id | text | YES | — | |
| payment_status | text | YES | 'inactive' | `pending`/`active`/`cancelled` |
| accepted_terms / accepted_privacy / accepted_truthful | boolean | YES | false | |
| registration_completed / is_active | boolean | YES | false / true | |
| source_lob / lead_type | text | YES | — | |
| created_at / updated_at / last_login_at | timestamptz | YES | now()/now()/— | |

#### `chilliums_ledger` (libro mayor de lealtad) — PK `id`
| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | uuid | NO | PK |
| user_id | uuid | NO | **FK → `identity_profiles(id)` ON UPDATE CASCADE ON DELETE RESTRICT** |
| type | text | NO | tipo de movimiento (`cashback_direct`, `cashback_network`, `earn_referral_level_*`…) |
| amount | **bigint** | NO | centi-chilliums |
| balance_after | **bigint** | NO | saldo tras el movimiento |
| source_transaction_id | uuid | YES | **FK → `transactions(id)`** |
| source_user_id | uuid | YES | **FK → `identity_profiles(id)` ON DELETE RESTRICT** |
| referral_level | integer | YES | nivel del reparto |
| description | text | YES | |
| created_at | timestamptz | YES | now() |

> Las FKs `ON DELETE RESTRICT` confirman que la **decisión "ledger indestructible" (ADR-11)** está aplicada en la base.

#### `transactions` (transacciones Stripe) — PK `id`
| Columna | Tipo | Null | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | — |
| lob | text | NO | — (p. ej. `cng_plus`) |
| type | text | NO | — (p. ej. `subscription`) |
| description | text | YES | — |
| gross_amount | numeric | NO | — |
| currency | text | YES | 'USD' |
| operating_cost | numeric | YES | 0 |
| net_profit | numeric | NO | — |
| status | text | YES | 'completed' |
| metadata | jsonb | YES | — (idempotencia: `metadata->>stripe_event_id`) |
| created_at | timestamptz | YES | now() |

#### `platform_roles` (roles multi-plataforma / multi-LOB) — PK `id`
| Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | |
| platform | text | NO | — | el webhook escribe `'cng_app'` |
| role | text | NO | — | el webhook escribe `'member'` |
| lob | text | YES | — | línea de negocio |
| is_active | boolean | YES | true | |
| granted_at / granted_by / revoked_at | timestamptz/uuid/timestamptz | YES | now()/—/— | auditoría de concesión |

> **Esta es la infraestructura de roles real del sistema.** Hoy solo se usa con `(platform='cng_app', role='member')`, pero el esquema soporta roles arbitrarios por plataforma y LOB — directamente relevante para distinguir admin / mayorista / cliente en el futuro (§5, §6, §12).

#### `subscriptions` (suscripción genérica) — PK `id`
`user_id`, `stripe_subscription_id`, `stripe_customer_id`, `plan` (default `'nomad'`), `frequency` (`'monthly'`), `currency` (`'usd'`), `status` (`'incomplete'`), `current_period_start/_end`, `cancel_at_period_end`, timestamps. **El webhook actual NO escribe aquí** (usa `identity_profiles.payment_status`); parece legacy/no usada por el flujo CNG+.

#### `referral_tree` (árbol de referidos materializado) — PK `id`
`member_id` (uuid), `referred_by` (uuid), `depth` (int, default 1), `path` (`uuid[]` materializado), `is_active`, `created_at`.

#### Tablas sociales / mensajería (resumen)
`cng_posts`, `cng_post_likes`, `cng_post_comments`, `cng_post_bookmarks`, `cng_follows`; `cng_conversations`, `cng_conversation_members`, `cng_messages`, `cng_message_reactions`, `cng_starred_messages`, `cng_deleted_messages`, `cng_blocked_users`, `cng_reports`, `cng_notifications`; `cng_stories`, `cng_story_views/_replies/_reactions`, `cng_polls`, `cng_poll_votes`; `user_presence`. La familia `cng_travel_*` (CRM de viajes) y `cngp_quote_requests` (leads B2B "CNG+ Plus") también existen.

> **Drift de columnas:** la base tiene columnas añadidas **fuera de `social-tables.sql`** en `cng_conversations` (`avatar_url`, `admin_id`, `description`), `cng_conversation_members` (`is_muted`, `is_archived`, `is_pinned`, `cleared_at`) y `cng_messages` (`reactions` jsonb, `delivery_status`, `delivered_at`, `read_at`, `edited_at`, `is_view_once`, `viewed_once_at`, `story_id`). Se aplicaron a mano vía SQL Editor.

#### `cng_members` (legacy, duplica `identity_profiles`)
Tabla amplia con KYC + referidos. PK `id` **sin default** (se espera que iguale `auth.users.id`). **Inconsistencia de tipo:** `cng_members.chilliums_balance` es **`numeric`**, mientras `identity_profiles`/`chilliums_ledger` usan **`bigint`** (centi). El ADR-01 declara la migración `cng_members → identity_profiles` en progreso.

### 4.2 Foreign keys (corrección)

**Sí existe integridad referencial declarada:** **216 FKs** en la base, **54 en tablas `cng_*`**. Ejemplos verificados:

| Origen.columna | → Destino | Regla |
|---|---|---|
| `cng_posts.user_id` | `auth.users(id)` | ON DELETE CASCADE |
| `cng_posts.member_id` | `identity_profiles(id)` | ON DELETE SET NULL |
| `cng_messages.conversation_id` | `cng_conversations(id)` | ON DELETE CASCADE |
| `cng_messages.sender_id` | `auth.users(id)` | ON DELETE CASCADE |
| `cng_messages.reply_to_id` | `cng_messages(id)` | ON DELETE SET NULL |
| `cng_messages.story_id` | `cng_stories(id)` | ON DELETE SET NULL |
| `chilliums_ledger.user_id` | `identity_profiles(id)` | ON UPDATE CASCADE **ON DELETE RESTRICT** |
| `chilliums_ledger.source_user_id` | `identity_profiles(id)` | **ON DELETE RESTRICT** |
| `chilliums_ledger.source_transaction_id` | `transactions(id)` | — |

Por eso el `.select('… cng_posts_member_id_fkey …')` de `FeedScreen.jsx` (embedding de PostgREST) **funciona**: la FK existe.

### 4.3 Migraciones

- **Mecanismo:** Supabase CLI + `supabase/migrations/`. `list_migrations` reporta **34 migraciones** aplicadas en remoto, **todas de otros productos** (`luzdevida_*`, `marco_*`, `camila_*`, `costos_*`…). **Ninguna del dominio CNG.**
- **`src/sql/social-tables.sql`** es un **script suelto** ("Run this entire file in the Supabase SQL Editor"): **no está en migraciones**, no aparece en `list_migrations`. Explica el drift de columnas/tablas añadidas a mano.
- **`supabase/migrations/20260615154049_remove_candystakes_category.sql`** existe pero su cabecera dice *"PENDIENTE DE REVISIÓN — NO APLICADA"*. Verificado en vivo: el CHECK `cng_posts_category_check` **aún admite `'candystakes'`** y hay **0 filas** con esa categoría → aplicarla sería seguro. Tampoco figura en `list_migrations`.

**Conclusión:** el dominio CNG **vive fuera del control de versiones de la base** (esquema administrado a mano). Es el riesgo operacional de fondo de §12.

### 4.4 Seguridad / RLS (advisors)

`get_advisors` reporta **183 hallazgos de seguridad** y **707 de rendimiento** a nivel proyecto (instancia compartida). Destacados que afectan o rozan a CNG:

- **`rls_disabled_in_public` (30, ERROR):** 30 tablas `public` sin RLS. Las `cng_*`/`identity_profiles`/`chilliums_ledger`/`referral_tree` **sí tienen RLS**. ⚠️ `profiles` (genérica, posiblemente ajena a CNG) tiene **RLS deshabilitado con 9 políticas inertes** (`policy_exists_rls_disabled`).
- **`anon_security_definer_function_executable` (WARN):** incluye **`public.add_chilliums(p_member_id uuid, p_amount numeric)`** — RPC que acuña Chilliums **ejecutable por el rol `anon`** vía `/rest/v1/rpc/`. Riesgo alto si algún día se invoca; hoy el webhook no la usa (ver §4.5). **Debe revocarse EXECUTE a anon/authenticated.**
- **`rls_policy_always_true` (25, WARN):** políticas siempre-verdaderas en `cng_conversations`, `cng_conversation_members`, `cng_members`, `cngp_quote_requests`, `identity_profiles`, `subscriptions`. En `identity_profiles`/`cng_members` (PII/KYC) merece auditoría; en `cngp_quote_requests` (formulario público) puede ser intencional.
- **`public_bucket_allows_listing` (WARN):** el bucket **`cng-media` es público y permite listar todos los archivos** (`media_select_public`). Relevante si ahí se guardan medios sensibles.
- **`auth_rls_initplan` (161) y `multiple_permissive_policies` (350):** optimizaciones de RLS pendientes en muchas tablas `cng_*` (envolver `auth.uid()` en subconsulta; consolidar políticas).
- **`auth_leaked_password_protection`: desactivada** en Supabase Auth.

### 4.5 RPCs de Chilliums (ambas existen)

| RPC | Firma | Retorno | Notas |
|---|---|---|---|
| `add_chilliums` | `(p_member_id uuid, p_amount numeric)` | void | **Legacy, `numeric`**, `SECURITY DEFINER`, **ejecutable por anon** (riesgo) |
| `apply_chilliums` | `(p_user_id uuid, p_amount bigint, p_type text, p_description text, p_source_user_id uuid, p_referral_level integer, p_source_transaction_id uuid)` | `TABLE(ledger_id uuid, new_balance bigint)` | **Banking-grade (ADR-11)**, `bigint`/centi, lock `FOR UPDATE` |

`apply_chilliums` es la puerta "banking-grade" diseñada. **El webhook commiteado en la rama NO usa ninguna de las dos** (escribe directo; ver §7/§12).

---

## 5. Modelos de datos clave (y reutilización para catálogo de ropa)

### Entidades actuales

| Entidad | Tabla(s) | Rol hoy | ¿Reutilizable para ropa white-label? |
|---|---|---|---|
| **Usuario / miembro** | `auth.users` + `identity_profiles` | Identidad, KYC, saldo Chilliums, referido | **Sí** — base de cliente final; ampliable con rol `reseller`/`admin` |
| **Roles** | `platform_roles` (`platform`, `role`, `lob`) | Solo `cng_app/member` | **Sí, clave** — ya soporta roles por plataforma/LOB; aquí encajan `admin`, `wholesaler`, `client` |
| **Red de referidos** | `referral_tree` (`path uuid[]`, `depth`) | Afiliados de membresía | Parcial — modela afiliación, no relación comercial mayorista→revendedor |
| **Pagos** | `transactions`, `subscriptions` | Suscripción CNG+ | Parcial — `transactions` (lob/gross/cost/net) sirve de base contable; falta `orders`/`order_items` |
| **Lealtad** | `chilliums_ledger` + `apply_chilliums` | Cashback de membresía | **Sí** — ledger atómico ya existe; reusable como puntos/cashback por compra |
| **Catálogo "tienda"** | **Ninguna** (`PRODUCTS`/`BUSINESSES` hardcodeados en JSX) | Maqueta visual | El **patrón UI** sí; el modelo de datos **no existe** |
| **Media** | Storage `cng-media` | Avatares, posts | Bucket existe; hoy **público con listado** (revisar para producto) |

### Lo que falta para inventario central de ropa (no existe hoy)

No hay **ninguna** tabla de producto/inventario/pedido ni discriminador de tenant. Para la tienda habría que crear, como mínimo: `products` (SKU, marca central, descripción), `product_variants` (talla/color/precio), `inventory` (stock central por almacén), `stores`/`resellers` (tenant), `orders` + `order_items`, y un vínculo `product ↔ store` (qué revende cada tienda). Detalle de decisiones abiertas en §11 y §12.

---

## 6. Autenticación y roles

### 6.1 Sistema: Supabase Auth (GoTrue) con email/password

Cliente en `src/lib/supabase.js`:
- **`supabase`** (autenticado): `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`.
- **`supabasePublic`** (anónimo, sin sesión): para lecturas previas al login (validar referido y email duplicado en `Join.jsx`).

⚠️ `supabaseUrl` y `supabaseAnonKey` (proyecto `jahnlhzbjcbmjnuzxsvj`) están **hardcodeados** en `src/lib/supabase.js` (no leen `import.meta.env`). La **publishable key de Stripe** (`pk_test_51Rvx4i…`) y URLs de funciones también están hardcodeadas en `Join.jsx`/`Dashboard.jsx` (son claves de **test**).

### 6.2 Estado en React: `AuthContext`

`src/context/AuthContext.jsx` expone `{ user, member, loading, signIn, signUp, signOut, fetchMember }`. Al haber sesión, `fetchMember()` hace `from('identity_profiles').select('*').eq('user_id', …).single()`. Nota: `signUp` del contexto **no se usa** en el alta real (lo hace `RegistrationWizard.jsx`); la ruta `/verify-success` que referencia **no existe** en `App.jsx`.

### 6.3 Flujo de alta: invitación → email → wizard → pago → KYC

Orquestado en `src/pages/Join.jsx` (+ `RegistrationWizard.jsx`):
1. **Solo por referido:** `Join.jsx` exige `?ref=` (o `localStorage cng_ref_code`, TTL 30 días). `fetchReferrer()` valida (vía `supabasePublic`) que el referidor exista en `identity_profiles` y esté **`payment_status='active'`**.
2. **Email:** valida formato, bloquea auto-referido y duplicados.
3. **Wizard (5 sub-pasos):** Identidad, Contacto, Dirección, Contraseña, Confirmar (legal). En el submit: `supabase.auth.signUp(...)`, genera `ref_code` propio, y hace `upsert` en `identity_profiles` (`onConflict:'email'`) con `payment_status:'pending'`, `registration_completed:false`, **`account_type:'member'`**.
4. **Pago:** `cng-create-checkout` (Stripe Checkout, **$10 activación + $7/mes, trial 30d**). Retorno a `/join?paid=true…`.
5. **KYC:** `cng-create-verification` → Stripe Identity (`window.Stripe(...).verifyIdentity`), marca `identity_verification_status='processing'`.

Es **pago-primero con perfil sparse posible** (concuerda con la memoria `identity_profiles_nullable`).

### 6.4 Login y sesión

`Login.jsx` usa `signIn()` → `signInWithPassword`, navega a `/dashboard`, traduce errores de GoTrue. `ProtectedRoute.jsx` solo verifica que exista `user`; **no** comprueba `payment_status`/KYC — el gating fino lo hace cada pantalla (Dashboard muestra CTAs según `getMemberState`).

### 6.5 Roles: hay infraestructura (`platform_roles`), uso mínimo

Señales de rol/estado hoy:

1. **`platform_roles`** (tabla real, §4): el webhook inserta `(platform='cng_app', role='member')`. Soporta roles por plataforma y LOB, pero **hoy solo se usa el valor `member`** y **ninguna pantalla del frontend lo lee** para autorizar. Es la base para un sistema de roles formal, aún sin explotar.
2. **`account_type`** en `identity_profiles`: default `'client'` en la base, pero el código siempre escribe `'member'`. De facto constante.
3. **`payment_status`** (`pending`/`active`/`cancelled`): señal más usada (gate de invitación y de `getMemberState`).
4. **`identity_verification_status` + `registration_completed`**: estados de **onboarding** derivados en `src/utils/memberStatus.js` (`getMemberState` → `payment_pending`/`kyc_not_started`/`kyc_pending`/`kyc_failed`/`fully_active`). No son roles de autorización.
5. **`role` `'member'`/`'admin'` en `cng_conversation_members`:** rol **por conversación de chat**, no de plataforma.
6. **Red:** `referred_by`/`ref_code` modelan la jerarquía de referidos (1 nivel en UI), **sin conferir permisos**.

**Conclusión:** hoy **no hay diferenciación operativa admin / mayorista / cliente**; todos son `account_type='member'`. Pero **`platform_roles` ya existe** y es el lugar natural para introducir esos roles (con gating en `ProtectedRoute`/pantallas + RLS).

---

## 7. Backend / API

Backend = **Edge Functions Deno** + Postgres con RLS. En la **rama** hay **4 funciones** (`supabase/functions/`); todas usan `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (service role, bypass RLS) y `serve()`. URL real invocada por el frontend: **`https://jahnlhzbjcbmjnuzxsvj.supabase.co/functions/v1/<fn>`** (gateway).

### 7.1 Funciones desplegadas (verificado con `list_edge_functions`)

La instancia tiene ~50 funciones (compartida). Estado real de las CNG:

| Slug desplegado | verify_jwt | ¿En la rama? | Origen del deploy (entrypoint) |
|---|---|---|---|
| `cng-create-checkout` | false | ✅ sí | **`.claude/worktrees/stupefied-heyrovsky-e4bbad/…`** |
| `cng-stripe-webhook` | false | ✅ sí | **`.claude/worktrees/stupefied-heyrovsky-e4bbad/…`** |
| `cng-identity-webhook` | false | ✅ sí | **`.claude/worktrees/stupefied-heyrovsky-e4bbad/…`** |
| `cng-create-verification` | false | ✅ sí | `/tmp/.../source/index.ts` (sin import map) |
| `cng-create-portal` | false | ❌ **no en la rama** | `/tmp/.../source` — **desplegada pero no versionada** |
| `cng-issue-welcome-session` | false | ❌ **no en la rama** | **`.claude/worktrees/stupefied-heyrovsky-e4bbad/…`** |

> **Hallazgo operacional grave:** varias funciones de **producción se desplegaron desde una worktree local** (`stupefied-heyrovsky-e4bbad`), no desde la rama versionada. El código en `supabase/functions/` de la rama puede **no coincidir** con lo que corre en producción. Además existen funciones de pago **genéricas anteriores** también desplegadas y fuera del repo: `create-checkout`, `stripe-webhook`, `create-portal-session`, `stripe-create-subscription`, `create-direct-charge` (posible iteración previa de CNG).

`config.toml` declara `verify_jwt=false` para `cng-stripe-webhook`, `cng-identity-webhook`, `cng-issue-welcome-session` y `cng-create-checkout`; **no** declara `cng-create-verification` (en el deploy real está como `false`).

### 7.2 `cng-create-checkout`
POST (+CORS). Payload `{ email, ref_code, success_url, cancel_url }`. Verifica que el perfil exista en `identity_profiles` con `payment_status='pending'` (si no, 400). Crea Checkout Session Stripe: `mode=subscription`, `line_items[0][price]=CNG_PRICE_ID`, `subscription_data[trial_period_days]=30`, y `line_items[1]` cargo único "CNG+ Activacion (primer mes)" `unit_amount=1000` (**$10.00**). Solo **lee** `identity_profiles`. Env: `STRIPE_SECRET_KEY`, `CNG_PRICE_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### 7.3 `cng-stripe-webhook`
POST server-to-server. **Verifica firma** con `STRIPE_WEBHOOK_SECRET` (`stripe.webhooks.constructEventAsync`). Constantes: `MEMBERSHIP_PRICE=7.00`, `STRIPE_FEE=0.50`, `CNG_FEE=1.00`, `DISTRIBUTABLE=5.50`; splits `SPLIT_L1=0.50`, `SPLIT_L2=0.35`, `SPLIT_L3=0.15`.

Eventos:
- **`checkout.session.completed`:** idempotencia por `transactions.metadata->>stripe_event_id`; busca perfil por email (si no existe, 200 con `no_profile`, ya **no fabrica perfiles**); pone `payment_status='active'`, `account_type='member'`, genera `ref_code`, guarda `stripe_customer_id`; inserta rol en **`platform_roles`** (`cng_app`/`member`); construye **`referral_tree`** (path/depth) y actualiza `direct_referrals_count`; inserta **`transactions`** (gross 7.00 / cost 1.00 / net 5.50); llama `distributeChilliums(…, 5.50, …)`.
- **`invoice.payment_succeeded`** (renovación): repite reparto sobre 5.50.
- **`customer.subscription.deleted` / `invoice.payment_failed`:** `payment_status='cancelled'`.

**Reparto Chilliums (`distributeChilliums`/`creditChilliums`):**
- **Nivel 0 (pagador): 50%** → 2.75 (`earn_referral_level_0`, "cashback propio").
- **Nivel 1 (referidor directo): 35%** → 1.925 (`earn_referral_level_1`).
- **Nivel 2 (referidor del referidor): 15%** → 0.825 (`earn_referral_level_2`).

> ⚠️ **Drift crítico de contabilidad:** este código (commiteado) usa `creditChilliums` con **read-modify-write y montos `float` en dólares** (2.75, 1.925, 0.825), y **no** llama a `apply_chilliums`. Pero las columnas destino son **`bigint`** (centi-chilliums) y la base ya tiene la RPC `apply_chilliums(bigint)` + ledger `ON DELETE RESTRICT` (ADR-11). Es decir, **el `index.ts` de la rama es una revisión ANTERIOR** a la migración banking-grade; el binario realmente desplegado (v61, desde la worktree) probablemente sí usa `apply_chilliums`. **Hay que conciliar el código de la rama con lo desplegado** (§12).

### 7.4 `cng-create-verification`
POST (+CORS). Payload `{ email, return_url }`. Reutiliza la sesión de Identity si existe (`pending`/`processing`); si no, crea `verification_sessions` (`type=document`, `verification_flow=vf_1TI1VhClWFP3vlIVQjUBTF7X` **hardcodeado**). Persiste `stripe_verification_session_id` + `identity_verification_status='pending'`. Env: `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### 7.5 `cng-identity-webhook`
POST server-to-server. Verifica firma con **`STRIPE_IDENTITY_WEBHOOK_SECRET`** (secret distinto). `verified` → `identity_verification_status='verified'`, `verified_at`, `registration_completed=true`. `requires_input` → `failed` + `last_kyc_error`.

### 7.6 Lógica de negocio (flujo end-to-end)

`Wizard (perfil pending)` → `cng-create-checkout` (Stripe: $10 + $7/mes) → `checkout.session.completed` → `cng-stripe-webhook` (activa membresía, rol en `platform_roles`, `referral_tree`, `transactions`, reparte Chilliums 50/35/15 sobre $5.50) → en paralelo `cng-create-verification` → Stripe Identity → `cng-identity-webhook` (KYC verificado). "Miembro pleno" (`memberStatus.isFullyActive`) requiere `payment_status='active'` **y** `identity_verification_status='verified'` **y** `registration_completed=true`.

---

## 8. Frontend

### 8.1 Arranque y ruteo

- `src/main.jsx` monta `<App/>` en `<StrictMode>`. `src/App.jsx` = `<BrowserRouter><AuthProvider><Routes>…`.
- **Rutas:** `/` `Landing` (pública), `/login` `Login` (pública), `/join` `Join` (pública), `/dashboard` → redirige a `/app/feed` (protegida), `/app/*` `AppShell` (protegida), `/network` `Network` (protegida, legacy).
- **Patrón clave:** bajo `/app`, todas las sub-rutas usan `element={null}`. **Quien decide qué pantalla renderizar es `AppShell.jsx`**, no el router: lee `useLocation()`, parsea el pathname (`split`) → `currentScreen` y un `switch` monta el componente. Las `<Route element={null}>` solo validan la URL (no usa `<Outlet>`/`useParams`). `Dashboard.jsx` quedó **fuera del árbol activo** (`/dashboard` redirige a feed).

### 8.2 AppShell / navegación

Responsive (`useDesktop()`, breakpoint 768px): **sidebar 240px** en desktop, **bottom-nav fija glass** en móvil (`maxWidth: 390`). Tabs: `feed`, `messages`, `create` (botón central elevado), `explore`, `profile`. `SUB_SCREENS` (travel/realestate/nutrition/store/store-local/network) y chat ocultan la nav. Badge de no leídos: consulta `cng_conversation_members.unread_count` cada 5s.

### 8.3 Inventario de pantallas

**Páginas raíz:** `Landing.jsx` (marketing, paleta propia clara `Fraunces`/`Figtree`, texto legal de cumplimiento), `Login.jsx`, `Join.jsx` (+`RegistrationWizard`, `localStorage` del ref), `Network.jsx` (red desktop, legacy), `Dashboard.jsx` (estado de cuenta + `cng-create-portal`, hoy inalcanzable).

**Pantallas app (`src/pages/app/`):**
- `FeedScreen.jsx` — feed TikTok desde `cng_posts` (join `cng_posts_member_id_fkey`), likes/bookmarks/follows/comentarios optimistas, autoplay por `IntersectionObserver`, share. `DemoPost` si no hay datos.
- `ExploreScreen.jsx` — grid de verticales (imágenes Unsplash) + conteo real de posts por categoría.
- `CreateScreen.jsx` — alta de post en 3 pasos; sube a `cng-media` + INSERT `cng_posts`; límites 50 MB / 3 min.
- `MessagesScreen.jsx` (~1583 líneas) — lista de conversaciones + bandeja de stories; modales nuevo mensaje/grupo; pin/mute/archive/clear/delete/report/block; realtime sobre `cng_messages`; `usePresence()`.
- `ChatScreen.jsx` (~4210 líneas, la mayor) — chat con texto formateado, voz, imagen (compresión canvas), video, ubicación, encuestas (`cng_polls`), GIFs (Giphy), stickers, reacciones (`cng_message_reactions`), reply/forward/view-once, starred, delete-for-me, búsqueda, grupos, estados de entrega, realtime (broadcast + postgres_changes).
- `NetworkScreen.jsx` — red in-app desde `referral_tree`; **explícitamente 1 nivel** ("single level — only people you directly invited"); tabs network/ledger.
- `ProfileScreen.jsx` — perfil, avatar a `cng-media`, balance (`formatChilliums`), link de referido, `cng-create-portal`. (Tiene un `console.log` de depuración activo, línea 35.)
- `TravelScreen.jsx`, `RealEstateScreen.jsx`, `NutritionScreen.jsx`, `StoreScreen.jsx`, `StoreLocalScreen.jsx` — **maquetas con datos hardcodeados** (arrays en JSX, imágenes Unsplash, "asistente Spark IA" con respuestas canned). Sin backend.
- `StoriesComponents.jsx` — `StoryRing`/`StoryViewer`/`CreateStory` sobre `cng_stories`/`cng_story_views`.

**Componentes:** `AppShell`, `ProtectedRoute`, `TopBar` (header glass), `BackButton` (FAB), `RegistrationWizard`. **Hook:** `usePresence.js` (heartbeat cada 30s sobre `user_presence` + `sendBeacon` en `beforeunload`).

### 8.4 Sistema de estilos

**Estilos 100% inline** (objetos `style={{}}`). **No hay `.css`, ni Tailwind, ni CSS-in-JS.** CSS global mínimo embebido en `index.html` (reset, `body { background:#080C14 }`, scrollbars ocultos). `@keyframes` inyectados ad-hoc por componente.

**`src/stitch.jsx` = design system** (módulo JS, **código vivo**, consumido por casi todas las pantallas): exporta `C` (paleta oscura: `bg #080C14`, `primary #68dbae`, `secondary #e7c092` dorado, `tertiary #c5c0ff`…), `FONT` (`Manrope`/`Be Vietnam Pro`), `Icon` (Material Symbols), `GRADIENT`, `GLASS_NAV`, `useDesktop`. Fuentes vía Google Fonts en `index.html`. Cada SUB_SCREEN define además su acento local (Store online lila `#b8a4ff`, StoreLocal dorado `#e7c092`, etc.).

### 8.5 StoreScreen / StoreLocalScreen (relevante para la tienda de ropa)

- **`StoreScreen.jsx` ("Store Online"):** catálogo **100% hardcodeado** (`PRODUCTS`, 4 items Nike/Casio con imágenes Unsplash). Categorías incluyen **`👕 Ropa`**, pero el filtro **no filtra realmente**. Carrito en `useState` (no persiste, sin checkout). "Spark IA" = texto canned.
- **`StoreLocalScreen.jsx` ("Store Local"):** directorio **hardcodeado** (`BUSINESSES`, Polanco CDMX), links a Google Maps, delivery "Próximamente". Ubicación fija.

Para una tienda real habría que: tabla de productos en Supabase (no existe; el patrón de fetch ya está en Feed/Explore con `cng_posts`), filtrado real, carrito persistente y checkout (Stripe ya cargado).

---

## 9. Despliegue e infraestructura

### Frontend (Vercel, SPA)
`vercel.json` = un único rewrite `{"source":"/(.*)","destination":"/index.html"}` (fallback SPA para react-router). Sin `buildCommand`/`outputDirectory` (autodetección Vite). `build` = `vite build` → `dist/`. No hay `.vercel`/`netlify.toml`. No se encontró dominio `*.vercel.app` fijado en el repo (se gestiona en el panel).

### Backend (Supabase)
`https://jahnlhzbjcbmjnuzxsvj.supabase.co` (hardcodeado en `src/lib/supabase.js`). Postgres + Auth + Storage + Realtime + Edge Functions. Storage bucket **`cng-media`** (avatares, posts, stories, media de chat) — público con listado permitido (§4.4). Migraciones: solo la de candystakes (sin aplicar). Drift de despliegue de funciones: ver §7.1.

### Dominios / subdominios (todos fijos de la marca CNG)
- Marca principal: `chillngointernational.com` (en `cng-create-verification` `return_url`, share en `FeedScreen.jsx:557`, `mailto:soporte@chillngointernational.com`).
- Verticales enlazados en `Dashboard.jsx:283-287`: `chillngotravel.com`, `chillngonutrition.com`, `chillngorealestate.com`, `chillngostore.com`, `chillngoonline.com`. **No son tiendas de revendedores**, son dominios de la marca única.

### CI/CD
**No encontrado.** No hay `.github/workflows` ni pipelines versionados. Deploy asumido: git-push a Vercel (frontend) + `supabase functions deploy` manual (backend, hoy desde worktrees).

### Variables de entorno (solo nombres)

| Variable | Ámbito | Dónde |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | `.env`/`.env.local` (definida pero **no se consume**: la URL está hardcodeada) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | igual que arriba |
| `VITE_GIPHY_KEY` | Frontend | `ChatScreen.jsx` (GIFs). **No está en `.env`** (solo en build/Vercel) |
| `STRIPE_SECRET_KEY` | Edge (secreto) | las 4 funciones |
| `STRIPE_WEBHOOK_SECRET` | Edge (secreto) | `cng-stripe-webhook` (firma) |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | Edge (secreto) | `cng-identity-webhook` (firma) |
| `CNG_PRICE_ID` | Edge (config) | `cng-create-checkout` (price de la suscripción) |
| `SUPABASE_URL` | Edge | las 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge (secreto) | las 4 (bypass RLS) |

Constantes no-env relevantes: `VERIFICATION_FLOW_ID="vf_1TI1VhClWFP3vlIVQjUBTF7X"` (hardcodeado en `cng-create-verification`); `pk_test_51Rvx4i…` (Stripe **test**) hardcodeada en `Join.jsx`/`Dashboard.jsx`.

---

## 10. Integraciones externas

| Servicio | Uso | Dónde |
|---|---|---|
| **Stripe Payments / Checkout** | Suscripción CNG+ ($10 activación + $7/mes, trial 30d) | `cng-create-checkout`, `Join.jsx`, `Dashboard.jsx` |
| **Stripe Webhooks (pagos)** | Activa membresía, reparte Chilliums | `cng-stripe-webhook` (firma `STRIPE_WEBHOOK_SECRET`) |
| **Stripe Identity (KYC)** | Verificación documento+selfie (flow `vf_1TI1VhClWFP3vlIVQjUBTF7X`) | `cng-create-verification`, `cng-identity-webhook` |
| **Stripe Billing Portal** | Gestión de suscripción | `cng-create-portal` (desplegada, **no en la rama**) |
| **Stripe.js loader** | `window.Stripe(...)` para Checkout/`verifyIdentity` | `index.html` (`js.stripe.com/dahlia/stripe.js`) |
| **Supabase** | Auth, DB, Storage (`cng-media`), Realtime (chat/presence) | `src/lib/supabase.js`, `ChatScreen`, `MessagesScreen`, `usePresence` |
| **GIPHY** | GIFs en el chat | `ChatScreen.jsx` (`VITE_GIPHY_KEY`, expuesta en el bundle) |
| **Google Fonts** | Tipografías | `index.html` |
| **Material Symbols** | Iconografía | `index.html` + `stitch.jsx::Icon` |
| **emoji-mart** | Picker de emojis | `ChatScreen.jsx` |
| **Google Maps (links)** | "Ir al lugar" en Store Local | `StoreLocalScreen.jsx` (URLs, no API) |
| **Correo / email transaccional** | **No encontrado** en el repo (solo `mailto:`). Existen funciones genéricas desplegadas `send-email`/`gmail-send` fuera del dominio CNG | — |
| **Envíos / shipping** | **No encontrado / Pendiente** | — |
| **Almacenamiento de imágenes (3ros)** | **No encontrado** — todo en Supabase Storage + Unsplash (demo) | — |

---

## 11. Preparación para multi-marca / multi-inquilino

**Veredicto: NO existe preparación multi-tenant.** App mono-tenant, mono-marca, mono-dominio. **No hay ni una sola** columna `tenant_id`/`brand_id`/`store_id`/`organization_id`/`reseller_id` en ninguna tabla; el único "brand" es cosmético (`brand:'NIKE'` en `StoreScreen`). Las RLS particionan por **usuario** (`auth.uid()`), nunca por organización.

### Acoplamientos a un solo dominio/proyecto (a romper)

| Archivo:línea | Hardcodeado |
|---|---|
| `src/lib/supabase.js:3-4` | `supabaseUrl` + anon key literales (no leen env) |
| `src/pages/Join.jsx:325,353` | URLs `…/functions/v1/cng-create-checkout` / `cng-create-verification` con ref del proyecto |
| `src/pages/Dashboard.jsx:22,43,70` | `cng-create-portal`/`cng-create-checkout`/`cng-create-verification` |
| `src/pages/app/ProfileScreen.jsx:48` | `…/cng-create-portal` |
| `supabase/functions/cng-create-verification/index.ts` | `return_url` default `https://chillngointernational.com/...` |
| `src/pages/app/FeedScreen.jsx:557` | share `https://chillngointernational.com/post/${id}` |
| `src/pages/Dashboard.jsx:283-287,177-178` | 5 dominios `chillngo*.com` + soporte |

**Matiz positivo:** los `success_url`/`cancel_url` de Stripe **no** están fijos en la función — el front los envía con `window.location.origin` y la función los exige. Es el único punto que ya tolera múltiples orígenes; pero el **endpoint** de la función sigue siendo un solo proyecto Supabase.

### Reutilizable para ropa multi-marca (con trabajo)
- **Patrón UI de catálogo** (`StoreScreen.jsx`: grid, featured/hero, cards, pills, carrito) — plantilla visual.
- **`cng-create-checkout` parametrizable** (ya recibe `success_url`/`cancel_url` y arma `line_items`) — adaptable a `mode=payment` con productos.
- **`platform_roles`** (roles por plataforma/LOB) — encaje natural para `admin`/`wholesaler`/`client`.
- **`chilliums_ledger` + `apply_chilliums`** — contabilidad de cashback atómica reusable.

### Lista de lo que hay que construir desde cero
1. Capa de **tenant** (`tenant_id`/`store_id`/`reseller_id`) en tablas + **reescritura de TODAS las RLS** para aislar por tenant además de por usuario.
2. **Catálogo/inventario/pedidos** (`products`, `product_variants`, `inventory`, `orders`, `order_items`, `stores`).
3. **Resolución dominio/subdominio → tenant** (no existe ningún middleware de host).
4. **Pagos por revendedor**: hoy Stripe es **mono-cuenta/mono-precio** (`CNG_PRICE_ID`, `STRIPE_SECRET_KEY` únicos, `mode=subscription`). Multi-revendedor exige **Stripe Connect** o cuentas por tenant (no contemplado).
5. **Imágenes de producto**: bucket por tenant, privado/público, thumbnails (hoy todo Unsplash/URL).
6. **Cliente Supabase configurable** por dominio/branding en runtime.

---

## 12. Estado actual y huecos

### ✅ Construido y funcionando (con backend real)
- **Auth + onboarding completo:** invitación → wizard → pago Stripe → KYC Stripe Identity, con estados derivados (`memberStatus.js`).
- **Webhooks con firma HMAC:** `cng-stripe-webhook` y `cng-identity-webhook` validan firma (cerró la vulnerabilidad histórica documentada en `auditoria-chilliums-2026-04-16/`). Idempotencia por `stripe_event_id`.
- **Reparto de Chilliums 50/35/15** sobre `$5.50`, con `referral_tree`, `transactions`, `platform_roles`, `chilliums_ledger`.
- **Chilliums banking-grade en la base:** columnas `bigint` (centi), RPC `apply_chilliums(bigint)` con lock, ledger con FKs `ON DELETE RESTRICT` (ADR-11 desplegado), display vía `formatChilliums`.
- **Capa social madura:** feed, mensajería casi-WhatsApp (`ChatScreen` ~4.2k líneas), stories, presencia, red de referidos (1 nivel en UI). RLS habilitado en las tablas `cng_*`. Integridad referencial real (216 FKs).

### 🟡 A medias / inconsistente
- **`Dashboard.jsx`** fuera del árbol de rutas (`/dashboard`→feed); `/network` y `/app/network` duplican la vista de red (`Network.jsx` vs `NetworkScreen.jsx`).
- **`cng_members` (legacy)** coexiste con `identity_profiles` (ADR-01 migración en progreso); `chilliums_balance` `numeric` vs `bigint`.
- **`subscriptions`** existe pero el webhook no la usa (usa `identity_profiles.payment_status`).
- **Maquetas de marketplace** (Travel/Nutrition/RealEstate/Store/StoreLocal): UI lista, **sin backend, sin catálogo, sin checkout**.

### 🔴 Drift / riesgos (prioridad)
1. **Código de webhook commiteado ≠ desplegado/diseño.** `supabase/functions/cng-stripe-webhook/index.ts` (rama) usa `creditChilliums` con **float read-modify-write** y **no** `apply_chilliums`; las columnas son `bigint`. La base y el deploy real (desde worktree, v61) reflejan ADR-11. **Conciliar: traer a la rama el código realmente desplegado.**
2. **Deploy desde worktrees** (`.claude/worktrees/stupefied-heyrovsky-e4bbad/`) para `cng-create-checkout`, `cng-stripe-webhook`, `cng-identity-webhook`, `cng-issue-welcome-session`. Viola `CLAUDE.md` y rompe la trazabilidad del código de producción.
3. **Funciones no versionadas:** `cng-create-portal` (desplegada, ausente del repo) y `cng-issue-welcome-session` (declarada en `config.toml`, fuente en worktree). Más un set genérico anterior (`create-checkout`, `stripe-webhook`, `create-portal-session`…) desplegado y fuera del repo.
4. **Esquema CNG fuera de migraciones:** `social-tables.sql` y los `ALTER` posteriores se aplicaron a mano; `list_migrations` no contiene nada de CNG. Sin `supabase db pull`, no hay fuente de verdad versionada del esquema.
5. **`add_chilliums(numeric)` ejecutable por `anon`** (advisor): superficie de acuñación de lealtad sin auth. Revocar EXECUTE.
6. **Compliance — landing ↔ motor de pago no conciliados:** la landing legal dice **$7 y 1 nivel**; el checkout cobra **$10 activación + $7/mes** y el webhook reparte a **2 niveles de upline** (L1 35% + L2 15%). Para la rama `compliance-pass`, este desajuste entre lo que se promete y lo que el código ejecuta es **material** y debe resolverse (alinear código a la landing, o landing a la realidad, con revisión legal).
7. **Higiene de seguridad:** anon key y `pk_test` hardcodeadas; `VITE_GIPHY_KEY` en el bundle; bucket `cng-media` público con listado; protección de contraseñas filtradas desactivada.

### Falta para la tienda de ropa white-label
- **Todo el modelo de datos comercial** (productos, variantes, inventario, pedidos, tiendas/revendedores) — no existe.
- **Capa de tenancy** (columnas + RLS por tenant + resolución por dominio).
- **Pagos multi-revendedor** (Stripe Connect / `mode=payment` / split de comisión y su interacción con Chilliums).
- **Logística** (envíos, direcciones de shipping multi-dirección, impuestos MX↔US) — `address_*` actuales son para KYC.
- **Pipeline de imágenes de producto** (buckets por tenant, thumbnails).

---

## Recomendaciones de integración

Lectura de ingeniería sobre la forma más limpia de montar la tienda de ropa white-label **encima** de lo existente, sin romper la app social/membresía.

### A. Primero: estabilizar la base (pre-requisito, antes de construir la tienda)
1. **Reconciliar código ↔ deploy:** ejecutar `supabase functions download` de las funciones CNG y `supabase db pull` del esquema, y **commitear** todo a la rama. Dejar de desplegar desde `.claude/worktrees/`. Sin esto, cualquier feature nueva se construye sobre una fuente de verdad incierta (riesgo #1–#4 de §12).
2. **Cerrar el desajuste de compliance** (precio y niveles) con decisión de negocio + legal, dado que la rama es `compliance-pass`.
3. **Endurecer seguridad:** revocar `EXECUTE` de `add_chilliums` a `anon`; mover secretos/keys a env; revisar el bucket `cng-media` (privado para documentos).

### B. Arquitectura multi-tenant recomendada (white-label con inventario central)
- **Tenancy por columna, no por proyecto.** Añadir `tenant_id` (FK a una nueva tabla `stores`/`resellers`) a las tablas comerciales nuevas. Mantener **un solo proyecto Supabase** (inventario y operación centralizados, que es el objetivo); el "white-label" es de **branding y vitrina**, no de datos separados.
- **Resolución de marca por host.** Una tabla `stores(id, slug, domain, subdomain, brand_config jsonb, owner_user_id)`. En el frontend, resolver el tenant por `window.location.host` al cargar (sin tocar el cliente Supabase, que sigue siendo único). En Vercel, usar wildcard domains/subdominios apuntando al mismo SPA.
- **Inventario central + catálogo por revendedor.** `products` (marca central, SKU, descripción) + `product_variants` (talla/color/precio/stock) en inventario **propio y compartido**; tabla puente `store_products(store_id, product_id, override_price?, is_listed)` para que cada revendedor "publique" del catálogo central bajo su marca. El stock se descuenta del inventario central (una sola verdad).
- **Roles sobre `platform_roles` (ya existe).** Introducir `role ∈ {admin, wholesaler/reseller, client}` con `platform='cng_store'` (o `lob`). Gating en `ProtectedRoute`/pantallas **y** en RLS (`tenant_id` + rol). Esto reutiliza infraestructura existente en vez de inventar un sistema nuevo.
- **Pedidos:** `orders(tenant_id, buyer_user_id, status, totals)` + `order_items(order_id, variant_id, qty, unit_price)`.

### C. Pagos (la decisión más cara)
- Para cobrar a clientes finales **a nombre del revendedor** y liquidar a la plataforma, evaluar **Stripe Connect** (cuentas conectadas por revendedor + `application_fee`). Si al inicio el cobro lo hace siempre Chill N Go (inventario propio) y al revendedor se le paga comisión por separado, basta **`mode=payment`** en una variante de `cng-create-checkout` + una tabla de comisiones — más simple, y deja Connect para una fase 2.
- **Definir la interacción Chilliums ↔ compra de producto:** ¿el cashback de compra usa la misma `apply_chilliums` y el mismo reparto? Reusar el ledger atómico ya existente; no crear un segundo sistema de puntos.

### D. Frontend
- Reutilizar el **patrón visual de `StoreScreen.jsx`** pero conectándolo a `store_products`/`product_variants` (hoy el filtro de categoría ni siquiera funciona — habrá que reescribirlo). El patrón de fetch ya está probado en `FeedScreen`/`ExploreScreen`.
- Inyectar `brand_config` (logo, colores, nombre) del tenant en `stitch.jsx`/tema, para que la vitrina herede la marca del revendedor sin forks de código.

### E. Decisiones / información que faltan (a confirmar con el negocio)
1. **Compliance:** ¿precio final $7 o $10+$7? ¿1 nivel (landing) o 2 (código)? Define el reparto y el copy legal.
2. **Modelo white-label:** ¿el revendedor solo elige qué publicar del catálogo central, o también sube productos propios? ¿Pone su propio precio (`override_price`) o es precio fijo central?
3. **Cobro:** ¿la plataforma cobra siempre (inventario propio) y paga comisión al revendedor, o cobra el revendedor vía Stripe Connect? Esto decide Connect vs. `mode=payment`.
4. **Vitrina:** ¿subdominio (`revendedor.chillngostore.com`) o dominio propio del revendedor? Define la config de Vercel y la tabla `stores`.
5. **Inventario:** ¿un solo almacén central o varios? ¿reservas de stock al agregar al carrito?
6. **Logística e impuestos** MX↔US para ropa física (no existe nada hoy).

---

## Apéndice — Verificaciones en vivo realizadas (Supabase MCP, proyecto `jahnlhzbjcbmjnuzxsvj`)

- `list_edge_functions` → estado real de despliegue (§7.1), incluido el origen `.claude/worktrees/…`.
- `execute_sql` sobre `pg_constraint` → **216 FKs** totales, **54 en `cng_*`** (corrige el falso "0 FKs"); definiciones de FKs de `chilliums_ledger`/`cng_posts`/`cng_messages`.
- `execute_sql` sobre `pg_proc` → confirmadas **ambas** RPC `add_chilliums(numeric)` y `apply_chilliums(bigint, …)`.
- `execute_sql` sobre `information_schema.columns` → columnas de `platform_roles`, `transactions`, `subscriptions`.
- `execute_sql` → `chilliums_ledger.amount` y `identity_profiles.chilliums_balance` son **`bigint`**; CHECK de `cng_posts` aún admite `candystakes` (migración sin aplicar).
- `get_advisors` (security/performance) → hallazgos de §4.4 (RLS, `add_chilliums` anon, bucket público, etc.).

*Documento generado a partir de lectura directa del repositorio y de una auditoría multi-agente con verificación adversarial contra la base de datos en vivo. Donde un dato no se pudo confirmar, se marcó como "No encontrado" o "Pendiente".*
