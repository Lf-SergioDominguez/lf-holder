#!/usr/bin/env bash
# evals.sh — lanza los evals reales del plugin lf (`claude plugin eval`) y compara con la ejecución anterior.
#
# Uso: scripts/evals.sh [--baseline] [--all] [--case GLOB]... [--runs N] [--max-cost-usd USD] [--keep-temp]
#   (sin opciones)  casos 06–09, 2 runs por caso, tope de 5 USD, sin ablación
#   --baseline      activa with-without (ejecuta además sin el plugin: ~2x coste)
#   --all           añade los casos 01–05 (usan prompt.md + graders/*.md, no case.yaml)
#   --case GLOB     solo los casos que casen (repetible; solo admite `*`, no `[6-9]`)
#   --runs N        runs por caso (por defecto 2)
#   --max-cost-usd  tope total (por defecto 5 USD), repartido a partes iguales entre los casos
#   --keep-temp     conserva los scaffolds en /tmp/claude-eval-*
# Lo lanza el mantenedor (gasta tokens, ~0,10–0,15 USD por caso y run): no va en CI ni en test-hooks.sh.
# Salida en ${TMPDIR:-/tmp}; el histórico queda en plugins/lf/evals/results/summary.jsonl (ignorado por git).
# Exit: 0 sin regresión · 1 regresión de score (ver evals-compare.mjs) o fallo del eval · 2 run parcial.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNS=2; BUDGET=5; ABLATION=none; ALL=0; KEEP=""; CASES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --baseline) ABLATION=with-without; shift ;;
    --all) ALL=1; shift ;;
    --case) [ $# -ge 2 ] || { echo "--case necesita un valor" >&2; exit 1; }; CASES+=("$2"); shift 2 ;;
    --runs) [ $# -ge 2 ] || { echo "--runs necesita un valor" >&2; exit 1; }; RUNS="$2"; shift 2 ;;
    --max-cost-usd) [ $# -ge 2 ] || { echo "--max-cost-usd necesita un valor" >&2; exit 1; }; BUDGET="$2"; shift 2 ;;
    --keep-temp) KEEP="--keep-temp"; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "argumento desconocido: $1" >&2; exit 1 ;;
  esac
done
case "$RUNS" in ''|*[!0-9]*|0) echo "--runs debe ser un entero > 0" >&2; exit 1 ;; esac
[[ "$BUDGET" =~ ^[0-9]+(\.[0-9]+)?$ ]] || { echo "--max-cost-usd debe ser un número (p. ej. 5 o 2.5)" >&2; exit 1; }

if [ ${#CASES[@]} -eq 0 ]; then
  CASES=('06-*' '07-*' '08-*' '09-*')
  [ "$ALL" -eq 1 ] && CASES=('01-*' '02-*' '03-*' '04-*' '05-*' "${CASES[@]}")
fi

command -v node >/dev/null || { echo "node es necesario" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude es necesario" >&2; exit 1; }

OUT="$(mktemp -d "${TMPDIR:-/tmp}/lf-evals.XXXXXX")"
PER_CASE="$(node -e 'console.log((Number(process.argv[1]) / Number(process.argv[2])).toFixed(2))' "$BUDGET" "${#CASES[@]}")"
JSONS=(); FAILED=0; i=0
for c in "${CASES[@]}"; do
  i=$((i+1)); dir="$OUT/$i"
  echo "== $c (runs $RUNS, tope $PER_CASE USD, ablación $ABLATION)"
  # Sin Bash en la concesión: con ~/.docker/contexts como enlace el eval se niega a arrancar (ver ADR 0026).
  # El exit 1 de claude es «score bajo el umbral»: el resultado existe y lo juzga el comparador.
  rc=0
  claude plugin eval "$ROOT/plugins/lf" --case "$c" --scaffold --allow-tools Edit Write \
    --runs "$RUNS" --max-cost-usd "$PER_CASE" --no-publish --ablation "$ABLATION" --trust-plugin \
    --output-dir "$dir" --report "$dir/report.html" $KEEP || rc=$?
  if [ -f "$dir/aggregate-result.json" ]; then JSONS+=("$dir/aggregate-result.json")
  else echo "sin resultado para $c (exit $rc)" >&2; FAILED=1; fi
done

[ ${#JSONS[@]} -gt 0 ] || { echo "ningún caso produjo resultado" >&2; exit 1; }
echo; echo "== Comparación"
rc=0; node "$ROOT/scripts/evals-compare.mjs" "${JSONS[@]}" || rc=$?
echo "informes: $OUT/*/report.html"
[ "$rc" -ne 0 ] && exit "$rc"
exit "$FAILED"
