# Onboarding — lefebvriano-holder

Arnés de Claude Code del equipo web. Te da: triaje automático de tareas (S/M/L) sin preguntas ni prompts de permiso en tareas pequeñas y medianas, recorte de salidas ruidosas, skills de nuestro stack y un flujo para tareas grandes por hitos. Objetivo medido: −60 % de tokens por tarea.

## Requisitos

- Claude Code ≥ 2.1.295 (`claude --version`), Linux, macOS o **WSL2**. Windows nativo también, pero sin sandbox (`/lf:setup --windows`, `jq` con `winget install jqlang.jq`).
- `jq` y `node` ≥ 22 (los hooks `bash-gate` y `trim-output` lo usan). En Linux/WSL2, `bubblewrap` y `socat` (el instalador te da el comando `sudo` si faltan).
- No hace falta clonar el repo ni tener credenciales de Git: el marketplace es público (`Lf-SergioDominguez/lf-holder`).
- Si tenías GSD instalado, el arnés ya no lo usa; puedes desinstalarlo o dejarlo, no interfiere con el flujo.

## Instalación (10 minutos)

Dentro de Claude Code (CLI o extensión de VS Code), en cualquier proyecto:

```text
/plugin marketplace add Lf-SergioDominguez/lf-holder
/plugin install lf@lefebvriano-holder
/lf:setup
```

Al abrir una sesión nueva tras instalar el plugin verás el aviso «Arnés LF sin configurar: ejecuta /lf:setup»: es normal. `/lf:setup` hace primero una simulación (`--dry-run`) y resume qué cambiaría; después ejecuta el instalador de verdad (CLAUDE.md global, settings) con backup en `~/.claude/backups/`. Como escribe en `~/.claude`, que está protegido, se ejecuta fuera del sandbox y Claude te pide permiso. Antes de la simulación te guía con una pregunta de multiselección sobre lo opcional (sin marcar nada, solo se aplica la base: dependencias, CLAUDE.md y settings): **taste-skill** (diseño anti-slop; más potente y configurable que `frontend-design`, pero más pesada; el inspector necesita Node 22+ y Chrome/Edge/Chromium). Argumentos opcionales: `/lf:setup --with-taste` (lo activa sin preguntar), `/lf:setup --only=settings,claude-md` (sin guía), `/lf:setup --rollback`. Para quitar taste-skill: `/plugin uninstall taste-skill@taste-skill`.

La base incluye la skill **Modern Web Guidance** de Google (`modern-web-guidance@googlechrome`), con más de 200 guías actualizadas de HTML, CSS, JS de cliente, Core Web Vitals, accesibilidad y seguridad, con datos de Baseline. Claude Code la descarga al abrir sesión y la actualiza solo (`autoUpdate`); las guías salen siempre de `npx modern-web-guidance@latest`. No tienes que invocarla ni aprender sus comandos: el arnés la consulta solo cuando tocas UI o JS de cliente, y al final te indica qué guías ha aplicado. Pide «moderniza este proyecto» o «audita los patrones legacy de `src/`» y lanza su escaneo. Fija el objetivo de navegadores de cada proyecto en la sección «Navegadores» de su `CLAUDE.md`; si no lo fijas, se aplica Baseline Widely available. Requiere Node.js 22 o superior. El arnés desactiva su telemetría hacia Google con `DISABLE_TELEMETRY=1`. Para desactivarla: `/plugin disable modern-web-guidance@googlechrome`.

Si faltan `bubblewrap` y `socat`, `sudo` no puede pedirte la contraseña desde Claude: te muestra `sudo apt-get install -y bubblewrap socat` para que lo ejecutes tú con `!` o en un terminal.

Reinicia la sesión.

### Comprobar que funciona

| Comando                | Debes ver                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/sandbox`             | Sin pestaña «Dependencies»; modo auto-allow                                                                           |
| `/permissions`         | `defaultMode: acceptEdits`, reglas allow/ask/deny cargadas                                                            |
| `/hooks`               | `lf` (bash-gate, trim-output, guard-read, log-permission, session-start, precompact) |
| `/context`             | CLAUDE.md global visible (<3K tokens); listado de skills corto (las skills `lf` con `paths` no aparecen hasta tocar ficheros) |
| Pide un cambio pequeño | Empieza con `Triaje: S — …` y termina sin haberte preguntado nada                                                     |

### Si los comandos fallan con `apply-seccomp: write /proc/self/uid_map`
Es el filtro seccomp de Claude Code en WSL2. El fragmento ya trae `sandbox.enableWeakerNestedSandbox: true`, que lo resuelve; si aun así falla, usa la opción sin sandbox.

### Sin sandbox (si `bwrap` no funciona en tu máquina)

`/lf:setup --no-sandbox` → usa `permissions.defaultMode: dontAsk` con la misma allowlist: lo no permitido se deniega en silencio y Claude lo ve y reformula.

## Si usas la extensión de VS Code en vez de la CLI

Todo lo que instala el arnés (settings globales, CLAUDE.md, plugin, hooks) es común a la extensión y a la CLI. Pasos específicos:

1. La CLI es opcional: los tres comandos de instalación funcionan escritos en el cuadro de prompt de la extensión. Instálala solo si quieres usar `claude plugin …` o `scripts/install.sh` desde el terminal; la extensión no añade `claude` al PATH.
2. En Windows, abre VS Code conectado a WSL (*WSL: Connect to WSL*). La extensión debe ejecutarse dentro de WSL para usar el `~/.claude` de WSL y el sandbox de Bash (no soportado en Windows nativo). Comprueba en Extensiones que Claude Code figura en *WSL: \<distro\> - Installed*; si solo está en *Local*, pulsa **Install in WSL** y *Developer: Reload Window*. Si no lo haces, la extensión corre en Windows aunque la ventana esté en WSL, y `/lf:setup` te pregunta si quieres instalarlo en WSL (y te explica cómo) o en Windows nativo, sin sandbox y con `dontAsk`. Windows y WSL **no comparten** `~/.claude`: si usas la extensión en ambos, instala el plugin `lf` y ejecuta `/lf:setup` en cada uno.
3. En el panel de Claude escribe `/plugins`: pestaña **Marketplaces** → añade `Lf-SergioDominguez/lf-holder`; pestaña **Plugins** → instala `lf`, alcance *user*. Es lo mismo que `claude plugin marketplace add` + `claude plugin install`.
4. Escribe `/lf:setup` en el cuadro de prompt y aprueba el permiso fuera del sandbox.
5. **Modo de permisos**: la extensión puede ignorar `permissions.defaultMode` de `settings.json`. Elige una vez **Edit automatically** en el indicador de modo (abajo en el cuadro de prompt) y se mantiene en las siguientes conversaciones, o fíjalo en los ajustes de VS Code: `Ctrl+,` → Extensions → Claude Code → **Initial Permission Mode** → `acceptEdits`. Sin esto arrancarás en *Manual* y volverás a ver prompts de edición.
6. Comprueba con `/context`, `/hooks` y `/permissions` en el cuadro de prompt, igual que en la CLI.

## Uso diario

- **Empieza cada tarea en una sesión limpia** (`/clear`). Es gratis; `/compact` no.
- Describe la tarea. Claude la clasifica solo:
  - **S** (bug, texto, estilo, ≤3 ficheros): implementa, verifica y te entrega. Cero preguntas.
  - **M** (endpoint nuevo, componente, entidad + migración): escribe un contrato de 15 líneas, sigue solo, revisa con `lf:reviewer` y entrega con sus asunciones. Corriges después.
  - **L** (módulo, feature grande): `lf:l` te hace ≤5 preguntas de una vez, escribe `.planning/ARCHITECTURE.md`, pide un OK y ejecuta por hitos con `lf:executor` (un hito por sesión, `/clear` entre medias; el estado queda en `.planning/STATE.md`).
- Para discutir la clasificación antes: `/lf:triage <tarea>`. Para forzarla: `/lf:s`, `/lf:m`, `/lf:l`.
- Modelo: `claude-sonnet` (el más nuevo) por defecto; Haiku para todo subagente ruidoso. Para planificar una L: `/model claude-opus` (el más nuevo) y vuelve a Sonnet para ejecutar. **Fable no se usa en ningún flujo.** Detalle: [MODELOS.md](../plugins/lf/docs/MODELOS.md).
- Atajos: `/lf:opusplan` (Opus planifica y Sonnet ejecuta), `/lf:ultracode` (sesión entera a xhigh y multiagente); para razonar a fondo en un solo turno escribe `ultrathink` en el prompt.
- Contexto: **nunca compactes**. Al 75–80 % de contexto, `/lf:handoff` y `/clear`; la statusline del arnés muestra el % de contexto sobre 200K (amarillo al 75 %, rojo al 80 %); la compactación automática (`autoCompactWindow` a 253000, salta hacia los 220K) es solo la red de seguridad de una sesión que ya se pasó de larga. `/compact` solo como último recurso y con instrucciones de qué conservar.
- Auditoría SEO/WPO/a11y: `/lf:seo-audit <ficheros o URL>`.
- Commit y `git push`: solo si se lo pides, y te preguntará (`ask`). PRs y `--amend` los haces tú.

## Por proyecto

Copia `project-templates/CLAUDE.md` al repo del proyecto y rellena **solo** cómo se ejecuta (local vs `docker compose exec`), mapa rápido y zonas delicadas (≤50 líneas). Si necesitas permisos extra, `project-templates/settings.local.json` → `<repo>/.claude/settings.local.json`.

## Actualizar

```text
/plugin marketplace update lefebvriano-holder
/lf:setup
```

Al iniciar sesión, `session-start` compara la marca de versión de tu `~/.claude/CLAUDE.md` con la del plugin y te avisa («Arnés LF actualizado a X: ejecuta /lf:setup») si no coinciden.
También avisa si hay un `handoff.md` en el proyecto («léelo primero») y si hay ≥5 sesiones (o ≥7 días) sin consolidar: ejecuta `/lf:dream`.

## Medir tu consumo

```bash
scripts/measure.sh --since 2026-09-01
```

Agrega tus transcripts locales (nada sale de tu máquina) y te da coste estimado, contexto medio por turno y turnos por sesión. Compara antes/después.

## Desinstalar / volver atrás

- `/lf:setup --rollback` restaura el último backup de `settings.json` y `CLAUDE.md` (en `~/.claude/backups/`).
- `/plugin uninstall lf@lefebvriano-holder`.
- Kill-switch de todos los hooks: `"disableAllHooks": true` en `~/.claude/settings.json`.

## Problemas frecuentes

- **Sigue preguntando permisos**: mira `~/.claude/lf-metrics/permissions.tsv` para ver qué comando lo provocó y consulta [PERMISOS.md](../plugins/lf/docs/PERMISOS.md); si es legítimo, añádelo a `settings.local.json` del proyecto (o propón el cambio global en un PR). `LF_GATE=shadow` hace que `bash-gate` solo registre sin decidir.
- **`/hooks` muestra reglas antiguas en `settings.json`**: `/lf:setup --only=settings` las migra.
- **El sandbox bloquea Docker/MySQL**: ya están en `sandbox.excludedCommands`; si usas otro cliente, añádelo ahí.
- **Aviso «Arnés LF sin configurar» o «actualizado a X»**: `/lf:setup`.
