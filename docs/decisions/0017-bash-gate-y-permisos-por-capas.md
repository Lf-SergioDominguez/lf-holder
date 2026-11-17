# 0017 — `bash-gate` y permisos por capas

Fecha: 2026-11-17

Contexto: el log real de permisos (514 prompts) mostraba que la fricción venía del sandbox, no de las listas: en WSL2 el `localhost` del sandbox es privado, así que MySQL local, `bin/console` con BD, `curl localhost`, `gh` y git por SSH fallaban dentro y acababan en prompt. Además un hook `allow` no anula un `ask` estático, los dry-run preguntaban, y el bloqueo de borrado tenía huecos (`rm -fr`, `find -delete`, SQL en minúsculas, `docker compose exec … DROP`).

Decisión:
1. Hook PreToolUse `bash-gate` (`hooks/gate/classify.mjs`, función pura; `cli.mjs`; lanzador `bash-gate.sh`) que clasifica el comando completo y decide `allow|ask|deny`; composición `deny > ask > none > allow`. Quita el `cd <cwd> &&` redundante vía `updatedInput`. `timeout: 5`, `onFailure: "block"`, error interno → `ask`. `LF_GATE=on|shadow|off`.
2. Reglas estáticas mínimas: `allow` solo lectura trivial y las familias excluidas del sandbox (el hook `allow` no aprueba `dangerouslyDisableSandbox`); `ask` para commit, `rm`, `compose up/down/run`; `deny` solo lo catastrófico.
3. `sandbox.excludedCommands` solo para binarios que no ejecutan código del repo (`docker`, `mysql`, `mariadb`, `gh`, git de red, `curl` a localhost). `php bin/console`, `wp` y `phpunit` en host no se excluyen globalmente; quien no usa Docker los activa por proyecto (`project-templates/settings.local.json`).
4. Lecturas peligrosas pasan de `deny Read(...)` (que el sandbox convierte en `denyRead` y rompe la app) a `guard-read.sh`. Quedan en `deny` solo las credenciales.
5. `merge-settings.sh` con manifiesto `~/.claude/lf/managed.json` y `--prune`, para que las bajas lleguen a quien ya instaló.
6. Salida: `trim-output.mjs` (PostToolUse, `updatedToolOutput`) sustituye a `filter-output.sh`; siempre avisa de lo omitido y deja la salida completa en `$TMPDIR`.
7. Reglas de usuario: `DELETE/DROP/TRUNCATE` → `deny` (lo lanza el usuario con `! …`); escrituras SQL → `ask`; `rm` de ficheros del repo o `$TMPDIR` → `ask`; recursivo sobre raíz/home/fuera del repo → `deny`.

Límites aceptados: el gate es barandilla, no frontera de seguridad; `grep -rn X .` puede leer `.env.local`; `trim-output` no recorta salidas de comandos que fallan (PostToolUse solo dispara en éxito).
Alternativa descartada: allowlists amplias por binario (`bin/console *`, `wp *`, `npx *`…): ejecutan código arbitrario en el host sin sandbox. Se conservan solo en el perfil `--no-sandbox`.
Detalle operativo: `plugins/lf/docs/PERMISOS.md`.
