#!/usr/bin/env bash
# session-start.sh — hook SessionStart del plugin lf (antes check-drift.sh).
# Silencioso salvo en estos casos (una línea cada uno):
#   1. ~/.claude/CLAUDE.md no lleva la marca `<!-- lf-harness X.Y.Z -->` en la línea 1 → sin configurar.
#   2. La marca no coincide con la versión del plugin → actualizado, falta /lf:setup.
#   3. GSD ha re-registrado hooks gsd-* distintos de write-guard en settings.json.
#   4. El proyecto tiene .planning/config.json de GSD en modo caro (auto_advance, plan-checker
#      o perfil distinto de budget).
#   5. settings.json conserva allows amplios de versiones antiguas (o el hook de RTK) → /lf:setup.
#   6. Claude Code es anterior a la versión mínima que declara el arnés.
#   6b. El autoCompactWindow efectivo (proyecto o usuario) es <220000.
#   7. Existe handoff.md en el cwd → léelo primero.
#   8. Hay ≥5 sesiones (o ≥7 días con alguna) sin consolidar en este proyecto → /lf:dream.
set -uo pipefail
MIN_CLAUDE="2.1.295"
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
settings="$dir/settings.json"
claude_md="$dir/CLAUDE.md"
command -v jq >/dev/null 2>&1 || exit 0

# versión del plugin (CLAUDE_PLUGIN_ROOT; si no está, ruta relativa al propio script)
root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)}"
ver=$(jq -r '.version // empty' "$root/.claude-plugin/plugin.json" 2>/dev/null || true)

if [ -n "$ver" ]; then
  mark=$(head -n 1 "$claude_md" 2>/dev/null | grep -oE '^<!-- lf-harness [^ ]+ -->$' || true)
  mark="${mark#<!-- lf-harness }"; mark="${mark% -->}"
  if [ -z "$mark" ]; then
    echo "Arnés LF sin configurar: ejecuta /lf:setup"
  elif [ "$mark" != "$ver" ]; then
    echo "Arnés LF actualizado a $ver: ejecuta /lf:setup"
  fi
fi

if [ -f "$settings" ]; then
  n=$(jq -r '[.hooks // {} | .[][]? | .hooks[]? | .command // "" | select(test("/gsd-") and (test("gsd-write-guard")|not))] | length' "$settings" 2>/dev/null || echo 0)
  if [ "${n:-0}" -gt 0 ]; then
    echo "lf: GSD ha re-registrado $n hook(s) en settings.json; ejecuta /lf:setup --only=gsd para volver a podarlos."
  fi
  old=$(jq -r '[ (.permissions.allow // [])[] | select(. as $a | ["Bash(bin/console *)","Bash(wp *)","Bash(npx *)","Bash(node *)","Bash(php -r *)","Bash(vendor/bin/*)","Bash(rtk *)"] | index($a)) ]
               + [ .hooks // {} | .[][]? | .hooks[]? | .command // "" | select(test("rtk hook")) ] | length' "$settings" 2>/dev/null || echo 0)
  if [ "${old:-0}" -gt 0 ]; then
    echo "lf: settings.json conserva $old regla(s) antigua(s) (allows amplios o RTK); ejecuta /lf:setup --only=settings para migrarlas."
  fi
fi

cfg=".planning/config.json"
if [ -f "$cfg" ] && jq -e '.workflow.auto_advance == true or .workflow.plan_check != false or (.model_profile // "balanced") != "budget"' "$cfg" >/dev/null 2>&1; then
  echo "lf: $cfg de GSD en modo caro (auto_advance, plan-checker o planner en Opus); ajústalo con: bash \"$root/scripts/gsd-lean.sh\""
fi

# autoCompactWindow efectivo (proyecto local > proyecto > usuario) por debajo de 220000: el autocompact salta
# hacia window − 33K y no deja sitio al handoff (ADR 0021).
acw=$(jq -rs 'map(.autoCompactWindow // empty) | first // empty' .claude/settings.local.json .claude/settings.json "$settings" 2>/dev/null || true)
if [ -n "$acw" ] && [ "$acw" -lt 220000 ] 2>/dev/null; then
  echo "lf: autoCompactWindow efectivo es $acw (<220000): el autocompact se adelanta al handoff; súbelo a 220000 en el settings que lo fija."
fi

if [ -f handoff.md ]; then
  echo "lf: existe handoff.md ($(date -r handoff.md +%F 2>/dev/null || echo 'sin fecha')): léelo primero."
fi

# Sesiones del proyecto sin consolidar: transcripts más nuevos que memory/.dream-state.json (mismo nombre de
# carpeta que usa Claude Code: el cwd con todo lo no alfanumérico a «-»).
pdir="$dir/projects/$(pwd | sed 's/[^a-zA-Z0-9]/-/g')"
if [ -d "$pdir" ]; then
  state="$pdir/memory/.dream-state.json"
  if [ -f "$state" ]; then n=$(find "$pdir" -maxdepth 1 -name '*.jsonl' -newer "$state" 2>/dev/null | wc -l)
  else n=$(find "$pdir" -maxdepth 1 -name '*.jsonl' 2>/dev/null | wc -l); fi
  days=$(jq -r 'try ((now - (.lastRun | fromdateiso8601)) / 86400 | floor) // 0' "$state" 2>/dev/null || echo 0)
  if [ "${n:-0}" -ge 5 ] || { [ "${n:-0}" -ge 1 ] && [ "${days:-0}" -ge 7 ]; }; then
    echo "lf: $n sesión(es) sin consolidar en la memoria de este proyecto; ejecuta /lf:dream."
  fi
fi

if command -v claude >/dev/null 2>&1; then
  cv=$(timeout 2 claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true)
  if [ -n "$cv" ] && [ "$(printf '%s\n%s\n' "$MIN_CLAUDE" "$cv" | sort -V | head -n 1)" != "$MIN_CLAUDE" ]; then
    echo "lf: Claude Code $cv es anterior a $MIN_CLAUDE (mínimo del arnés: onFailure, Concise, modelSettings); actualiza."
  fi
fi
exit 0
