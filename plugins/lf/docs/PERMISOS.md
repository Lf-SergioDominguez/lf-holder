# Permisos: qué pasa, qué pregunta y qué se bloquea

Tres capas, de más barata a más cara:

1. **Sandbox** (bubblewrap): lo que corre dentro no pregunta (`autoAllowBashIfSandboxed`) pero no ve el host.
2. **Reglas estáticas** (`settings.json`): orden fijo `deny → ask → allow`. Solo lo trivial e inequívoco.
3. **`bash-gate`** (hook PreToolUse de `lf`): clasifica el comando completo, incluido el interior de `docker compose exec …`, y decide `allow`, `ask` o `deny`. Lo que no reconoce (`none`) lo resuelve el sandbox.

El gate es una **barandilla, no una frontera de seguridad**: evita accidentes del agente, no a un atacante.

## Por qué no basta con las listas

- Un hook `allow` **no** anula un `ask` ni un `deny` estático; por eso las variantes `--dry-run` no están en `ask` y las decide el gate.
- En WSL2 el `localhost` del sandbox es privado: MySQL local, `curl localhost`, `gh` y git por SSH fallan dentro. Por eso `docker`, `mysql`, `mariadb`, `mysqladmin`, `gh`, `git push/fetch/pull/clone/ls-remote` y `curl` a localhost están en `sandbox.excludedCommands`.
- La exclusión solo aplica si **todo** el comando casa: `cd`, pipes, redirecciones (salvo `2>&1`), `$(…)` y subshells dejan la llamada dentro del sandbox, donde falla. Por eso el gate quita un `cd <cwd> &&` redundante y `CLAUDE.md` pide un comando por llamada.

## Qué hace el gate

Normaliza el comando (comillas, `&&`, `||`, `;`, `|`, `VAR=…`, `env`, `timeout`, `docker compose exec`, `symfony console`, `sh -c '…'`), clasifica cada segmento y combina: `deny > ask > none > allow`. Rutas absolutas, `eval`, `xargs` y variables como `PATH`, `LD_PRELOAD` o `BASH_ENV` nunca dan `allow`. Cualquier error interno → `ask`; sin `node`, solo pregunta por una regex gruesa de peligro. El hook va con `timeout: 5` y `onFailure: "block"`.

| Familia | Pasa (`allow`) | Pregunta (`ask`) | Se bloquea (`deny`) |
| --- | --- | --- | --- |
| git | `status diff log show blame add fetch ls-remote`, `push/commit --dry-run` | `commit push pull merge cherry-pick revert clone`, `tag`, `branch -d` | `--amend`, `reset --hard`, `clean`, `checkout -- <p>`, `branch -D`, `push --force/-f/--delete/--mirror`, `rebase`, `stash drop/clear` |
| rm / find | — | `rm` y `find -delete` en el repo o `$TMPDIR` | `rm -r` sobre `/`, `~`, `.`, `*`, variable sin resolver o fuera del repo; `shred`, `dd of=` |
| SQL | `SELECT SHOW EXPLAIN DESCRIBE` | `INSERT UPDATE CREATE ALTER GRANT`, `INTO OUTFILE`, SQL no analizable, `mysqldump` | `DELETE DROP TRUNCATE` (también `ALTER … DROP`), sin distinguir mayúsculas |
| `bin/console` | `debug:* lint:* cache:* make:*`, `doctrine:migrations:status`, `migrate --dry-run`, `schema:update --dump-sql` | `doctrine:migrations:migrate/execute/diff`, `schema:create`, `messenger:consume`, `app:*` | `doctrine:database:drop`, `schema:drop`, `schema:update --force`, `fixtures:load` |
| wp-cli | `* list/get`, `plugin status`, `db size/check`, `search-replace --dry-run` | `plugin install/activate/update`, `option update`, `search-replace`, `db export`, `eval` | `db drop/import/reset`, `site empty`, `post/user delete`, `plugin delete` |
| composer / npm | `--dry-run` | `require remove update`, `install <pkg>`, `publish` | `npm audit fix` |
| docker | `ps logs inspect`, `compose ps/logs/config`, `exec` de herramientas de desarrollo (phpunit, phpstan, `composer install`, `npm test`) | `compose up/run/build`, `down` sin `-v`, `docker run`, `exec` con interior desconocido | `compose down -v`, `volume rm/prune`, `system prune` |
| gh | `pr/issue view/list`, `run view`, `api` GET | `issue create/comment`, `pr review`, `api` no GET | `pr create/merge`, `repo delete`, `auth token` |
| curl localhost | GET/HEAD | `-X POST/PUT/PATCH`, `-d` | `-X DELETE` |
| rsync | `--dry-run` | destino remoto | `--delete` sin dry-run |
| otros | — | error interno del gate | `sudo`; `cat/grep` sobre `.env*.local` |

Todo lo demás (tests, linters, `sed -i`/`mv`/`cp` dentro del repo, `npx`, `node`, scripts propios) lo resuelve el sandbox. Los borrados de ficheros del repo siempre pasan por `ask`.

## Lecturas

`guard-read.sh` bloquea logs, cachés y volcados (`*.log`, `var/log`, `storage/logs`, `.cache`, `*.sql.gz`) y `.env.local`, y aconseja `grep` con rango. Los logs que escribe `trim-output` van a `$TMPDIR` y sí se pueden leer. Las credenciales (`~/.ssh`, `~/.claude/.credentials.json`, `~/.config/gh/hosts.yml`) están en `deny`.

**Límite conocido:** `grep -rn X .` ejecutado como comando puede leer `.env.local`, porque no se pone `denyRead` de sandbox sobre él (rompería la lectura legítima por la propia app). El gate bloquea `cat/grep` directos sobre esos ficheros, no la búsqueda recursiva.

## Perfil «host» (sin Docker)

`php bin/console`, `wp` y `phpunit` en el host ejecutan código del repo y **no** se excluyen del sandbox globalmente. Si el proyecto no usa Docker y necesita la BD local, copia la plantilla `project-templates/settings.local.json` a `<proyecto>/.claude/settings.local.json` y conserva su bloque `sandbox.excludedCommands` (solo en proyectos de confianza). Con Docker ya queda cubierto por `docker *`.

## Sin sandbox (Windows nativo)

`/lf:setup --no-sandbox` pone `defaultMode: dontAsk` y fusiona `settings.nosandbox.json` (allows amplios: `bin/console`, `wp`, `npx`, `node`, `vendor/bin/*`…). El gate sigue imponiendo `ask`/`deny`.

## Variables y registros

- `LF_GATE=on|shadow|off` (por defecto `on`; `shadow` solo registra). `LF_TRIM=0` desactiva el recorte de salida.
- `~/.claude/lf-metrics/permissions.tsv` (prompts de permiso) y `gate.tsv` (decisiones del gate): léelos con `grep`/`awk` para ver qué sigue preguntando y ajustar.
- Si algo pregunta de más: ¿lleva `cd`, pipe o redirección que lo deja en el sandbox? Si no, añade el caso a `tests/gate-cases.tsv` y al clasificador.
