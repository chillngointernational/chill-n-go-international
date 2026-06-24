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
