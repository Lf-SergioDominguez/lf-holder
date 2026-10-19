#!/usr/bin/env bash
# install.sh — instala en ~/.claude la parte del arnés lefebvriano-holder que un plugin no puede aportar.
#
#   deps       bubblewrap + socat (sandbox de Bash en Linux/WSL2)
#   claude-md  ~/.claude/CLAUDE.md global (política S/M/L)
#   settings   fusiona home/settings.lf.json en ~/.claude/settings.json (modelo, permisos, sandbox, plugins)
#   gsd        si GSD está instalado: poda sus hooks (deja write-guard), perfil `core`, quita agentes sueltos
#   rtk        OPCIONAL (no va por defecto; actívalo con --with-rtk o --only=rtk): instala RTK (rtk-ai/rtk),
#              fusiona home/settings.rtk.json y registra su hook global `rtk hook claude`
#   taste      OPCIONAL (no va por defecto; actívalo con --with-taste o --only=taste): habilita el plugin
#              taste-skill (Leonxlnx/taste-skill, MIT) para diseño anti-slop; Claude Code lo descarga al abrir sesión
#
# El plugin `lf` (skills, agentes, hooks) se instala aparte desde Claude Code:
#   /plugin marketplace add Lf-SergioDominguez/lf-holder
#   /plugin install lf@lefebvriano-holder
#   /lf:setup   (ejecuta este script desde la caché del plugin)
#
# Uso: plugins/lf/scripts/install.sh [--only=deps,claude-md,settings,gsd,rtk,taste] [--with-rtk] [--with-taste] [--dry-run] [--no-sandbox] [--windows] [--yes] [--rollback]
#   --with-rtk    añade el paso rtk a los pasos por defecto (deps,claude-md,settings,gsd)
#   --with-taste  añade el paso taste a los pasos por defecto
#   --dry-run     muestra qué haría (diffs) sin tocar nada
#   --no-sandbox  no instala deps ni activa sandbox; usa permissions.defaultMode=dontAsk
#   --windows     permite instalar en Windows nativo (Git Bash); implica --no-sandbox
#   --yes         no pide confirmación en los pasos gsd/rtk/taste (no activa RTK ni taste-skill por sí solo)
#   --rollback    restaura el último backup de settings.json y CLAUDE.md y sale
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # raíz del plugin (plugins/lf, o su copia en la caché)
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
BACKUPS="$CLAUDE_DIR/backups"
ONLY="deps,claude-md,settings,gsd"
WITH_RTK=0
WITH_TASTE=0
DRY=0; NOSANDBOX=0; WINDOWS=0; YES=0; ROLLBACK=0

for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --with-rtk) WITH_RTK=1 ;;
    --with-taste) WITH_TASTE=1 ;;
    --dry-run) DRY=1 ;;
    --no-sandbox) NOSANDBOX=1 ;;
    --windows) WINDOWS=1 ;;
    --yes|-y) YES=1 ;;
    --rollback) ROLLBACK=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $arg" >&2; exit 1 ;;
  esac
done
[ "$WITH_RTK" -eq 1 ] && ONLY="$ONLY,rtk"
[ "$WITH_TASTE" -eq 1 ] && ONLY="$ONLY,taste"

log()  { printf '\033[1;34m[lf]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[lf]\033[0m %s\n' "$*" >&2; }
step() { case ",$ONLY," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }
confirm() { [ "$YES" -eq 1 ] && return 0; read -r -p "$1 [s/N] " r; [[ "$r" =~ ^[sSyY]$ ]]; }
run() { if [ "$DRY" -eq 1 ]; then echo "  (dry-run) $*"; else "$@"; fi; }

# Windows nativo (Git Bash/MSYS/Cygwin): sin --windows suele ser la extensión de VS Code instalada solo en
# local aunque la ventana esté conectada a WSL, y se para antes de tocar ~/.claude de Windows. Con --windows
# se instala a propósito en Windows, sin sandbox (no soportado ahí): defaultMode=dontAsk.
IS_WINDOWS=0
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
esac
# --rollback solo restaura backups: se permite en Windows sin --windows.
if [ "$IS_WINDOWS" -eq 1 ] && [ "$WINDOWS" -eq 0 ] && [ "$ROLLBACK" -eq 0 ]; then
  cat >&2 <<'EOF'
[lf] Claude Code se está ejecutando en Windows nativo, no en WSL.
     Si la ventana de VS Code ya está conectada a WSL, la extensión Claude Code está instalada solo en local:
       1. Extensiones → Claude Code → «Install in WSL: <distro>» (debe aparecer en «WSL: <distro> - Installed»).
       2. Ctrl+Shift+P → «Developer: Reload Window».
       3. En el panel de Claude: /plugins → añade Lf-SergioDominguez/lf-holder e instala lf (alcance user).
       4. /lf:setup
     No lances este script desde WSL con la ruta C:/…
     Si quieres instalarlo en Windows sin WSL (sin sandbox): /lf:setup --windows
EOF
  exit 2
fi
if [ "$WINDOWS" -eq 1 ]; then
  if [ "$IS_WINDOWS" -eq 1 ]; then
    NOSANDBOX=1
    warn "modo Windows nativo: sin sandbox (permissions.defaultMode=dontAsk)"
  else
    echo "[lf] --windows solo vale en Windows nativo (Git Bash); aquí uname es $(uname -s). Repite sin --windows." >&2
    exit 2
  fi
fi

if ! command -v jq >/dev/null; then
  if [ "$IS_WINDOWS" -eq 1 ]; then
    echo "jq es necesario: ejecuta en PowerShell «winget install jqlang.jq», reinicia VS Code y repite /lf:setup --windows" >&2
  else
    echo "jq es necesario (apt-get install jq)" >&2
  fi
  exit 1
fi
mkdir -p "$CLAUDE_DIR" "$BACKUPS"

# ---------------------------------------------------------------- rollback
if [ "$ROLLBACK" -eq 1 ]; then
  last=$(ls -t "$BACKUPS"/settings.json.lf-*.bak 2>/dev/null | head -1 || true)
  if [ -n "$last" ]; then run cp "$last" "$SETTINGS"; log "settings.json restaurado desde $last"; else warn "no hay backups de settings.json"; fi
  lastmd=$(ls -t "$BACKUPS"/CLAUDE.md.lf-*.bak 2>/dev/null | head -1 || true)
  if [ -n "$lastmd" ]; then run cp "$lastmd" "$CLAUDE_DIR/CLAUDE.md"; log "CLAUDE.md restaurado desde $lastmd"; fi
  exit 0
fi

# ---------------------------------------------------------------- deps (sandbox)
step deps && [ "$NOSANDBOX" -eq 1 ] && log "sin sandbox: paso deps omitido"
if step deps && [ "$NOSANDBOX" -eq 0 ]; then
  if [[ "$(uname -s)" == "Linux" ]]; then
    missing=()
    command -v bwrap >/dev/null || missing+=(bubblewrap)
    command -v socat >/dev/null || missing+=(socat)
    if [ ${#missing[@]} -gt 0 ]; then
      if command -v apt-get >/dev/null; then
        log "instalando dependencias del sandbox: ${missing[*]}"
        if [ "$(id -u)" -eq 0 ]; then
          run apt-get install -y -qq "${missing[@]}"
        elif ! [ -t 0 ]; then
          # sin TTY (p. ej. lanzado desde Claude Code) sudo no puede pedir contraseña: se deja el comando al usuario
          warn "sin TTY: ejecuta tú en un terminal: sudo apt-get install -y ${missing[*]}"
        else
          run sudo apt-get install -y -qq "${missing[@]}"
        fi
      else
        warn "instala manualmente: ${missing[*]} (o usa --no-sandbox)"
      fi
    else
      log "dependencias del sandbox presentes (bwrap, socat)"
    fi
    if sysctl -n kernel.apparmor_restrict_unprivileged_userns 2>/dev/null | grep -q '^1$'; then
      warn "AppArmor restringe user namespaces; sigue la guía 'Ubuntu 24.04' de https://code.claude.com/docs/en/sandboxing o usa --no-sandbox"
    fi
  fi
fi

# ---------------------------------------------------------------- CLAUDE.md global
if step claude-md; then
  src="$ROOT/home/CLAUDE.md"; dst="$CLAUDE_DIR/CLAUDE.md"
  if [ -f "$dst" ] && ! cmp -s "$src" "$dst"; then
    run cp "$dst" "$BACKUPS/CLAUDE.md.lf-$(date +%Y%m%d-%H%M%S).bak"
    log "CLAUDE.md existente respaldado en $BACKUPS"
  fi
  if [ "$DRY" -eq 1 ]; then echo "  (dry-run) cp $src $dst"; [ -f "$dst" ] && diff "$dst" "$src" || true
  else cp "$src" "$dst"; log "CLAUDE.md global instalado ($(wc -l <"$dst") líneas)"; fi
fi

# ---------------------------------------------------------------- settings.json
if step settings; then
  # El sandbox replica las reglas `deny Read(...)` y falla si un directorio denegado no existe: garantizamos ~/.ssh.
  [ -d "$HOME/.ssh" ] || { run mkdir -p "$HOME/.ssh"; run chmod 700 "$HOME/.ssh"; }
  # Cachés que el sandbox debe poder escribir (sandbox.filesystem.allowWrite); bwrap falla si no existen.
  for d in .npm .cache .bun .config/composer; do [ -d "$HOME/$d" ] || run mkdir -p "$HOME/$d"; done
  args=("$ROOT/home/settings.lf.json" --target "$SETTINGS")
  [ "$DRY" -eq 1 ] && args+=(--dry-run)
  [ "$NOSANDBOX" -eq 1 ] && args+=(--no-sandbox)
  bash "$ROOT/scripts/merge-settings.sh" "${args[@]}"
fi

# ---------------------------------------------------------------- GSD
if step gsd; then
  if [ -d "$CLAUDE_DIR/gsd-core" ]; then
    if [ "$YES" -eq 1 ] || confirm "GSD detectado. ¿Podar hooks (todos salvo write-guard), aplicar perfil 'core' y retirar agentes sueltos?"; then
      args=(--target "$SETTINGS"); [ "$DRY" -eq 1 ] && args+=(--dry-run)
      bash "$ROOT/scripts/prune-gsd-hooks.sh" "${args[@]}"

      # perfil core: replica /gsd-surface profile core con los módulos internos de GSD (scripts/gsd-surface.cjs)
      profile=$(jq -r '.baseProfile // empty' "$CLAUDE_DIR/.gsd-surface.json" 2>/dev/null || true)
      if [ "$profile" = "core" ]; then
        log "GSD ya en perfil core"
      elif [ "$DRY" -eq 1 ]; then
        echo "  (dry-run) node $ROOT/scripts/gsd-surface.cjs core --config-dir $CLAUDE_DIR"
      elif command -v node >/dev/null && node "$ROOT/scripts/gsd-surface.cjs" core --config-dir "$CLAUDE_DIR"; then
        :
      else
        warn "GSD: aplica el perfil desde una sesión de Claude Code con: /gsd-surface profile core"
      fi

      # agentes sueltos que cargan descripción en cada turno y ya no se usan
      for f in "$CLAUDE_DIR/agents/_template.md" "$CLAUDE_DIR/agents/seo-wpo-auditor.md"; do
        if [ -f "$f" ]; then
          run mkdir -p "$BACKUPS/agents"
          run mv "$f" "$BACKUPS/agents/$(basename "$f").$(date +%Y%m%d-%H%M%S)"
          log "retirado $(basename "$f") → $BACKUPS/agents/ (el auditor SEO vive ahora en /lf:seo-audit)"
        fi
      done
      if [ -d "$CLAUDE_DIR/agents/knowledge/seo-wpo-auditor" ]; then
        run mv "$CLAUDE_DIR/agents/knowledge/seo-wpo-auditor" "$BACKUPS/agents/knowledge-seo-wpo-auditor.$(date +%Y%m%d-%H%M%S)"
      fi
    fi
  else
    log "GSD no está instalado; nada que podar"
  fi
fi

# ---------------------------------------------------------------- RTK
if step rtk; then
  if [ "$YES" -eq 1 ] || confirm "¿Instalar/configurar RTK (filtra la salida de comandos Bash antes de llegar al modelo)?"; then
    if ! command -v rtk >/dev/null; then
      log "instalando RTK en ~/.local/bin"
      run bash -c 'curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh'
      export PATH="$HOME/.local/bin:$PATH"
    fi
    if command -v rtk >/dev/null; then
      if ! rtk gain >/dev/null 2>&1 && ! rtk --version 2>/dev/null | grep -qi 'rtk'; then
        warn "el binario 'rtk' no parece ser rtk-ai/rtk (¿'Rust Type Kit' de crates.io?). Revisa 'which rtk'."
      fi
      log "RTK $(rtk --version 2>/dev/null | head -1)"
      # permisos y escritura de caché de RTK (opcionales, fuera de settings.lf.json)
      run mkdir -p "$HOME/.local/share/rtk"
      args=("$ROOT/home/settings.rtk.json" --target "$SETTINGS")
      [ "$DRY" -eq 1 ] && args+=(--dry-run)
      [ "$NOSANDBOX" -eq 1 ] && args+=(--no-sandbox)
      bash "$ROOT/scripts/merge-settings.sh" "${args[@]}"
      if [ "$DRY" -eq 1 ]; then echo "  (dry-run) rtk init -g --hook-only --auto-patch"
      else
        # --hook-only: solo registra el hook PreToolUse (deep-merge con backup propio). Sin él, rtk init
        # crea RTK.md y añade una referencia @RTK.md a nuestro CLAUDE.md global (coste fijo por sesión).
        # --auto-patch evita la confirmación interactiva (sin TTY rtk solo imprime instrucciones).
        rtk init -g --hook-only --auto-patch
        log "hook 'rtk hook claude' registrado en settings.json"
        if grep -q '@RTK.md' "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null; then
          warn "CLAUDE.md contiene una referencia @RTK.md añadida por rtk; elimínala para no cargar RTK.md en cada sesión"
        fi
      fi
      if [ -f "$ROOT/home/rtk/filters.toml" ]; then
        run mkdir -p "$HOME/.config/rtk"
        if [ -f "$HOME/.config/rtk/filters.toml" ] && ! cmp -s "$ROOT/home/rtk/filters.toml" "$HOME/.config/rtk/filters.toml"; then
          run cp "$HOME/.config/rtk/filters.toml" "$BACKUPS/rtk-filters.toml.$(date +%Y%m%d-%H%M%S).bak"
        fi
        run cp "$ROOT/home/rtk/filters.toml" "$HOME/.config/rtk/filters.toml"
        log "filtros RTK propios instalados en ~/.config/rtk/filters.toml"
      fi
    else
      warn "RTK no disponible en PATH tras la instalación; añade ~/.local/bin al PATH y repite --only=rtk"
    fi
  fi
fi

# ---------------------------------------------------------------- taste-skill
if step taste; then
  if [ "$YES" -eq 1 ] || confirm "¿Habilitar taste-skill (diseño anti-slop; más pesada que frontend-design)?"; then
    args=("$ROOT/home/settings.taste.json" --target "$SETTINGS")
    [ "$DRY" -eq 1 ] && args+=(--dry-run)
    [ "$NOSANDBOX" -eq 1 ] && args+=(--no-sandbox)
    bash "$ROOT/scripts/merge-settings.sh" "${args[@]}"
    log "taste-skill habilitado: Claude Code lo descarga al abrir la sesión (solo el plugin principal, no taste-skill-classics)"
  fi
fi

# ---------------------------------------------------------------- resumen
if [ "$DRY" -eq 0 ]; then
  echo
  log "listo. Siguientes pasos dentro de Claude Code:"
  echo "   /plugin marketplace add Lf-SergioDominguez/lf-holder"
  echo "   /plugin install lf@lefebvriano-holder"
  echo "   /sandbox      → comprueba que no aparece la pestaña Dependencies"
  echo "   /permissions  → defaultMode acceptEdits y reglas cargadas"
  echo "   /context      → CLAUDE.md global visible; listado de skills reducido"
  echo "   Reinicia la sesión para que los hooks nuevos se carguen."
  if [ "$IS_WINDOWS" -eq 1 ]; then
    echo
    warn "Windows y WSL tienen configuraciones separadas (C:\\Users\\<usuario>\\.claude frente a ~/.claude de la distro)."
    warn "Si también usas VS Code conectado a WSL, instala allí el plugin lf (/plugins) y repite /lf:setup."
  fi
fi
