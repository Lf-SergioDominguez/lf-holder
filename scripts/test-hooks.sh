#!/usr/bin/env bash
# test-hooks.sh — pruebas de los hooks filter-output.sh y guard-read.sh (sin ejecutar nada real).
# filter-output: comando de entrada → se espera "wrap" (updatedInput presente) o "pass" (sin salida).
# guard-read: ruta de entrada → se espera "deny" o "pass".
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/plugins/lf/hooks/filter-output.sh"
fail=0; ok=0

check() {
  local expect="$1" cmd="$2"
  local out; out=$(jq -cn --arg c "$cmd" '{tool_name:"Bash",tool_input:{command:$c}}' | bash "$HOOK" 2>/dev/null)
  local got="pass"; [ -n "$out" ] && got="wrap"
  if [ "$got" = "$expect" ]; then ok=$((ok+1)); printf '  ok   %-4s %s\n' "$expect" "$cmd"
  else fail=$((fail+1)); printf '  FAIL %-4s (got %s) %s\n     -> %s\n' "$expect" "$got" "$cmd" "$out"; fi
  if [ "$got" = "wrap" ]; then
    # el comando envuelto debe ser bash válido y conservar el comando original
    local new; new=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedInput.command')
    bash -n <(printf '%s\n' "$new") || { fail=$((fail+1)); echo "     -> sintaxis inválida: $new"; }
    # con prefijo `cd X && ` el comando va entre llaves: se comprueban el prefijo y el resto por separado
    local cdp="" rest="$cmd"
    if [[ "$cmd" =~ ^(cd[[:space:]]+[^[:space:]]+[[:space:]]+\&\&[[:space:]]+)(.+)$ ]]; then cdp="${BASH_REMATCH[1]}"; rest="${BASH_REMATCH[2]}"; fi
    case "$new" in "$cdp"*) ;; *) fail=$((fail+1)); echo "     -> no conserva el prefijo cd: $new" ;; esac
    case "$new" in *"$rest"*) ;; *) fail=$((fail+1)); echo "     -> no conserva el comando original: $new" ;; esac
  fi
}

echo "filter-output.sh:"
check wrap "php bin/console cache:clear"
check wrap "cd x && php bin/console about"
check wrap "cd ../app && npm run build"
check wrap "bin/console debug:router"
check wrap "docker compose exec php bin/console doctrine:migrations:status"
check wrap "docker-compose exec -T php vendor/bin/phpunit --filter UserTest"
check wrap "docker compose exec -u www-data app php bin/console about"
check wrap "vendor/bin/phpunit tests/Unit"
check wrap "vendor/bin/phpstan analyse src"
check wrap "npm run build"
check wrap "npx astro build"
check wrap "npx vue-tsc --noEmit"
check wrap "composer dump-autoload"
check wrap "npm ci"
check wrap "wp plugin list"
check wrap "mysql -u root app -e 'SHOW TABLES'"
check pass "git status"
check pass "rtk git status"
check pass "ls -la"
check pass "php bin/console cache:clear | tail -n 5"
check pass "php bin/console cache:clear > /tmp/x.log"
check pass "cd x && php bin/console a && echo b"
check pass "cd x; php bin/console about"
check pass "npm run build &"
check pass "npm run build # x"
check pass "cd 'a b' && npm run build"
check pass "cd \$(x) && npm run build"
check pass "FOO=bar php bin/console about"
check pass $'php bin/console about\necho done'
check pass "cat <<'EOF' > f.txt
hola
EOF"

echo "  updatedInput conserva el resto de tool_input:"
out=$(jq -cn '{tool_name:"Bash",tool_input:{command:"npm run build",timeout:600000,description:"build"}}' | bash "$HOOK" 2>/dev/null)
if [ "$(printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedInput | "\(.timeout)|\(.description)"')" = "600000|build" ] \
   && [ "$(printf '%s' "$out" | jq -r '.hookSpecificOutput | has("permissionDecision")')" = "false" ]; then
  ok=$((ok+1)); echo "  ok   timeout y description conservados, sin permissionDecision"
else fail=$((fail+1)); echo "  FAIL updatedInput: $out"; fi

echo "  log por sesión:"
sess() { # sess <session_id|-> <fragmento esperado en el comando envuelto>
  local j out new
  if [ "$1" = "-" ]; then j='{"tool_input":{"command":"npm run build"}}'
  else j=$(jq -cn --arg s "$1" '{session_id:$s,tool_input:{command:"npm run build"}}'); fi
  out=$(printf '%s' "$j" | bash "$HOOK" 2>/dev/null)
  new=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedInput.command')
  if [[ "$new" == *"$2"* ]]; then ok=$((ok+1)); printf '  ok   %s\n' "$2"
  else fail=$((fail+1)); printf '  FAIL esperado "%s" en: %s\n' "$2" "$new"; fi
}
sess "abc-123" "lf-out-abc-123.log"
sess '../x/y' "lf-out-xy.log"
sess "-" "lf-last-output.log"

echo; echo "guard-read.sh:"
GUARD="$ROOT/plugins/lf/hooks/guard-read.sh"
gtmp=$(mktemp -d)
seq 1 1000 > "$gtmp/big.txt"; seq 1 10 > "$gtmp/small.txt"
head -c 400000 /dev/zero | tr '\0' 'x' > "$gtmp/oneline.json"; echo >> "$gtmp/oneline.json"
gcheck() { # gcheck <deny|pass> <descripción> <json tool_input> [VAR=valor …]
  local expect="$1" label="$2" ti="$3"; shift 3
  local out got="pass"
  out=$(jq -cn --argjson t "$ti" --arg cwd "${GCWD:-/app}" '{session_id:"t",cwd:$cwd,tool_name:"Read",tool_input:$t}' | env "$@" bash "$GUARD" 2>/dev/null)
  [ -n "$out" ] && got="deny"
  if [ "$got" = "deny" ] && [ "$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision')" != "deny" ]; then got="salida-inválida"; fi
  if [ "$got" = "$expect" ]; then ok=$((ok+1)); printf '  ok   %-4s %s\n' "$expect" "$label"
  else fail=$((fail+1)); printf '  FAIL %-4s (got %s) %s\n     -> %s\n' "$expect" "$got" "$label" "$out"; fi
}
gcheck deny "vendor/a.php" '{"file_path":"vendor/a.php"}' X=1
gcheck deny "/app/vendor/symfony/x.php" '{"file_path":"/app/vendor/symfony/x.php"}' X=1
gcheck deny "node_modules/x/index.js" '{"file_path":"node_modules/x/index.js"}' X=1
gcheck deny ".git/config" '{"file_path":"/app/.git/config"}' X=1
gcheck deny "var/cache/prod/a.php" '{"file_path":"/app/var/cache/prod/a.php"}' X=1
gcheck deny "public/build/app.js" '{"file_path":"/app/public/build/app.js"}' X=1
gcheck deny "app.min.js" '{"file_path":"/app/public/app.min.js"}' X=1
gcheck deny "app.js.map" '{"file_path":"/app/public/app.js.map"}' X=1
gcheck deny "composer.lock" '{"file_path":"/app/composer.lock"}' X=1
gcheck deny "package-lock.json" '{"file_path":"package-lock.json"}' X=1
gcheck pass "src/A.php" '{"file_path":"src/A.php"}' X=1
gcheck pass "src/vendorish/A.php" '{"file_path":"src/vendorish/A.php"}' X=1
gcheck deny "fichero grande sin limit" "$(jq -cn --arg f "$gtmp/big.txt" '{file_path:$f}')" X=1
gcheck pass "fichero grande con limit" "$(jq -cn --arg f "$gtmp/big.txt" '{file_path:$f,limit:100}')" X=1
gcheck pass "fichero grande con offset" "$(jq -cn --arg f "$gtmp/big.txt" '{file_path:$f,offset:10}')" X=1
gcheck pass "fichero pequeño" "$(jq -cn --arg f "$gtmp/small.txt" '{file_path:$f}')" X=1
gcheck pass "fichero grande con LF_READ_MAX_LINES=2000" "$(jq -cn --arg f "$gtmp/big.txt" '{file_path:$f}')" LF_READ_MAX_LINES=2000
gcheck pass "LF_READ_GUARD=0 sobre vendor/" '{"file_path":"vendor/a.php"}' LF_READ_GUARD=0
gcheck pass "LF_READ_GUARD=0 sobre fichero grande" "$(jq -cn --arg f "$gtmp/big.txt" '{file_path:$f}')" LF_READ_GUARD=0
gcheck pass "src/dist/a.ts (dist no en la raíz)" '{"file_path":"src/dist/a.ts"}' X=1
gcheck deny "dist/a.js relativo" '{"file_path":"dist/a.js"}' X=1
gcheck deny "dist/a.js absoluto dentro del cwd" '{"file_path":"/app/dist/a.js"}' X=1
gcheck deny "packages/x/vendor/a.php (cualquier segmento)" '{"file_path":"packages/x/vendor/a.php"}' X=1
gcheck pass "/home/u/vendor/proj/a.php fuera del cwd" '{"file_path":"/home/u/vendor/proj/a.php"}' X=1
gcheck deny "composer.lock fuera del cwd (regla de nombre)" '{"file_path":"/home/u/proj/composer.lock"}' X=1
gcheck deny "fichero de una línea > 300 KB sin limit" "$(jq -cn --arg f "$gtmp/oneline.json" '{file_path:$f}')" X=1
gcheck pass "fichero de una línea > 300 KB con limit" "$(jq -cn --arg f "$gtmp/oneline.json" '{file_path:$f,limit:1}')" X=1
gcheck pass "fichero de una línea con LF_READ_MAX_BYTES=900000" "$(jq -cn --arg f "$gtmp/oneline.json" '{file_path:$f}')" LF_READ_MAX_BYTES=900000
GCWD="$gtmp" gcheck deny "ruta relativa resuelta contra el cwd (grande)" '{"file_path":"big.txt"}' X=1
GCWD="$gtmp" gcheck pass "ruta relativa resuelta contra el cwd (pequeño)" '{"file_path":"small.txt"}' X=1
gcheck pass "ruta inexistente" '{"file_path":"/no/existe/x.txt"}' X=1
rm -rf "$gtmp"

echo; echo "check-drift.sh (sobre settings actual):"
bash "$ROOT/plugins/lf/hooks/check-drift.sh" | sed 's/^/  /' ; echo "  (vacío = sin deriva)"

echo; echo "check-drift.sh (marca de versión):"
DRIFT="$ROOT/plugins/lf/hooks/check-drift.sh"
ver=$(jq -r .version "$ROOT/plugins/lf/.claude-plugin/plugin.json")
drift() { # drift <contenido línea 1 de CLAUDE.md|-> <fragmento esperado|"">
  local d out; d=$(mktemp -d)
  [ "$1" != "-" ] && printf '%s\n# x\n' "$1" > "$d/CLAUDE.md"
  out=$(CLAUDE_CONFIG_DIR="$d" bash "$DRIFT" 2>&1); rm -rf "$d"
  if { [ -z "$2" ] && [ -z "$out" ]; } || { [ -n "$2" ] && [[ "$out" == *"$2"* ]] && [ "$(printf '%s\n' "$out" | wc -l)" -eq 1 ]; }; then
    ok=$((ok+1)); printf '  ok   %s\n' "${2:-silencio}"
  else fail=$((fail+1)); printf '  FAIL esperado "%s", salida "%s"\n' "$2" "$out"; fi
}
drift "-" "sin configurar"
drift "# Arnés sin marca" "sin configurar"
drift "<!-- lf-harness 0.0.1 -->" "actualizado a $ver"
drift "<!-- lf-harness $ver -->" ""

echo; echo "log-permission.sh:"
tmp=$(mktemp -d); CLAUDE_CONFIG_DIR="$tmp" bash "$ROOT/plugins/lf/hooks/log-permission.sh" <<<'{"session_id":"t","cwd":"/x","tool_name":"Bash","tool_input":{"command":"git push"}}'
[ -s "$tmp/lf-metrics/permissions.tsv" ] && { ok=$((ok+1)); echo "  ok   escribe TSV"; } || { fail=$((fail+1)); echo "  FAIL no escribe TSV"; }
rm -rf "$tmp"

echo; echo "filter-output.sh (exit code de build):"
for want in 1 0; do
  c=false; [ "$want" -eq 0 ] && c=true
  w=$(jq -cn '{tool_input:{command:"npm run build"}}' | bash "$HOOK" | jq -r .hookSpecificOutput.updatedInput.command)
  bash -c "${w/npm run build/$c}" >/dev/null 2>&1; got=$?
  if [ "$got" -eq "$want" ]; then ok=$((ok+1)); echo "  ok   build $c -> $got"; else fail=$((fail+1)); echo "  FAIL build $c -> $got (esperado $want)"; fi
done

echo; echo "Resultado: $ok ok, $fail fallos"
[ "$fail" -eq 0 ]
