# 0025 — Quality gates en local (hook `Stop`, bloque `gates`, plantilla CI)

Fecha: 2026-11-25

Decisión: hook `Stop` (`plugins/lf/hooks/stop-gate.mjs`, Node sin dependencias, timeout 5) que, si el cambio toca código (`gates.code`, menos `gates.ignore`) y ningún test (`gates.test`), bloquea **una vez por sesión** pidiendo el test o una justificación de una línea. Los globs y los comandos salen del bloque ```` ```yaml gates ```` del perfil activo (`~/.claude/lf/profiles/<perfil>.md`; `web.md` lo trae relleno, `generic.md` vacío → el hook no hace nada). La tabla en prosa de `web.md` sigue siendo la versión humana; el bloque es la fuente máquina y H7 la comparte. `project-templates/quality-gates.yml` es un workflow de GitHub Actions con jobs por stack cuyos comandos coinciden con `gates.commands` (un test lo comprueba), para que local y CI exijan lo mismo; `vue-tsc` y `astro check` solo están en CI.
Diff: `git status --porcelain -z -uall` (staged, unstaged y sin seguimiento; los borrados no cuentan). Marca de «ya avisé» en `${TMPDIR:-/tmp}/lf-stop-gate-<session_id>`; el id solo es un nombre de fichero local.
Fallo seguro: `stop_hook_active`, marca existente, sin perfil o bloque, sin `git` o ante cualquier error → exit 0 silencioso (log en `~/.claude/lf-metrics/stop-gate.log`). Un bloque con forma inválida (lista `- x`, clave desconocida) se rechaza con error explícito en `--check`, no en silencio.
Alcance: no ejecuta formato, estático ni tests (los lanza el flujo S/M); sin cobertura 80 %; WordPress fuera en v1 (solo globs Symfony y JS/TS).
Aviso de actualización: el perfil se copia a `~/.claude/lf/profiles/` en `/lf:setup`; quien no reinstale tras actualizar no tendrá el bloque y el hook queda inerte.
Descartado: parsear la tabla Markdown (frágil por la prosa); insistir en cada Stop (bucles) o solo avisar (se ignora); cobertura en un Stop (caro); dos plantillas CI, una por stack (duplican cabeceras); bash + `jq` para los globs (poco legible).
