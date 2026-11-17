<!-- lf-harness 1.0.1 -->
# Arnés LF — reglas globales

Equipo web Lefebvre: PHP/Symfony, WordPress, Node, Astro, React, Vue, MySQL. La ruta y la forma de ejecutar cada proyecto las indica su propio `CLAUDE.md`.
Respondo en español. Identificadores, código y mensajes de commit en inglés.
Esto es un **índice**: el detalle vive en skills y en `~/.claude/lf/docs/`. Las skills de stack (`lf:symfony`, `lf:wordpress`, `lf:frontend-astro-vue-react`, `lf:mysql-doctrine`) se cargan solas al tocar sus ficheros.

## Modelos

Solo **Sonnet, Opus y Haiku**; Fable prohibido. Opus planifica (L), Sonnet ejecuta, Haiku para subagentes. Esfuerzo `medium`; escalo (`ultrathink`, `/effort`) solo si me atasco. Detalle: `MODELOS.md`.

## Triaje (una línea, sin preguntar)

Antes de tocar nada: `Triaje: S|M|L — <motivo en 5 palabras>`.

- **S**: ≤3 ficheros, una capa, sin cambio de esquema ni de API/props.
- **M**: 4–12 ficheros, o cruza capas, o cambia un contrato dentro de un módulo.
- **L**: módulo nuevo, >12 ficheros, varios contratos, arquitectura en juego, o lo pide el usuario.
  Duda S/M → M. Duda M/L → una sola pregunta. Forzar: `/lf:s`, `/lf:m`, `/lf:l`; discutir: `/lf:triage`.

## Flujos

- **S**: localizo con Grep/Glob, implemento, verifico con el comando más barato (`--filter`, `php -l`, `tsc --noEmit`). Entrego en 3–6 líneas: ficheros, cómo probarlo, `Hecho cuando: <comprobación ejecutable>` y lo no comprobado. Sin preguntas ni commit; si falta un dato inferible, lo asumo y lo digo.
- **M**: contrato ≤15 líneas (entidades/campos, endpoints o props/emits, migración sí/no, ficheros, `Hecho cuando:`). Decisión con impacto real → `Asumo: X` y sigo. Implemento por capas (dato → servicio → API → vista), verifico cada una con `lf:verbose-runner`, reviso con `lf:reviewer` y entrego con asunciones y lo no comprobado.
- **L**: skill `lf:l` (entrevista ≤5 preguntas, `.planning/ARCHITECTURE.md` con Opus, un OK, hitos con GSD en Sonnet). **Una orden GSD por sesión**, `/clear` entre medias. No invoco `gsd-*` fuera de L.

## Cómo pedir permisos sin fricción

- Un comando por llamada. Sin `cd`, `$(…)`, heredocs ni `VAR=…` delante si no hacen falta (el 51 % de los prompts del log empieza por `cd`).
- Con `docker`, `mysql`, `gh` y git de red, además sin pipes ni redirecciones: si no, la llamada se queda en el sandbox y falla.
- `--dry-run` antes de la variante real.
- No intento `DELETE`/`DROP` ni borrados recursivos: doy el comando al usuario con `! …`. No limpio `$TMPDIR`.
- Migraciones: genero con `make:migration`, no ejecuto `doctrine:migrations:migrate`. MySQL solo lectura.

## Contexto

- **Prohibido compactar por sistema.** Al terminar una tarea, `/clear` y la siguiente en sesión nueva; nunca encadeno tareas no relacionadas.
- Al **75–80 %** de contexto (sobre 200K; la statusline lo marca): `/lf:handoff` (`handoff.md` y, si hace falta, `to-do.md`), `/clear` y sesión nueva; el handoff es la primera instrucción de la siguiente. `/compact` solo como último recurso y con instrucciones (decisiones, enfoques descartados, ficheros).
- Handoff y to-do: no duplican lo recuperable en `git log`, código o el gestor de tareas; se sobrescriben; próximo paso concreto; fechas absolutas; <1 página.
- Memoria: nota predictiva («lo que la próxima sesión necesitará»), un hecho por nota, sin documentos de análisis no pedidos. La consolida `/lf:dream` (manual; SessionStart avisa si toca).
- Salidas largas (tests, builds, `bin/console`, logs, `composer`, `npm install`) → `lf:verbose-runner`. Nunca `cat` de ficheros grandes (Read con offset/limit o `grep -n`), `find` sin `-maxdepth`, ni leer `vendor/`, `node_modules/`, `var/`, `dist/`, `.git/` ni logs enteros.
- Un cambio, una verificación: no relanzo la suite completa tras un cambio acotado.
- Subagentes solo `lf:verbose-runner`, `lf:reviewer`, `Explore`, `lf:planner`/`lf:executor` (L) y los de GSD en L; agent teams no. Subagente nuevo → `model:` explícito.
- MCP solo si la tarea lo necesita. Nada de basura en el repo: logs y temporales a `${TMPDIR:-/tmp}`.
- Web moderna (HTML/CSS/JS de cliente, también Twig y temas WP): antes de un patrón de UI o capacidad de plataforma consulto `npx -y modern-web-guidance@latest search "<consulta>"`. Navegadores: `.mwgrc`; si no, el CLAUDE.md del proyecto; si no, Baseline Widely available.
- UI, estilos o documentos con marca: leo antes `~/.claude/lf/house-style/INDEX.md` si existe (house style corporativo, tokens `--lf-*`) y lo aplico; manda sobre cualquier skill de diseño genérica. Se cambia con `/lf:house-style <ruta>`.

## Código mínimo

1. ¿Hace falta? Lo que nadie pidió no se escribe; lo nombro en una línea.
2. ¿Ya existe (helper, servicio, componente) o lo da la stdlib, el framework o una dependencia instalada? Lo uso; nunca una dependencia por pocas líneas.
3. Si no: lo mínimo que funcione, sin wrappers ni abstracciones de una sola implementación. Mínimo no es saltarse capas (Symfony: DTO + Validator + servicio; WP: escapado, nonces, capabilities).
4. El cambio va entero (llamadores, tests, fixtures). En un bug, busco todos los llamadores y arreglo la causa una vez. Lógica no trivial deja un test pequeño.
5. Nunca recorto validación en fronteras de confianza, pérdida de datos, seguridad, accesibilidad ni lo pedido. Comentarios solo para el *porqué*.

## Git y alcance

Commit y push los decide el usuario: solo si me los pide, y ambos están en `ask`. Conventional Commits en inglés, atómicos. No hago PRs, `--amend` sobre lo publicado, `reset --hard`, `checkout -- .`, `clean`, ni piso main ni borro ramas. En L, GSD comitea por tarea: si se rechaza un commit, sigo sin commitear y lo anoto en el resumen del hito. `planning.commit_docs` a `false`.
No generalizo una petición ni «mejoro» fuera del alcance: si nombra ficheros o funciones, voy a esos.

## Índice

`~/.claude/lf/docs/`: `MODELOS.md` (modelos, esfuerzo, caché), `PROMPTING.md` (cómo pedir; skill `lf:prompting`), `ERRORES-COMUNES.md` (checklist), `PERMISOS.md` (qué pasa, pregunta o se bloquea), `MEMORIA.md` (handoff y notas). Proyecto concreto: su `CLAUDE.md`.
