#!/usr/bin/env bash
# install.sh — instala en ~/.claude la parte del arnés lefebvriano-holder que un plugin no puede aportar.
#
#   deps       bubblewrap + socat (sandbox de Bash en Linux/WSL2)
#   claude-md  ~/.claude/CLAUDE.md global (política S/M/L) y docs en ~/.claude/lf/docs/ (las enlaza su índice)
#   settings   fusiona home/settings.lf.json en ~/.claude/settings.json (modelo, permisos, sandbox, plugins);
#              antes retira lo que el arnés puso en versiones anteriores (manifiesto ~/.claude/lf/managed.json)
#   gsd        si GSD está instalado: poda sus hooks (deja write-guard), perfil `core`, quita agentes sueltos
#   taste     OPCIONAL (no va por defecto; actívalo con --with-taste o --only=taste): habilita el plugin
#              taste-skill (Leonxlnx/taste-skill, MIT) para diseño anti-slop; Claude Code lo descarga al abrir sesión
#
# El plugin `lf` (skills, agentes, hooks) se instala aparte desde Claude Code:
#   /plugin marketplace add Lf-SergioDominguez/lf-holder
#   /plugin install lf@lefebvriano-holder
#   /lf:setup   (ejecuta este script desde la caché del plugin)
#
# Uso: plugins/lf/scripts/install.sh [--only=deps,claude-md,settings,gsd,taste] [--with-taste] [--dry-run] [--no-sandbox] [--windows] [--yes] [--rollback]
#   --with-taste  añade el paso taste a los pasos por defecto
#   --dry-run     muestra qué haría (diffs) sin tocar nada
#   --no-sandbox  no instala deps ni activa sandbox; usa permissions.defaultMode=dontAsk y los allows de home/settings.nosandbox.json
#   --windows     permite instalar en Windows nativo (Git Bash); implica --no-sandbox
#   --yes         no pide confirmación en los pasos gsd/taste (no activa taste-skill por sí solo)
#   --rollback    restaura el último backup de settings.json y CLAUDE.md y sale
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # raíz del plugin (plugins/lf, o su copia en la caché)
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
BACKUPS="$CLAUDE_DIR/backups"
ONLY="deps,claude-md,settings,gsd"
WITH_TASTE=0
DRY=0; NOSANDBOX=0; WINDOWS=0; YES=0; ROLLBACK=0

for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
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

# node: lo necesitan el clasificador de Bash (bash-gate) y el recorte de salida. Se guarda su ruta
# en ~/.claude/lf/node-path para que los hooks lo encuentren aunque el PATH del hook no lo incluya (nvm, fnm).
if [ "$ROLLBACK" -eq 0 ]; then
  if ! command -v node >/dev/null; then
    echo "node es necesario (≥18; el arnés recomienda ≥22): instálalo y repite /lf:setup" >&2
    exit 1
  fi
  node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  [ "$node_major" -ge 18 ] || { echo "node $(node -v) es demasiado antiguo (mínimo 18)" >&2; exit 1; }
  if [ "$DRY" -eq 1 ]; then echo "  (dry-run) escribir $(command -v node) en $CLAUDE_DIR/lf/node-path"
  else mkdir -p "$CLAUDE_DIR/lf"; command -v node > "$CLAUDE_DIR/lf/node-path"; fi
fi

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
  dst="$CLAUDE_DIR/CLAUDE.md"
  # La marca de la línea 1 se escribe con la versión de plugin.json: session-start la compara con
  # ella, y una marca fija en home/CLAUDE.md se desfasaba y avisaba en cada sesión tras /lf:setup.
  ver=$(jq -r '.version // empty' "$ROOT/.claude-plugin/plugin.json")
  src=$(mktemp); trap 'rm -f "$src"' EXIT
  { echo "<!-- lf-harness $ver -->"; sed '1{/^<!-- lf-harness .* -->$/d}' "$ROOT/home/CLAUDE.md"
    # memoria de usuario (≤40 líneas; la consolida /lf:dream); respeta CLAUDE_CONFIG_DIR
    case "$CLAUDE_DIR" in "$HOME"/*) imp="~${CLAUDE_DIR#"$HOME"}" ;; *) imp="$CLAUDE_DIR" ;; esac
    printf '\n@%s/lf/memory/USER.md\n' "$imp"; } > "$src"
  if [ -f "$dst" ] && ! cmp -s "$src" "$dst"; then
    run cp "$dst" "$BACKUPS/CLAUDE.md.lf-$(date +%Y%m%d-%H%M%S).bak"
    log "CLAUDE.md existente respaldado en $BACKUPS"
  fi
  if [ "$DRY" -eq 1 ]; then echo "  (dry-run) cp $src $dst"; [ -f "$dst" ] && diff "$dst" "$src" || true
  else cp "$src" "$dst"; log "CLAUDE.md global instalado ($(wc -l <"$dst") líneas)"; fi

  # Docs que el índice de CLAUDE.md enlaza: ruta estable ~/.claude/lf/docs (el plugin vive en una caché versionada).
  docs_dst="$CLAUDE_DIR/lf/docs"
  if [ "$DRY" -eq 1 ]; then echo "  (dry-run) cp $ROOT/docs/*.md $docs_dst/"
  else mkdir -p "$docs_dst" && cp "$ROOT"/docs/*.md "$docs_dst/" && log "docs instaladas en $docs_dst"; fi

  # House style: ruta estable ~/.claude/lf/house-style. Si el usuario lo cambió con /lf:house-style
  # (marca .custom) no se pisa; si el plugin no trae house-style, no hay nada que copiar.
  hs_dst="$CLAUDE_DIR/lf/house-style"
  if [ ! -d "$ROOT/house-style" ]; then :
  elif [ -f "$hs_dst/.custom" ]; then log "house style personalizado (.custom); se conserva"
  elif [ "$DRY" -eq 1 ]; then echo "  (dry-run) cp $ROOT/house-style/*.md $hs_dst/"
  else mkdir -p "$hs_dst" && cp "$ROOT"/house-style/*.md "$hs_dst/" && log "house style instalado en $hs_dst"; fi

  # Memoria de usuario: el @import del CLAUDE.md necesita que el fichero exista; nunca se sobrescribe.
  user_md="$CLAUDE_DIR/lf/memory/USER.md"
  if [ -f "$user_md" ]; then log "USER.md ya existe; se conserva"
  elif [ "$DRY" -eq 1 ]; then echo "  (dry-run) crear $user_md"
  else
    mkdir -p "$CLAUDE_DIR/lf/memory/notes"
    printf '%s\n' '# Memoria de usuario' '' '<!-- Lo que vale para todos los proyectos. ≤40 líneas, un hecho por línea; lo consolida /lf:dream. -->' > "$user_md"
    log "creado $user_md"
  fi
fi

# ---------------------------------------------------------------- settings.json
if step settings; then
  # El sandbox replica las reglas `deny Read(...)` y falla si un directorio denegado no existe: garantizamos ~/.ssh.
  [ -d "$HOME/.ssh" ] || { run mkdir -p "$HOME/.ssh"; run chmod 700 "$HOME/.ssh"; }
  # Cachés que el sandbox debe poder escribir (sandbox.filesystem.allowWrite); bwrap falla si no existen.
  for d in .npm .cache .bun .config/composer; do [ -d "$HOME/$d" ] || run mkdir -p "$HOME/$d"; done
  # statusLine del arnés: ruta estable ~/.claude/lf/statusline.sh (la referencia settings.lf.json).
  if [ "$DRY" -eq 1 ]; then echo "  (dry-run) cp $ROOT/scripts/statusline.sh $CLAUDE_DIR/lf/"
  else mkdir -p "$CLAUDE_DIR/lf" && cp "$ROOT/scripts/statusline.sh" "$CLAUDE_DIR/lf/statusline.sh" && log "statusline instalada en $CLAUDE_DIR/lf/statusline.sh"; fi
  # RTK retirado: `rtk init` añadía `@RTK.md` al CLAUDE.md global (coste fijo por sesión).
  if grep -q '^@RTK\.md[[:space:]]*$' "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null; then
    run cp "$CLAUDE_DIR/CLAUDE.md" "$BACKUPS/CLAUDE.md.lf-$(date +%Y%m%d-%H%M%S).bak"
    if [ "$DRY" -eq 1 ]; then echo "  (dry-run) quitar la línea @RTK.md de $CLAUDE_DIR/CLAUDE.md"
    else sed -i '/^@RTK\.md[[:space:]]*$/d' "$CLAUDE_DIR/CLAUDE.md"; log "quitada la referencia @RTK.md de CLAUDE.md"; fi
  fi
  # --prune: retira antes lo que el arnés puso en versiones anteriores (manifiesto o managed-legacy.json).
  args=("$ROOT/home/settings.lf.json" --target "$SETTINGS" --prune)
  [ "$DRY" -eq 1 ] && args+=(--dry-run)
  [ "$NOSANDBOX" -eq 1 ] && args+=(--no-sandbox)
  bash "$ROOT/scripts/merge-settings.sh" "${args[@]}"
  if [ "$NOSANDBOX" -eq 1 ]; then
    # Sin sandbox no hay auto-allow: se añaden los allows amplios; el gate sigue imponiendo ask/deny.
    args=("$ROOT/home/settings.nosandbox.json" --target "$SETTINGS" --no-sandbox)
    [ "$DRY" -eq 1 ] && args+=(--dry-run)
    bash "$ROOT/scripts/merge-settings.sh" "${args[@]}"
  fi
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
