#!/usr/bin/env bash
# statusline.sh — statusLine del arnés: contexto usado sobre el límite de trabajo (200K), siempre visible.
#   <75 %: gris · 75–79 %: amarillo · ≥80 %: rojo con «/lf:handoff» (el handoff necesita ~5–10K).
# Claude Code compacta hacia autoCompactWindow − ~33K, no al 100 % de la ventana: el arnés fija 253000 para que el
# autocompact salte hacia los 220K y deje margen tras el 80 %. Si un settings fija una ventana menor (p. ej. 200000
# en el del proyecto → compacta a ~167K), el denominador baja a ese umbral real para que el aviso llegue a tiempo.
# autoCompactWindow se lee como Claude Code: settings.local.json y settings.json del proyecto, después el de usuario.
# LF_CTX_LIMIT fuerza el denominador en tokens. Entrada: JSON de Claude Code por stdin.
WORK=200000 BUFFER=33000
command -v jq >/dev/null || { echo "ctx ?"; exit 0; }
# Separador \x1f y no tab: read colapsa tabs consecutivos y un campo vacío desplazaría el resto.
IFS=$'\x1f' read -r used model proj < <(jq -r '(.context_window.current_usage // {}) as $u
  | [ (($u.input_tokens // 0) + ($u.cache_creation_input_tokens // 0) + ($u.cache_read_input_tokens // 0)),
      (.model.display_name // ""), (.workspace.project_dir // .cwd // "") ] | map(tostring) | join("\u001f")' 2>/dev/null)
used="${used:-0}"
if [ -n "${LF_CTX_LIMIT:-}" ]; then
  LIMIT="$LF_CTX_LIMIT"
else
  files=("${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json")
  [ -n "$proj" ] && files=("$proj/.claude/settings.local.json" "$proj/.claude/settings.json" "${files[@]}")
  win=$(jq -rs 'map(.autoCompactWindow // empty) | first // empty' "${files[@]}" 2>/dev/null)
  case "$win" in ''|*[!0-9]*) win=200000 ;; esac
  real=$(( win - BUFFER ))
  LIMIT=$(( real < WORK ? real : WORK ))
fi
# Un LF_CTX_LIMIT o una ventana absurdos (0, «200k», ≤33000) no deben dejar la statusline vacía por dividir entre 0.
case "$LIMIT" in ''|*[!0-9]*|0) LIMIT=$WORK ;; esac
pct=$(( used * 100 / LIMIT ))
if   [ "$pct" -ge 80 ]; then col='\033[31m'; tail=' → /lf:handoff'
elif [ "$pct" -ge 75 ]; then col='\033[33m'; tail=''
else col='\033[2m'; tail=''; fi
printf "${col}ctx %sk/%sk %s%%%s\033[0m" "$((used / 1000))" "$((LIMIT / 1000))" "$pct" "$tail"
[ -n "$model" ] && printf ' · %s' "$model"
printf '\n'
