#!/usr/bin/env bash
# statusline.sh — statusLine del arnés: contexto usado sobre el límite de trabajo (200K), siempre visible.
# El % nativo solo aparece junto al autocompact; aquí se ve desde el principio y avisa a tiempo del handoff.
#   <75 %: gris · 75–79 %: amarillo · ≥80 %: rojo con «/lf:handoff».
# LF_CTX_LIMIT cambia el límite (por defecto 200000). Entrada: JSON de Claude Code por stdin.
LIMIT="${LF_CTX_LIMIT:-200000}"
command -v jq >/dev/null || { echo "ctx ?"; exit 0; }
IFS=$'\t' read -r used model < <(jq -r '(.context_window.current_usage // {}) as $u
  | [ (($u.input_tokens // 0) + ($u.cache_creation_input_tokens // 0) + ($u.cache_read_input_tokens // 0)),
      (.model.display_name // "") ] | @tsv' 2>/dev/null)
used="${used:-0}"
pct=$(( used * 100 / LIMIT ))
k=$(( used / 1000 ))
if   [ "$pct" -ge 80 ]; then col='\033[31m'; tail=' → /lf:handoff'
elif [ "$pct" -ge 75 ]; then col='\033[33m'; tail=''
else col='\033[2m'; tail=''; fi
printf "${col}ctx %sk/%sk %s%%%s\033[0m" "$k" "$((LIMIT / 1000))" "$pct" "$tail"
[ -n "$model" ] && printf ' · %s' "$model"
printf '\n'
