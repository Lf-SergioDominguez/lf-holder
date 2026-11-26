---
name: quality-gates
description: Audita si un repo cumple los quality gates del perfil activo (formato, estático, tests, cobertura, BD, SAST/SCA, secretos, E2E/a11y) y lista qué le falta. Solo informa.
argument-hint: "[carpeta]"
allowed-tools: Read Grep Glob Bash(node *quality-gates.mjs*) Bash(gh api repos/*)
---

Audita **$ARGUMENTS** (si está vacío, el directorio actual) contra el checklist `gates.checks` del perfil activo. **Solo informa**: no edites ni crees ficheros ni apliques arreglos.

## Pasos

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/quality-gates.mjs" <carpeta>` (sin `<carpeta>`, el directorio actual). Si `${CLAUDE_PLUGIN_ROOT}` llega vacía o literal, localiza el script con Glob `**/scripts/quality-gates.mjs`. Devuelve JSON: `profile`, `stacks`, `checks[]` (`id`, `gate`, `stack`, `blocks`, `local`, `ci`, `status`, `evidence`, `fix`) y `github` (`repo`, `calls`).
2. Si trae `reason` (sin perfil, sin `gates.checks` o sin stack detectado), dilo en una línea con el motivo y termina; no inventes un checklist.
3. Por cada entrada de `github.calls`, un `gh api` GET en **llamada propia, sin pipes ni redirecciones**, tal cual viene en el JSON. Interpreta la respuesta:
   - `secret-scanning` (`gh api repos/<repo>`): `security_and_analysis.secret_scanning.status` y `secret_scanning_push_protection.status` deben ser `enabled`.
   - `ruleset-main` (`gh api repos/<repo>/rules/branches/main`): debe devolver reglas, no una lista vacía.
   - Si `gh` falla (sin sesión, sin permisos, sin red), esos checks quedan «no comprobado»; no los des por buenos ni por malos.
4. Los checks con `status: github` solo se resuelven con ese paso: `ok` si la respuesta lo confirma, `missing` si no, «no comprobado» si `gh` falló o no hay `github.repo`.

## Informe

- Cabecera: perfil, stacks detectados y repo de GitHub (o «sin remoto github.com»).
- Tabla por gate: `gate | stack | estado | bloquea | evidencia`. Estados: `ok`, `partial` (existe en local o en CI, no en ambos), `missing`, «no comprobado».
- **Para dejarlo a punto**: lista de los `missing` y `partial`, los que `bloquea` primero, con el `fix` del JSON **tal cual**, sin reescribirlo. La plantilla CI que cita el `fix` es `project-templates/quality-gates.yml` del arnés.
- **No comprobado aquí**: E2E y a11y en staging, cobertura real del cambio, y el pipeline de `deployments-web`; esta auditoría solo mira ficheros, dependencias, workflows y la configuración de GitHub.

Termina con una línea: `N ok, N partial, N missing, N no comprobados`.
