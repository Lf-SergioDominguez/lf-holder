# 0003 — Sandbox en WSL2 requiere `enableWeakerNestedSandbox`

Fecha: 2026-09-18

Decisión: `sandbox.enableWeakerNestedSandbox: true` en el fragmento global.
Motivo: en WSL2 (Ubuntu 24.04, usuario root) el filtro seccomp embebido en Claude Code falla con `apply-seccomp: write /proc/self/uid_map: Operation not permitted` aunque `bwrap --unshare-user` funciona a mano. Con el modo anidado débil el sandbox arranca y sigue bloqueando escrituras fuera del proyecto (verificado: `touch /etc/x` → read-only). Se pierde el bloqueo de sockets Unix y el `/proc` fresco; aceptable porque el aislamiento fuerte no era el objetivo, sino auto-aprobar Bash sin prompts.
Alternativa descartada: `--no-sandbox` + `dontAsk` (queda como fallback en `install.sh`).
