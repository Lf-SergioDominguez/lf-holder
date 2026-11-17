# 0011 — Windows nativo como modo sin sandbox (v0.5.2)

Fecha: 2026-10-13

Decisión: cuando Claude Code corre en Windows nativo (Git Bash), `/lf:setup` pregunta si instalar en WSL o en Windows. En Windows, `install.sh --windows` implica `--no-sandbox`, es decir, `sandbox.enabled: false` y `permissions.defaultMode: dontAsk`. Sin `--windows` el script sigue parando con el aviso de WSL.
Motivo: hay compañeros que usan la extensión de VS Code en Windows a propósito. El sandbox de Bash no existe en Windows nativo, así que se reutiliza el fallback `--no-sandbox` ya probado en lugar de crear otro perfil. Los hooks del plugin funcionan con Git Bash y no hacen nada sin `jq`, por eso se pide instalarlo con winget.
Limitación conocida: `guard-read.sh` compara rutas con `/`; con rutas `C:\…` puede no bloquear `vendor/` ni `node_modules/`.
Alternativa descartada: seguir bloqueando Windows (deja fuera a parte del equipo) e instalar `jq` automáticamente con winget (cambia el sistema del usuario sin que lo pida).
