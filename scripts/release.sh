#!/usr/bin/env bash
# release.sh — comprobaciones previas a publicar una versión del plugin lf. Sin CI: se lanza a mano.
#   bash scripts/release.sh            versiones, validate --strict, test-hooks (incluye node --test) y tag --dry-run
#   bash scripts/release.sh --evals    además, la suite plugins/lf/evals (gasta tokens: tope 5 USD)
# No crea el tag ni hace push: tras un OK, `claude plugin tag plugins/lf --push` lo decide el mantenedor.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
fail=0
step() { printf '\n== %s\n' "$1"; }
bad()  { printf '  FAIL %s\n' "$1"; fail=$((fail+1)); }
ok()   { printf '  ok   %s\n' "$1"; }

for cmd in jq node claude; do command -v "$cmd" >/dev/null || { echo "Falta $cmd en el PATH"; exit 1; }; done

step "versiones"
PJ=plugins/lf/.claude-plugin/plugin.json; MP=.claude-plugin/marketplace.json
v=$(jq -r .version "$PJ")
[ "$(jq -r '.plugins[0].version' "$MP")" = "$v" ] && ok "marketplace.json plugin = $v" || bad "marketplace.json plugin != $v"
[ "$(jq -r '.metadata.version' "$MP")" = "$v" ] && ok "marketplace.json metadata = $v" || bad "marketplace.json metadata != $v"
[ "$(sed -n '1s/.*lf-harness \([0-9][^ ]*\) .*/\1/p' plugins/lf/home/CLAUDE.md)" = "$v" ] && ok "marca de CLAUDE.md = $v" || bad "marca <!-- lf-harness X.Y.Z --> de home/CLAUDE.md != $v"
grep -q "^## \[$v\]" CHANGELOG.md && ok "CHANGELOG tiene [$v]" || bad "CHANGELOG sin sección [$v]"

step "claude plugin validate --strict"
claude plugin validate . --strict >/dev/null 2>&1 && ok "marketplace + plugin" || { bad "validate . --strict"; claude plugin validate . --strict 2>&1 | tail -15; }
claude plugin validate plugins/lf --strict >/dev/null 2>&1 && ok "plugins/lf (skills, agentes, comandos)" || { bad "validate plugins/lf --strict"; claude plugin validate plugins/lf --strict 2>&1 | tail -15; }

step "scripts/test-hooks.sh (hooks y node --test tests/)"
if out=$(bash scripts/test-hooks.sh 2>&1); then ok "$(printf '%s\n' "$out" | tail -1)"; else bad "test-hooks"; printf '%s\n' "$out" | grep -E "FAIL|Resultado" | head -20; fi

step "claude plugin tag --dry-run"
if out=$(claude plugin tag plugins/lf --dry-run 2>&1); then ok "$(printf '%s\n' "$out" | tail -1)"; else bad "tag --dry-run (¿cambios sin commitear o versiones desiguales?)"; printf '%s\n' "$out" | tail -5; fi

if [ "${1:-}" = "--evals" ]; then
  step "plugin evals (tope 5 USD; pregunta confianza la primera vez)"
  claude plugin eval plugins/lf --allow-tools Write Edit --max-cost-usd 5 --no-publish --no-scaffold -j 3 || bad "evals (exit $?)"
fi

echo; [ "$fail" -eq 0 ] && echo "Listo para publicar $v." || echo "$fail comprobación(es) fallida(s): no publicar."
[ "$fail" -eq 0 ]
