#!/usr/bin/env bash
# measure.sh — agrega el consumo de tokens de Claude Code a partir de los transcripts locales.
#
# Lee ~/.claude/projects/**/*.jsonl (incluidos subagentes), deduplica por requestId y emite:
#   sessions.tsv  — una fila por sesión (turnos, input, cache_read, cache_write, output, coste estimado)
#   daily.tsv     — una fila por día y modelo
#   summary.txt   — totales y ratios clave (cache_read por turno, coste por sesión)
#
# Uso: scripts/measure.sh [--since YYYY-MM-DD] [--out DIR]
#   --since  fecha mínima (por defecto: 30 días atrás)
#   --out    directorio de salida (por defecto: metrics/<fecha-de-hoy>)
#
# Precios (USD por millón de tokens) — ajustar en PRICES si cambian. Los ID con sufijo de fecha
# (claude-haiku-4-5-20251001) se normalizan. Haiku 5.5 tiene dos tramos: por encima de 100k tokens
# de prompt (input + cache_read + cache_write) la petición entera paga el tramo `@long`.
set -euo pipefail

SINCE=$(date -d '30 days ago' +%F 2>/dev/null || date -v-30d +%F)
OUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $1" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
OUT="${OUT:-$ROOT/metrics/$(date +%F)}"
mkdir -p "$OUT"

command -v jq >/dev/null || { echo "jq es necesario" >&2; exit 1; }

# input, output, cache_write, cache_read por MTok
PRICES='{
  "claude-sonnet-5-5":        {"in":2,  "out":10,   "cw":2.5,   "cr":0.10},
  "claude-opus-5-5":          {"in":4,  "out":20,   "cw":5,     "cr":0.20},
  "claude-fable-5-1":         {"in":10, "out":50,   "cw":12.5,  "cr":0.25},
  "claude-haiku-5-5":         {"in":0.10, "out":0.50, "cw":0.125, "cr":0.01},
  "claude-haiku-5-5@long":    {"in":0.50, "out":2.50, "cw":0.625, "cr":0.05},
  "claude-haiku-4-5":         {"in":1,  "out":5,    "cw":1.25,  "cr":0.10},
  "claude-sonnet-5":          {"in":2,  "out":10,   "cw":2.5,   "cr":0.20},
  "claude-opus-5":            {"in":5,  "out":25,   "cw":6.25,  "cr":0.50},
  "default":                  {"in":4,  "out":20,   "cw":5,     "cr":0.20}
}'

mapfile -t FILES < <(find "$CLAUDE_DIR/projects" -name '*.jsonl' -newermt "$SINCE" 2>/dev/null)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "No hay transcripts desde $SINCE en $CLAUDE_DIR/projects" >&2; exit 1
fi

# Extrae solo lo necesario de cada línea para no cargar 80 MB en memoria.
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
for f in "${FILES[@]}"; do
  sub=0; case "$f" in */subagents/*) sub=1 ;; esac
  proj=$(basename "$(dirname "${f%%/subagents/*}")")
  jq -c --arg proj "$proj" --argjson sub "$sub" --arg since "$SINCE" '
    select(.type=="assistant" and .message.usage and (.timestamp // "") >= $since and ((.message.model // "") | startswith("<") | not))
    | {proj:$proj, sub:$sub, sid:.sessionId, rid:(.requestId // .uuid), day:(.timestamp[0:10]),
       model:((.message.model // "unknown") | sub("-[0-9]{8}$"; "")),
       i:(.message.usage.input_tokens//0), o:(.message.usage.output_tokens//0),
       cr:(.message.usage.cache_read_input_tokens//0), cw:(.message.usage.cache_creation_input_tokens//0)}' \
    "$f" 2>/dev/null >> "$TMP" || true
done

jq -s --argjson P "$PRICES" '
  def price(m): ($P[m] // $P["default"]);
  def cost: (if .model == "claude-haiku-5-5" and (.i+.cr+.cw) > 100000 then "claude-haiku-5-5@long" else .model end) as $k
    | (.i*price($k).in + .o*price($k).out + .cw*price($k).cw + .cr*price($k).cr) / 1e6;
  # dedupe: un requestId puede aparecer en varias líneas (bloques del mismo mensaje)
  (group_by(.sid + "|" + .rid) | map(.[-1])) as $rows
  | {
    sessions: ($rows | group_by(.sid) | map({
        session:.[0].sid, project:.[0].proj, day:(map(.day)|min), model:(map(.model)|unique|join("+")),
        turns:(map(select(.sub==0))|length), sub_turns:(map(select(.sub==1))|length),
        input:(map(.i)|add), cache_read:(map(.cr)|add), cache_write:(map(.cw)|add), output:(map(.o)|add),
        cost_usd:((map(cost)|add)*100|round/100)
      }) | sort_by(.day)),
    daily: ($rows | group_by(.day + "|" + .model) | map({
        day:.[0].day, model:.[0].model, turns:length,
        input:(map(.i)|add), cache_read:(map(.cr)|add), cache_write:(map(.cw)|add), output:(map(.o)|add),
        cost_usd:((map(cost)|add)*100|round/100)
      }) | sort_by(.day)),
    total: {
        sessions:($rows|map(.sid)|unique|length), turns:($rows|length),
        input:($rows|map(.i)|add), cache_read:($rows|map(.cr)|add), cache_write:($rows|map(.cw)|add), output:($rows|map(.o)|add),
        cost_usd:(($rows|map(cost)|add)*100|round/100)
      }
  }' "$TMP" > "$OUT/usage.json"

tsv() { jq -r --arg k "$1" '.[$k] | (.[0]|keys_unsorted|@tsv), (.[]|[.[]]|@tsv)' "$OUT/usage.json"; }
tsv sessions > "$OUT/sessions.tsv"
tsv daily    > "$OUT/daily.tsv"

jq -r '.total as $t |
  "Periodo desde:        '"$SINCE"'",
  "Sesiones:             \($t.sessions)",
  "Turnos (requests):    \($t.turns)",
  "Input:                \($t.input)",
  "Cache read:           \($t.cache_read)  (\(($t.cache_read*100/($t.input+$t.cache_read+$t.cache_write+$t.output))|round)% del volumen)",
  "Cache write:          \($t.cache_write)",
  "Output:               \($t.output)",
  "Coste estimado (USD): \($t.cost_usd)",
  "Cache read / turno:   \(($t.cache_read/$t.turns)|round)   <- proxy del tamaño medio de contexto",
  "Coste / sesión (USD): \(($t.cost_usd/$t.sessions)*100|round/100)",
  "Turnos / sesión:      \(($t.turns/$t.sessions)|round)"' "$OUT/usage.json" | tee "$OUT/summary.txt"

echo; echo "Ficheros en $OUT: usage.json sessions.tsv daily.tsv summary.txt"
