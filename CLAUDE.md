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

### 4. Auditoría de Chilliums en curso
Existe documentación en `auditoria-chilliums-2026-04-16/`. 
Consúltala antes de tocar código relacionado con Chilliums, webhooks
de Stripe, o cálculos de reparto 50/35/15.
