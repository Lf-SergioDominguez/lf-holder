#!/usr/bin/env bash
# statusline.sh — statusLine del arnés: contexto usado sobre el punto real de autocompact, siempre visible.
# Claude Code compacta hacia autoCompactWindow − ~33K (≈20K de reserva de salida + ≈13K de margen), no al 100 %
# de la ventana: con 200000 salta hacia los 167K (83 %). Por eso el denominador es ese umbral y no 200K.
#   faltan ≥30K: gris · <30K: amarillo · <20K: rojo con «/lf:handoff» (el handoff necesita ~5–10K).
# autoCompactWindow se lee como Claude Code: settings.local.json y settings.json del proyecto, después el de usuario.
# LF_CTX_LIMIT fuerza el umbral en tokens. Entrada: JSON de Claude Code por stdin.
BUFFER=33000
command -v jq >/dev/null || { echo "ctx ?"; exit 0; }
# Separador \x1f y no tab: read colapsa tabs consecutivos y un campo vacío desplazaría el resto.
IFS=$'\x1f' read -r used model proj < <(jq -r '(.context_window.current_usage // {}) as $u
  | [ (($u.input_tokens // 0) + ($u.cache_creation_input_tokens // 0) + ($u.cache_read_input_tokens // 0)),
      (.model.display_name // ""), (.workspace.project_dir // .cwd // "") ] | map(tostring) | join("\u001f")' 2>/dev/null)
used="${used:-0}"
if [ -n "${LF_CTX_LIMIT:-}" ]; then
  LIMIT="$LF_CTX_LIMIT"
else
  win=$(jq -rs 'map(.autoCompactWindow // empty) | first // empty' \
    "$proj/.claude/settings.local.json" "$proj/.claude/settings.json" \
    "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" 2>/dev/null)
  LIMIT=$(( ${win:-200000} - BUFFER ))
fi
left=$(( LIMIT - used ))
pct=$(( used * 100 / LIMIT ))
if   [ "$left" -lt 20000 ]; then col='\033[31m'; tail=' → /lf:handoff'
elif [ "$left" -lt 30000 ]; then col='\033[33m'; tail=''
else col='\033[2m'; tail=''; fi
printf "${col}ctx %sk/%sk %s%%%s\033[0m" "$((used / 1000))" "$((LIMIT / 1000))" "$pct" "$tail"
[ -n "$model" ] && printf ' · %s' "$model"
printf '\n'
