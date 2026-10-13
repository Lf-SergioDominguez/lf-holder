<!-- lf-harness 0.5.1 -->
# Arnés LF — reglas globales

Equipo web Lefebvre: PHP/Symfony, WordPress, Node, Astro, React, Vue, MySQL. La ruta y la forma de ejecutar cada proyecto las indica su propio `CLAUDE.md`.
Respondo en español. Identificadores, código y mensajes de commit en inglés.

Este fichero es un **índice** de la política del arnés, no una enciclopedia. Lo específico vive en skills, plantillas y docs del repo del arnés; aquí solo está lo que aplica a todas las sesiones.

## 0. Modelos y esfuerzo

Solo **Sonnet, Opus y Haiku**. Fable está prohibido en cualquier fase, incluida la planificación.

| Trabajo | Modelo | Esfuerzo |
| --- | --- | --- |
| Typos, renombrados, config | Sonnet | low |
| Desarrollo diario: features, tests, bugs | Sonnet | high (por defecto) |
| Subagentes: búsquedas, tests, logs, ruido | Haiku | low/medium |
| Planificación y arquitectura (tarea L) | Opus | high / xhigh |
| Bug que se resiste, refactor multi-fichero | Opus | xhigh, solo tras aprobación del usuario |

- **Planificar con Opus en modo Plan; ejecutar siempre con Sonnet.**
- Opus en una tarea M solo si el contrato de un minuto no la resuelve: lo pido, lo uso para el plan, ejecuto con Sonnet.
- Atajos: `/lf:opusplan` (Opus planifica y Sonnet ejecuta), `/lf:ultrathink` (un único turno con más razonamiento, sin tocar el modelo de la sesión), `/lf:ultracode` (toda la sesión a xhigh y flujos multiagente; no por defecto).
- Cambiar de modelo a mitad de sesión rompe la caché de prompts: para planificar y ejecutar, lo barato es sesión Opus → `/clear` → sesión Sonnet. Detalle en `docs/MODELOS.md`.

## 1. Triaje obligatorio (una línea, sin preguntar)

Antes de tocar nada clasifico la tarea y lo digo: `Triaje: S|M|L — <motivo en 5 palabras>`.

- **S**: ≤3 ficheros, una sola capa, sin cambio de esquema ni de API/props. Bug, texto, estilo, refactor local, ajuste de config.
- **M**: 4–12 ficheros o cruza capas (entidad + migración + controlador + vista/componente); cambia un contrato dentro de un módulo.
- **L**: módulo nuevo, >12 ficheros, varios contratos, alternativas de arquitectura reales, o el usuario lo pide.
  Duda S/M → M. Duda M/L → una sola pregunta. `/lf:triage` para discutir la clasificación; `/lf:s`, `/lf:m`, `/lf:l` para forzarla.

## 2. Flujo S — cero interrupciones

1. Localizo con Grep/Glob. Leo solo el rango necesario.
2. Implemento.
3. Verifico con el comando más barato que pruebe el cambio (test concreto con `--filter`, `php -l`, `tsc --noEmit`, `vue-tsc`); si la salida puede superar 40 líneas la delego al agente `lf:verbose-runner`.
4. Entrego: resumen de 3–6 líneas, ficheros tocados y cómo probarlo.
   Sin preguntas, sin AskUserQuestion, sin commit. Si falta un dato imposible de inferir del código, lo asumo, lo digo en una línea y sigo.

## 3. Flujo M — contrato de un minuto, luego autónomo

1. Escribo el contrato en ≤15 líneas: entidades y campos, endpoints o props/emits, migración sí/no, ficheros que tocaré.
2. Si el contrato es inequívoco continúo sin esperar. Si hay una decisión con impacto real (nombre público, esquema, ruta) la marco como `Asumo: X` y continúo; el usuario corrige después.
3. Implemento por capas (dato → servicio → controlador/API → vista) verificando cada capa con `lf:verbose-runner`.
4. Revisión final de solo lectura con el agente `lf:reviewer`.
5. Entrego resumen, lista de asunciones y cómo probarlo. Sin commit salvo petición explícita.

## 4. Flujo L — arquitectura primero, GSD después

Invoco la skill `lf:l`: entrevista única de ≤5 preguntas, contrato de arquitectura en `.planning/ARCHITECTURE.md`, un solo OK, y ejecución por hitos delegada en GSD (`gsd-plan-phase` → `gsd-execute-phase`). Checkpoints solo al cerrar cada hito. Planificar con `/model claude-opus-5-5`, ejecutar con Sonnet.

## 5. Contexto: no acumular, reiniciar

- **Prohibido compactar por sistema.** La compactación automática pierde lo que no se sabe pedir (un enfoque que ya falló, una decisión descartada) y cuesta una petición completa.
- Al terminar una tarea: `/clear` y la siguiente en sesión nueva. Nunca encadeno una tarea no relacionada con otra.
- Al llegar al **75–80 % de contexto**: `/lf:handoff` para escribir `handoff.md` y, si hace falta, `to-do.md`; después `/clear` y sesión nueva. Es la primera instrucción que recibe la sesión siguiente.
- `/compact` solo como último recurso y siempre con instrucciones: qué decisiones conservar, qué enfoques descartados, qué ficheros se han modificado.
- Reglas de `handoff.md`/`to-do.md`: no duplicar lo recuperable en `git log`, código o el gestor de tareas; una sola fuente de verdad (sobrescribir, nunca acumular con fecha); próximo paso siempre concreto; fechas absolutas; por debajo de una página; lo terminado se archiva. Plantillas en `docs/templates/`.
- Sesión nueva al día, no sesiones reutilizadas durante semanas; no retomar sesiones antiguas tras pausas largas, pierden la caché.

## 6. Economía de contexto (siempre)

- Salidas largas (tests, builds, `bin/console`, logs, `composer`, `npm install`) → `lf:verbose-runner`, que devuelve solo fallos y resumen.
- Nunca `cat` de ficheros grandes: Read con offset/limit o `grep -n`. Nunca `find` sin `-maxdepth`. Nunca listar ni leer `vendor/`, `node_modules/`, `var/`, `dist/`, `public/build/`, `.git/`.
- Nunca leer logs completos: `grep` sobre el log y un rango acotado; el log entero se queda en disco.
- Un cambio, una verificación: no relanzo la suite completa tras cada edición; ejecuto el test del fichero afectado.
- No uso subagentes salvo `lf:verbose-runner`, `lf:reviewer`, `Explore` (búsquedas amplias), `lf:planner`/`lf:executor` (flujo L) y los de GSD dentro de L.
- **Subagentes sí; agent teams no por defecto.** Cada miembro de un equipo tiene contexto propio y, según estimaciones, cuesta en torno a 7× una sesión normal (no medido en este repo). Equipos solo para tareas cortas, y se cierran al terminar.
- El modelo de subagente barato está fijado por `CLAUDE_CODE_SUBAGENT_MODEL` en settings y por `model:` en cada definición; si añado un subagente, le pongo modelo explícito.
- No invoco skills `gsd-*` fuera del flujo L.
- Salida verbosa del propio agente → `/lf:caveman lite|full` (opt-in) o output style `caveman`.
- No dejo basura: nada de logs, capturas ni ficheros desfasados en el repo. Si creo un log para trabajar, va a `${TMPDIR:-/tmp}`.

## 7. MCP

Los MCP se habilitan por sesión y solo si la tarea los necesita. Al empezar, si la petición es de una sola capa (S/M), no hay ningún MCP activo por defecto. Al cerrar la sesión, revisar y desactivar los que no se han usado.

## 8. Stack

- **Symfony**: comandos con `php bin/console` o `docker compose exec <svc> php bin/console` según indique el CLAUDE.md del proyecto. Migraciones: genero con `make:migration` y NO ejecuto `doctrine:migrations:migrate` sin que se pida. Tests: `vendor/bin/phpunit --filter <Clase>`. Servicios autowired, atributos PHP 8, DTO + Validator, nada de lógica en controladores.
- **WordPress**: `wp` CLI para inspección. Nunca edito core; plugins y temas viven en `wp-content/`. Escapado y nonces siempre.
- **Frontend (Astro/Vue/React)**: TypeScript. `tsc --noEmit` o `vue-tsc` antes de cualquier build; `npm run build` solo al final. En Astro, islas con `client:*` solo donde hace falta interactividad.
- **MySQL**: solo lecturas (`SELECT`, `SHOW`, `EXPLAIN`, `DESCRIBE`). DDL o DML destructivo, nunca.
- Detalles por stack en las skills `lf:symfony`, `lf:wordpress`, `lf:frontend-astro-vue-react`, `lf:mysql-doctrine` (se cargan solas al tocar sus ficheros).

## 9. Errores que no cometo

- No hago commits ni `push` por iniciativa propia, ni PRs, ni `--amend` sobre lo publicado. Commit y push los decide el usuario: solo si me los pide, y el permiso `ask` le pedirá confirmación.
- No relanzo la suite completa para «asegurarme» tras un cambio acotado.
- No generalizo una petición: si el usuario nombra ficheros o funciones, voy a esos.
- No «mejoro» código fuera del alcance de la tarea.
- No ejecuto migraciones, ni pino a main, ni borro ramas; pregunto.
- No dejo logs ni ficheros temporales en el repo.
- No confío en plugins/proxies que prometen reducir tokens (RTK incluido) sin medir antes: muchos hacen el efecto contrario.

## 10. Git

Commit y push los decide siempre el usuario: no los hago por iniciativa propia, solo si me los pide (S/M/L), y ambos están en `ask`, así que se confirman uno a uno. Conventional Commits en inglés, atómicos. No hago PRs, `reset --hard`, `checkout -- .`, `clean` ni `--amend` (deny). En L, GSD comitea por tarea: cada commit pasa por `ask` y el usuario decide; si lo rechaza, continúo sin commitear y lo anoto en el resumen del hito. `planning.commit_docs` va a `false`.

## Índice: dónde está el detalle

| Qué buscas | Dónde |
| --- | --- |
| Modelos, esfuerzo, atajos, caché | `docs/MODELOS.md` |
| Cómo escribir buenas peticiones | skill `lf:prompting` y `docs/PROMPTING.md` |
| Errores frecuentes y checklist diaria | `docs/ERRORES-COMUNES.md` |
| Plantilla de handoff y de to-do | `docs/templates/handoff.md`, `docs/templates/todo.md` |
| Escribir el handoff ahora | `/lf:handoff` |
| Convenciones de un proyecto concreto | su propio `CLAUDE.md` (plantilla en `project-templates/CLAUDE.md`) |
