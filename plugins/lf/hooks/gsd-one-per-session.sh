#!/usr/bin/env bash
# gsd-one-per-session.sh — hooks UserPromptSubmit y PreToolUse(Skill) del plugin lf.
#
# Una sola orden GSD pesada por sesión. Encadenar plan-phase → execute-phase → siguiente fase
# en el mismo contexto (auto_advance, --auto, o el agente llamando a Skill) lo hace crecer
# hasta compactar varias veces, y cada turno relee todo lo acumulado: es el grueso del coste.
# La primera orden pesada de la sesión (escrita por la persona o lanzada con Skill) se anota;
# cualquier otra se bloquea con el motivo y el paso siguiente (/clear y relanzar).
# /clear abre una sesión con otro session_id, así que el contador vuelve a cero.
#
# Órdenes pesadas: new-project, new-milestone, discuss-phase, plan-phase, execute-phase,
#   verify-work, code-review, ui-phase, autonomous, quick. El resto (progress, pause-work,
#   config, help…) pasa siempre.
# Escape (lo fija la persona en su entorno; el agente no puede): LF_GSD_ONE_PER_SESSION=0.
# Estado: ${TMPDIR:-/tmp}/lf-gsd-sessions/<session_id>; se borra tras 2 días sin uso.
# Sin jq o sin session_id → passthrough.
set -uo pipefail

[ "${LF_GSD_ONE_PER_SESSION:-1}" = "0" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
event=$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)
sid=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
[[ "$sid" =~ ^[A-Za-z0-9._-]+$ ]] || exit 0

if [ "$event" = "UserPromptSubmit" ]; then
  name=$(printf '%s' "$input" | jq -r '.prompt // "" | sub("^\\s+"; "") | capture("^/(?<n>\\S+)").n // empty' 2>/dev/null)
else
  name=$(printf '%s' "$input" | jq -r '.tool_input.skill // empty' 2>/dev/null)
fi
# gsd:plan-phase → gsd-plan-phase; <plugin>:gsd-plan-phase → gsd-plan-phase
name="${name#/}"; name="${name//[[:space:]]/}"; name="${name/#gsd:/gsd-}"; name="${name##*:}"

case "$name" in
  gsd-new-project|gsd-new-milestone|gsd-discuss-phase|gsd-plan-phase|gsd-execute-phase|\
  gsd-verify-work|gsd-code-review|gsd-ui-phase|gsd-autonomous|gsd-quick) ;;
  *) exit 0 ;;
esac

dir="${TMPDIR:-/tmp}/lf-gsd-sessions"
mkdir -p "$dir" 2>/dev/null || exit 0
find "$dir" -maxdepth 1 -type f -mtime +2 -delete 2>/dev/null
state="$dir/$sid"

if [ ! -s "$state" ]; then
  printf '%s\n' "$name" > "$state"
  exit 0
fi
touch "$state" 2>/dev/null  # la purga cuenta desde el último uso, no desde la creación

prev=$(head -n 1 "$state")
reason="lf: esta sesión ya ejecutó /$prev; una orden GSD pesada por sesión para no acumular contexto ni compactar. Haz /clear (y /model claude-sonnet-5-5 si estás en Opus) y lanza /$name en la sesión nueva."
if [ "$event" = "UserPromptSubmit" ]; then
  jq -cn --arg r "$reason" '{decision: "block", reason: $r}'
else
  jq -cn --arg r "$reason Si eres un agente: no reintentes; termina el turno y pásale a la persona la orden exacta." '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
fi
exit 0
