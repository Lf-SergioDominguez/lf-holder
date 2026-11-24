#!/usr/bin/env bash
# test-hooks.sh — pruebas de los hooks del plugin lf (sin ejecutar nada real).
# trim-output: salida simulada de un comando → se espera "trim" (updatedToolOutput) o "same" (sin salida).
# guard-read: ruta de entrada → se espera "deny" o "pass".
# bash-gate: modos on/shadow/off y ausencia de node; además lanza `node --test tests/` (clasificador).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok=0

echo "trim-output.mjs:"
TRIM="$ROOT/plugins/lf/hooks/trim-output.mjs"
ttmp=$(mktemp -d)
trim() { # trim <trim|same> <comando> <líneas> <fragmento esperado en la salida|-> [VAR=valor …]
  local expect="$1" cmd="$2" n="$3" frag="$4"; shift 4
  local stdout out got="same"
  stdout=$(seq 1 "$n" | sed 's/^/linea /'; echo "FAILURES!"; echo "Tests: 3, Failures: 1")
  out=$(jq -cn --arg c "$cmd" --arg o "$stdout" '{session_id:"tt",tool_name:"Bash",tool_input:{command:$c},tool_response:{stdout:$o,stderr:"",interrupted:false,isImage:false}}' \
        | env TMPDIR="$ttmp" "$@" node "$TRIM" 2>/dev/null)
  [ -n "$out" ] && got="trim"
  if [ "$got" = "trim" ] && ! printf '%s' "$out" | jq -e '.hookSpecificOutput.updatedToolOutput.stdout' >/dev/null 2>&1; then got="salida-inválida"; fi
  if [ "$got" = "$expect" ] && { [ "$frag" = "-" ] || [ "$got" != "trim" ] || printf '%s' "$out" | jq -r '.hookSpecificOutput.updatedToolOutput.stdout' | grep -qF -- "$frag"; }; then
    ok=$((ok+1)); printf '  ok   %-4s %s\n' "$expect" "$cmd"
  else fail=$((fail+1)); printf '  FAIL %-4s (got %s) %s\n' "$expect" "$got" "$cmd"; fi
}
trim trim "vendor/bin/phpunit tests/Unit" 200 "FAILURES!"
trim trim "docker compose exec php vendor/bin/phpunit --filter UserTest" 200 "Tests: 3"
trim trim "cd app && vendor/bin/phpstan analyse src" 200 "[lf:"
trim trim "npx vitest run" 200 "Tests: 3"
trim trim "npm run build" 200 "[lf:"
trim trim "npx vue-tsc --noEmit" 200 "[lf:"
trim trim "npm ci" 200 "[lf:"
trim trim "mysql -u root app -e 'SELECT * FROM t'" 300 "[lf: 102 líneas omitidas"
trim trim "wp post list" 300 "[lf:"
trim same "vendor/bin/phpunit tests/Unit" 10 -
trim same "mysql -u root app -e 'SELECT 1'" 100 -
trim same "ls -la" 300 -
trim same "git log" 300 -
trim same "vendor/bin/phpunit tests/Unit" 200 - LF_TRIM=0
# la nota nombra un log que existe y contiene la salida completa
tout=$(jq -cn --arg o "$(seq 1 200)" '{session_id:"tt",tool_input:{command:"npm ci"},tool_response:{stdout:$o,stderr:"e",interrupted:false,isImage:false}}' | TMPDIR="$ttmp" node "$TRIM")
tlog=$(printf '%s' "$tout" | jq -r '.hookSpecificOutput.updatedToolOutput.stdout' | grep -oE 'salida completa en [^]]+' | sed 's/salida completa en //')
if [ -n "$tlog" ] && [ "$(wc -l < "$tlog")" -ge 199 ] && [ "$(printf '%s' "$tout" | jq -r '.hookSpecificOutput.updatedToolOutput.stderr')" = "e" ]; then
  ok=$((ok+1)); echo "  ok   log completo en \$TMPDIR y stderr conservado"
else fail=$((fail+1)); echo "  FAIL log completo / stderr ($tlog)"; fi
rm -rf "$ttmp"

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
gcheck deny "var/log/dev.log" '{"file_path":"/app/var/log/dev.log"}' X=1
gcheck deny "storage/logs/laravel.log" '{"file_path":"storage/logs/laravel.log"}' X=1
gcheck deny "debug.log en cualquier carpeta" '{"file_path":"/app/tmp/debug.log"}' X=1
gcheck deny "volcado dump.sql.gz" '{"file_path":"/app/dump.sql.gz"}' X=1
gcheck deny ".env.local" '{"file_path":"/app/.env.local"}' X=1
gcheck deny ".env.prod.local en subcarpeta" '{"file_path":"/app/api/.env.prod.local"}' X=1
gcheck deny ".cache/x" '{"file_path":".cache/x.json"}' X=1
gcheck pass ".env (sin local)" '{"file_path":"/app/.env"}' X=1
gcheck pass "log fuera del cwd (p. ej. \$TMPDIR/lf-out-x.log)" '{"file_path":"/tmp/lf-out-x.log","limit":50}' X=1
gcheck pass "ruta inexistente" '{"file_path":"/no/existe/x.txt"}' X=1
rm -rf "$gtmp"

echo; echo "session-start.sh (sobre settings actual):"
bash "$ROOT/plugins/lf/hooks/session-start.sh" | sed 's/^/  /' ; echo "  (vacío = sin deriva)"

echo; echo "session-start.sh (marca de versión):"
DRIFT="$ROOT/plugins/lf/hooks/session-start.sh"
ver=$(jq -r .version "$ROOT/plugins/lf/.claude-plugin/plugin.json")
drift() { # drift <contenido línea 1 de CLAUDE.md|-> <fragmento esperado|"">
  local d out; d=$(mktemp -d)
  [ "$1" != "-" ] && printf '%s\n# x\n' "$1" > "$d/CLAUDE.md"
  out=$(cd "$d" && CLAUDE_CONFIG_DIR="$d" bash "$DRIFT" 2>&1); rm -rf "$d"
  if { [ -z "$2" ] && [ -z "$out" ]; } || { [ -n "$2" ] && [[ "$out" == *"$2"* ]] && [ "$(printf '%s\n' "$out" | wc -l)" -eq 1 ]; }; then
    ok=$((ok+1)); printf '  ok   %s\n' "${2:-silencio}"
  else fail=$((fail+1)); printf '  FAIL esperado "%s", salida "%s"\n' "$2" "$out"; fi
}
drift "-" "sin configurar"
drift "# Arnés sin marca" "sin configurar"
drift "<!-- lf-harness 0.0.1 -->" "actualizado a $ver"
drift "<!-- lf-harness $ver -->" ""

echo; echo "session-start.sh (reglas antiguas):"
sd=$(mktemp -d)
old() { # old <settings.json> <fragmento esperado|"">
  local out; echo "$1" > "$sd/settings.json"; printf '<!-- lf-harness %s -->\n' "$ver" > "$sd/CLAUDE.md"
  out=$(cd "$sd" && CLAUDE_CONFIG_DIR="$sd" PATH="$(dirname "$(command -v jq)"):/usr/bin:/bin" bash "$DRIFT" 2>&1)
  if { [ -z "$2" ] && [ -z "$out" ]; } || { [ -n "$2" ] && [[ "$out" == *"$2"* ]]; }; then ok=$((ok+1)); printf '  ok   %s\n' "${2:-silencio}"
  else fail=$((fail+1)); printf '  FAIL esperado "%s", salida "%s"\n' "$2" "$out"; fi
}
old '{"permissions":{"allow":["Bash(git status*)"]}}' ""
old '{"permissions":{"allow":["Bash(wp *)","Bash(rtk *)"]}}' "2 regla(s) antigua(s)"
old '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"rtk hook claude"}]}]}}' "1 regla(s) antigua(s)"
rm -rf "$sd"

echo; echo "session-start.sh (handoff y sesiones sin consolidar) y precompact.sh:"
mtmp=$(mktemp -d); mp="$mtmp/proj"; mkdir -p "$mp"; mcfg="$mtmp/cfg"; mkdir -p "$mcfg"
printf '<!-- lf-harness %s -->\n' "$ver" > "$mcfg/CLAUDE.md"
mpdir="$mcfg/projects/$(cd "$mp" && pwd | sed 's/[^a-zA-Z0-9]/-/g')"; mkdir -p "$mpdir/memory"
mstart() { (cd "$mp" && CLAUDE_CONFIG_DIR="$mcfg" bash "$DRIFT" 2>&1); }
mcheck() { # mcheck <fragmento esperado|""> <descripción>
  local out; out=$(mstart)
  if { [ -z "$1" ] && [ -z "$out" ]; } || { [ -n "$1" ] && [[ "$out" == *"$1"* ]]; }; then ok=$((ok+1)); echo "  ok   $2"
  else fail=$((fail+1)); echo "  FAIL $2 (salida: $out)"; fi
}
mcheck "" "sin handoff ni sesiones: silencio"
echo x > "$mp/handoff.md"; mcheck "existe handoff.md" "avisa del handoff"; rm "$mp/handoff.md"
for i in 1 2 3 4; do echo '{}' > "$mpdir/s$i.jsonl"; done
mcheck "" "4 sesiones sin estado: silencio"
echo '{}' > "$mpdir/s5.jsonl"; mcheck "5 sesión(es) sin consolidar" "5 sesiones sin estado: avisa"
touch -d '2000-01-01' "$mpdir"/s*.jsonl
echo '{"lastRun":"2000-01-02T00:00:00Z"}' > "$mpdir/memory/.dream-state.json"; touch -d '2000-01-02' "$mpdir/memory/.dream-state.json"
touch -d '2000-01-03' "$mpdir/s1.jsonl"
mcheck "1 sesión(es) sin consolidar" "1 sesión y >7 días desde la última: avisa"
echo '{"lastRun":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$mpdir/memory/.dream-state.json"
mcheck "" "recién consolidado: silencio"
pc=$(bash "$ROOT/plugins/lf/hooks/precompact.sh")
if [[ "$pc" == *"alternativas descartadas"* ]] && [[ "$pc" == *"Próximo paso"* ]]; then ok=$((ok+1)); echo "  ok   precompact imprime las instrucciones"
else fail=$((fail+1)); echo "  FAIL precompact"; fi
# install.sh: el @import de USER.md apunta al fichero que crea, con ruta por defecto y con CLAUDE_CONFIG_DIR propio
icheck() { # icheck <descripción> <CLAUDE_CONFIG_DIR> <línea @import esperada>
  local c="$2"; mkdir -p "$c"; HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$c" bash "$ROOT/plugins/lf/scripts/install.sh" --only=claude-md >/dev/null 2>&1
  if [ "$(tail -n 1 "$c/CLAUDE.md")" = "$3" ] && [ -f "$c/lf/memory/USER.md" ]; then ok=$((ok+1)); echo "  ok   $1"
  else fail=$((fail+1)); echo "  FAIL $1 (última línea: $(tail -n 1 "$c/CLAUDE.md" 2>/dev/null))"; fi
}
mkdir -p "$mtmp/home"
icheck "install: @import con ruta por defecto (~/.claude)" "$mtmp/home/.claude" "@~/.claude/lf/memory/USER.md"
icheck "install: @import respeta CLAUDE_CONFIG_DIR" "$mtmp/otra" "@$mtmp/otra/lf/memory/USER.md"
hcheck() { if [ "$1" = "$2" ]; then ok=$((ok+1)); echo "  ok   $3"; else fail=$((fail+1)); echo "  FAIL $3 (got '$1', esperado '$2')"; fi; }
HS="$ROOT/plugins/lf/scripts/house-style.sh"; hc="$mtmp/hs"
mkdir -p "$mtmp/hsrc"; printf '# Mi estilo\n[c](color.md)\n' > "$mtmp/hsrc/README.md"; echo "azul" > "$mtmp/hsrc/color.md"
if [ -d "$ROOT/plugins/lf/house-style" ]; then
  HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$hc" bash "$ROOT/plugins/lf/scripts/install.sh" --only=claude-md >/dev/null 2>&1
  hcheck "$(grep -c 001978 "$hc/lf/house-style/color.md")" "$(grep -c 001978 "$ROOT/plugins/lf/house-style/color.md")" "install: copia el house style de serie"
fi
CLAUDE_CONFIG_DIR="$hc" bash "$HS" "$mtmp/hsrc" >/dev/null
hcheck "$(cat "$hc/lf/house-style/color.md")|$([ -f "$hc/lf/house-style/.custom" ] && echo custom)|$(grep -c README "$hc/lf/house-style/INDEX.md")" "azul|custom|1" "house-style.sh <carpeta>: copia, marca .custom y crea INDEX.md"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$hc" bash "$ROOT/plugins/lf/scripts/install.sh" --only=claude-md >/dev/null 2>&1
hcheck "$(cat "$hc/lf/house-style/color.md")" "azul" "install: no pisa un house style .custom"
CLAUDE_CONFIG_DIR="$hc" bash "$HS" /no/existe >/dev/null 2>&1; hcheck "$?" "1" "house-style.sh: ruta inexistente falla"
if [ -d "$ROOT/plugins/lf/house-style" ]; then
  CLAUDE_CONFIG_DIR="$hc" bash "$HS" --reset >/dev/null
  hcheck "$([ -f "$hc/lf/house-style/.custom" ] && echo custom || echo serie)|$(ls "$hc/lf/house-style" | wc -l)" "serie|$(ls "$ROOT/plugins/lf/house-style" | wc -l)" "house-style.sh --reset: vuelve al de serie"
fi
# install.sh paso config: perfil y elecciones en config.json; una segunda ejecución conserva lo no indicado
LF_INSTALL="$ROOT/plugins/lf/scripts/install.sh"; cc="$mtmp/cfg"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config --profile=web --telemetry=on >/dev/null 2>&1
hcheck "$(jq -c '[.profile, .telemetry]' "$cc/lf/config.json")|$(ls "$cc/lf/profiles" | paste -sd,)" '["web",true]|generic.md,web.md' "install config: guarda perfil y telemetría y copia los perfiles"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config --telemetry-every=month-ends >/dev/null 2>&1
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config >/dev/null 2>&1
hcheck "$(jq -c '[.profile, .telemetry, .telemetryEvery]' "$cc/lf/config.json")" '["web",true,"month-ends"]' "install config: sin flags conserva lo guardado y la frecuencia"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$mtmp/vacio" bash "$LF_INSTALL" --only=config >/dev/null 2>&1
hcheck "$(jq -c '[.profile, .telemetry, .telemetryEvery]' "$mtmp/vacio/lf/config.json")" '["generic",false,"weekly"]' "install config: por defecto generic, telemetría off y weekly"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config --profile=nope >/dev/null 2>&1; hcheck "$?" "1" "install config: perfil desconocido falla"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config --telemetry=si >/dev/null 2>&1; hcheck "$?" "1" "install config: --telemetry inválido falla"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config --telemetry-every=daily >/dev/null 2>&1; hcheck "$?" "1" "install config: --telemetry-every inválido falla"
jq '.optional.gsd = true' "$cc/lf/config.json" > "$mtmp/c.json" && cp "$mtmp/c.json" "$cc/lf/config.json"
HOME="$mtmp/home" CLAUDE_CONFIG_DIR="$cc" bash "$LF_INSTALL" --only=config,gsd >/dev/null 2>&1
hcheck "$(jq -c '.optional | keys' "$cc/lf/config.json")" '["taste"]' "install config: elimina optional.gsd previo"
rm -rf "$mtmp"

echo; echo "log-permission.sh:"
tmp=$(mktemp -d); CLAUDE_CONFIG_DIR="$tmp" bash "$ROOT/plugins/lf/hooks/log-permission.sh" <<<'{"session_id":"t","cwd":"/x","tool_name":"Bash","tool_input":{"command":"git push"}}'
[ -s "$tmp/lf-metrics/permissions.tsv" ] && { ok=$((ok+1)); echo "  ok   escribe TSV"; } || { fail=$((fail+1)); echo "  FAIL no escribe TSV"; }
CLAUDE_CONFIG_DIR="$tmp" bash "$ROOT/plugins/lf/hooks/log-permission.sh" <<<'{"session_id":"t","cwd":"/x","tool_name":"Bash","permission_mode":"plan","tool_input":{"command":"ls","dangerouslyDisableSandbox":true}}'
CLAUDE_CONFIG_DIR="$tmp" bash "$ROOT/plugins/lf/hooks/log-permission.sh" <<<'{"session_id":"t","tool_name":"AskUserQuestion","tool_input":{}}'
CLAUDE_CONFIG_DIR="$tmp" bash "$ROOT/plugins/lf/hooks/log-permission.sh" <<<'{"session_id":"t","tool_name":"ExitPlanMode","tool_input":{}}'
lp=$(awk -F'\t' 'NR==1{a=NF} NR==2{b=$6":"$7} END{print NR":"a":"b}' "$tmp/lf-metrics/permissions.tsv")
if [ "$lp" = "2:7:plan:1" ]; then ok=$((ok+1)); echo "  ok   7 columnas (modo, sandbox) y sin AskUserQuestion/ExitPlanMode"; else fail=$((fail+1)); echo "  FAIL columnas/filtro ($lp)"; fi
rm -rf "$tmp"

echo; echo "session-start.sh (autoCompactWindow):"
DRIFT="$ROOT/plugins/lf/hooks/session-start.sh"
ltmp=$(mktemp -d); p="$ltmp/con espacio"; mkdir -p "$p/.claude"
lcheck() { if [ "$1" = "$2" ]; then ok=$((ok+1)); echo "  ok   $3"; else fail=$((fail+1)); echo "  FAIL $3 (got $1)"; fi; }
acwc() { echo "{\"autoCompactWindow\":$1}" > "$p/.claude/settings.json"; (cd "$p" && CLAUDE_CONFIG_DIR="$ltmp/none" bash "$DRIFT" | grep -c "autoCompactWindow efectivo"); }
lcheck "$(acwc 220000)" 1 "session-start avisa con autoCompactWindow 220000 en el proyecto"
lcheck "$(acwc 253000)" 0 "session-start calla con autoCompactWindow 253000"
rm -rf "$ltmp"

echo; echo "bash-gate.sh (on por defecto, shadow, off):"
GATE="$ROOT/plugins/lf/hooks/bash-gate.sh"
gdir=$(mktemp -d)
gin() { jq -cn --arg c "$1" '{session_id:"gt",cwd:"/work/proj",tool_name:"Bash",tool_input:{command:$c}}'; }
gcheck() { if [ "$1" = "$2" ]; then ok=$((ok+1)); echo "  ok   $3"; else fail=$((fail+1)); echo "  FAIL $3 (got '$1', esperado '$2')"; fi; }
if command -v node >/dev/null 2>&1; then
  gout=$(gin "git status" | LF_GATE=shadow CLAUDE_CONFIG_DIR="$gdir" bash "$GATE"); grc=$?
  gcheck "$grc:$gout" "0:" "shadow: exit 0 y sin salida"
  gcheck "$(awk -F'\t' 'END{print NR":"$2":"$3":"$5}' "$gdir/lf-metrics/gate.tsv" 2>/dev/null)" "1:gt:allow:git status" "shadow: una fila ts/sesión/decisión/comando"
  gin "rm -rf /" | LF_GATE=shadow CLAUDE_CONFIG_DIR="$gdir" bash "$GATE" >/dev/null
  gcheck "$(awk -F'\t' 'END{print NR":"$3}' "$gdir/lf-metrics/gate.tsv" 2>/dev/null)" "2:deny" "shadow: segunda fila con deny"
  gin "git status" | LF_GATE=off CLAUDE_CONFIG_DIR="$gdir" bash "$GATE"
  gcheck "$(wc -l < "$gdir/lf-metrics/gate.tsv" | tr -d ' ')" "2" "off: no registra"
  for pair in "allow|git status" "ask|git commit -m x" "deny|rm -rf /"; do
    want="${pair%%|*}"; c="${pair#*|}"
    got=$(gin "$c" | LF_GATE=on CLAUDE_CONFIG_DIR="$gdir" bash "$GATE" | jq -r '.hookSpecificOutput | select(.hookEventName == "PreToolUse") | .permissionDecision')
    gcheck "$got" "$want" "on: $want  $c"
  done
  gcheck "$(gin "rm -rf /" | CLAUDE_CONFIG_DIR="$gdir" bash "$GATE" | jq -r .hookSpecificOutput.permissionDecision)" "deny" "sin LF_GATE el gate decide (on por defecto)"
  gcheck "$(gin "cd /work/proj && docker compose ps" | CLAUDE_CONFIG_DIR="$gdir" bash "$GATE" | jq -r '.hookSpecificOutput.updatedInput.command')" "docker compose ps" "allow quita el cd <cwd> && redundante (updatedInput)"
  gcheck "$(gin "cd /otro && docker compose ps" | CLAUDE_CONFIG_DIR="$gdir" bash "$GATE" | jq -r '.hookSpecificOutput.updatedInput.command // "-"')" "-" "allow no reescribe un cd a otro directorio"
  gcheck "$(gin "foo-desconocido --x" | LF_GATE=on CLAUDE_CONFIG_DIR="$gdir" bash "$GATE")" "" "on: none no emite nada"
  gcheck "$(printf 'no json' | LF_GATE=on CLAUDE_CONFIG_DIR="$gdir" bash "$GATE" | jq -r .hookSpecificOutput.permissionDecision)" "ask" "on: entrada ilegible → ask"
  # sin node (PATH sin node): shadow/off callan; on solo pregunta por patrones peligrosos
  nonode="$gdir/bin"; mkdir -p "$nonode"; for t in jq grep head tr dirname cat; do ln -sf "$(command -v $t)" "$nonode/$t"; done
  gcheck "$(gin "git push" | LF_GATE=shadow PATH="$nonode" CLAUDE_CONFIG_DIR="$gdir/none" /bin/bash "$GATE")" "" "sin node, shadow: silencio"
  gcheck "$(gin "git push" | LF_GATE=on PATH="$nonode" CLAUDE_CONFIG_DIR="$gdir/none" /bin/bash "$GATE" | jq -r .hookSpecificOutput.permissionDecision)" "ask" "sin node, on: push → ask"
  gcheck "$(gin "ls -la" | LF_GATE=on PATH="$nonode" CLAUDE_CONFIG_DIR="$gdir/none" /bin/bash "$GATE")" "" "sin node, on: ls pasa"
  echo; echo "node --test tests/:"
  nt=$(cd "$ROOT" && node --test tests/*.test.mjs 2>&1); nrc=$?
  if [ "$nrc" -eq 0 ]; then ok=$((ok+1)); echo "  ok   $(printf '%s\n' "$nt" | grep -E '^ℹ (pass|fail) ' | tr '\n' ' ')"
  else fail=$((fail+1)); echo "  FAIL node --test"; printf '%s\n' "$nt" | head -40; fi
else
  echo "  (node no disponible: se omiten las pruebas de bash-gate)"
fi
rm -rf "$gdir"

echo; echo "statusline.sh:"
SL="$ROOT/plugins/lf/scripts/statusline.sh"
# Denominador = mín(200K, autoCompactWindow − 33K): usuario 253000 → 200K; un proyecto con 200000 lo pisa → 167K.
sc=$(mktemp -d); mkdir -p "$sc/home" "$sc/proj/.claude"
echo '{"autoCompactWindow":253000}' > "$sc/home/settings.json"
echo '{"autoCompactWindow":200000}' > "$sc/proj/.claude/settings.json"
sline() { # sline <fragmento esperado> <tokens de contexto> [código de color] [project_dir]
  local out; out=$(printf '{"context_window":{"current_usage":{"input_tokens":1,"cache_read_input_tokens":%s}},"workspace":{"project_dir":"%s"}}' "$2" "${4:-$sc/none}" \
    | CLAUDE_CONFIG_DIR="$sc/home" bash "$SL" 2>/dev/null)
  if printf '%s' "$out" | grep -qF -- "$1" && { [ -z "${3:-}" ] || printf '%s' "$out" | grep -qF -- $'\033['"$3"'m'; }; then
    ok=$((ok+1)); printf '  ok   %s tokens → %s\n' "$2" "$1"
  else fail=$((fail+1)); printf '  FAIL %s tokens (esperaba %s): %s\n' "$2" "$1" "$out"; fi
}
sline "ctx 100k/200k 50%" 99999 2
sline "ctx 148k/200k 74%" 148000 2
sline "ctx 150k/200k 75%" 150000 33
sline "ctx 158k/200k 79%" 158000 33
sline "→ /lf:handoff" 160000 31
sline "ctx 134k/167k" 134000 31 "$sc/proj"
echo '{}' | CLAUDE_CONFIG_DIR="$sc/none" bash "$SL" | grep -qF "ctx 0k/167k 0%" && { ok=$((ok+1)); echo "  ok   sin current_usage ni settings → 0% de 167K"; } || { fail=$((fail+1)); echo "  FAIL sin current_usage"; }
echo '{}' | LF_CTX_LIMIT=100000 bash "$SL" | grep -qF "ctx 0k/100k" && { ok=$((ok+1)); echo "  ok   LF_CTX_LIMIT fuerza el umbral"; } || { fail=$((fail+1)); echo "  FAIL LF_CTX_LIMIT"; }
echo '{}' | LF_CTX_LIMIT=0 bash "$SL" 2>/dev/null | grep -qF "ctx 0k/200k" && { ok=$((ok+1)); echo "  ok   LF_CTX_LIMIT=0 cae a 200K"; } || { fail=$((fail+1)); echo "  FAIL LF_CTX_LIMIT=0"; }
rm -rf "$sc"
sm=$(mktemp -d); echo '{"statusLine":{"type":"command","command":"mi-linea.sh"}}' > "$sm/s.json"
bash "$ROOT/plugins/lf/scripts/merge-settings.sh" "$ROOT/plugins/lf/home/settings.lf.json" --target "$sm/s.json" --prune >/dev/null 2>&1
[ "$(jq -r .statusLine.command "$sm/s.json")" = "mi-linea.sh" ] && { ok=$((ok+1)); echo "  ok   merge respeta una statusLine ajena"; } || { fail=$((fail+1)); echo "  FAIL merge pisó la statusLine ajena"; }
rm -rf "$sm"

echo; echo "Resultado: $ok ok, $fail fallos"
[ "$fail" -eq 0 ]
