# Arnés LF — reglas globales (OpenCode)

Equipo web Lefebvre: PHP/Symfony, WordPress, Node, Astro, React, Vue, MySQL. La ruta y la forma de ejecutar cada proyecto las indica su propio `CLAUDE.md`.
Respondo en español. Identificadores, código y mensajes de commit en inglés.

Este fichero es un **índice** de la política del arnés, no una enciclopedia. Lo específico vive en skills, plantillas y docs del repo del arnés; aquí solo está lo que aplica a todas las sesiones.

## 0. Modelos y esfuerzo

Solo tres roles, y todos resueltos a **modelos gratuitos** del catálogo de OpenCode. Ningún modelo de pago: el arnés se sostiene sobre el nivel gratuito.

| Rol | Alias | Modelo típico | Esfuerzo |
| --- | --- | --- | --- |
| Typos, renombrados, config | estándar | `opencode/big-pickle` | low |
| Desarrollo diario: features, tests, bugs | estándar | `opencode/mimo-v2.6-flash-free` | high (por defecto) |
| Subagentes: búsquedas, tests, logs, ruido | ligero | `opencode/nemotron-3.5-lightning-free` | low/medium |
| Planificación y arquitectura (tarea L) | planificación | `opencode/muse-spark-1.3-free` | high / xhigh |
| Bug que se resiste, refactor multi-fichero | planificación | `opencode/muse-spark-1.3-free` | xhigh, solo tras aprobación del usuario |

- **Planificar con el modelo de planificación en modo Plan; ejecutar siempre con el estándar.**
- El modelo de planificación en una tarea M solo si el contrato de un minuto no la resuelve: lo pido, lo uso para el plan, ejecuto con el estándar.
- Atajos: `/opusplan` (planifica y ejecuta en una invocación), `/ultrathink` (un único turno con más razonamiento, sin tocar el modelo de la sesión), `/ultracode` (toda la sesión a xhigh y flujos multiagente; no por defecto).
- Cambiar de modelo a mitad de sesión rompe la caché de prompts: para planificar y ejecutar, lo barato es sesión de planificación → `/handoff` → `/new` → sesión estándar. Detalle en `docs/MODELOS.md`.
- La config lleva alias (`opencode/{estandar,planificacion,ligero}:latest`), nunca identificadores: `plugins/modelo.ts` los resuelve al arrancar al gratuito más reciente de esa familia. Si añades un subagente, ponle `model:` explícito.

## 1. Triaje obligatorio (una línea, sin preguntar)

Antes de tocar nada clasifico la tarea y lo digo: `Triaje: S|M|L — <motivo en 5 palabras>`.

- **S**: ≤3 ficheros, una sola capa, sin cambio de esquema ni de API/props. Bug, texto, estilo, refactor local, ajuste de config.
- **M**: 4–12 ficheros o cruza capas (entidad + migración + controlador + vista/componente); cambia un contrato dentro de un módulo.
- **L**: módulo nuevo, >12 ficheros, varios contratos, alternativas de arquitectura reales, o el usuario lo pide.
  Duda S/M → M. Duda M/L → una sola pregunta. `/triage` para discutir la clasificación; `/s`, `/m`, `/l` para forzarla.

## 2. Flujo S — cero interrupciones

1. Localizo con Grep/Glob. Leo solo el rango necesario.
2. Implemento.
3. Verifico con el comando más barato que pruebe el cambio (test concreto con `--filter`, `php -l`, `tsc --noEmit`, `vue-tsc`); si la salida puede superar 40 líneas la delego al agente `@verbose-runner`.
4. Entrego: resumen de 3–6 líneas, ficheros tocados, cómo probarlo y una línea con lo que no he comprobado y sus riesgos.
   Sin preguntas, sin AskUserQuestion, sin commit. Si falta un dato imposible de inferir del código, lo asumo, lo digo en una línea y sigo.

## 3. Flujo M — contrato de un minuto, luego autónomo

1. Escribo el contrato en ≤15 líneas: entidades y campos, endpoints o props/emits, migración sí/no, ficheros que tocaré.
2. Si el contrato es inequívoco continúo sin esperar. Si hay una decisión con impacto real (nombre público, esquema, ruta) la marco como `Asumo: X` y continúo; el usuario corrige después.
3. Implemento por capas (dato → servicio → controlador/API → vista) verificando cada capa con `@verbose-runner`.
4. Revisión final de solo lectura con el agente `@reviewer`.
5. Entrego resumen, lista de asunciones, cómo probarlo y lo que no he comprobado. Sin commit salvo petición explícita.

## 4. Flujo L — arquitectura primero, ejecución por hitos

Invoco la skill `l`: entrevista única de ≤5 preguntas, contrato de arquitectura en `.planning/ARCHITECTURE.md`, un solo OK, y ejecución por hitos con checkpoints solo al cerrar cada hito. Planificar con `@planner` (modelo de planificación), ejecutar cada hito con `@executor` (modelo estándar), en serie. Los hitos se abren de uno en uno, con el mismo criterio que el flujo M; `.planning/STATE.md` lleva el estado.

## 5. Contexto: no acumular, reiniciar

- **Prohibido compactar.** OpenCode no expone compactación como acción del usuario: si ocurre, es automática, y eso es justo lo que hay que evitar porque pierde lo que no se le pide (un enfoque que ya falló, una decisión descartada). El plugin `lf` inyecta en el resumen lo que no se debe perder, pero la respuesta correcta sigue siendo no llegar hasta ahí.
- Al terminar una tarea: `/new` y la siguiente en sesión nueva. Nunca encadeno una tarea no relacionada con otra.
- Al llegar al **75–80 % de contexto**: `/handoff` para escribir `handoff.md` y, si hace falta, `to-do.md`; después `/new`. Es la primera instrucción que recibe la sesión siguiente.
- Si compacta a pesar de todo, el plugin `lf.ts` ya inyecta en el resumen: decisiones, enfoques descartados, ficheros modificados y próximo paso. Aun así, `/handoff` + `/new` es más barato que recuperar de un resumen.
- Reglas de `handoff.md`/`to-do.md`: no duplicar lo recuperable en `git log`, código o el gestor de tareas; una sola fuente de verdad (sobrescribir, nunca acumular con fecha); próximo paso siempre concreto; fechas absolutas; por debajo de una página; lo terminado se archiva. Plantillas en `docs/templates/` del repo del arnés.
- Sesión nueva al día, no sesiones reutilizadas durante semanas; no retomar sesiones antiguas tras pausas largas, pierden la caché.

## 6. Economía de contexto (siempre)

- Salidas largas (tests, builds, `bin/console`, logs, `composer`, `npm install`) → `@verbose-runner`, que devuelve solo fallos y resumen.
- Nunca `cat` de ficheros grandes: Read con offset/limit o `grep -n`. Nunca `find` sin `-maxdepth`. Nunca listar ni leer `vendor/`, `node_modules/`, `var/`, `dist/`, `public/build/`, `.git/`.
- Nunca leer logs completos: `grep` sobre el log y un rango acotado; el log entero se queda en disco.
- Un cambio, una verificación: no relanzo la suite completa tras cada edición; ejecuto el test del fichero afectado.
- No uso subagentes salvo `@verbose-runner`, `@reviewer`, `@explore` (bósquedas amplias), `@planner`/`@executor` (flujo L) y `@seo-audit` cuando toque.
- **Subagentes sí; agent teams no por defecto.** Cada miembro de un equipo tiene contexto propio y, según estimaciones, cuesta en torno a 7× una sesión normal (no medido en este repo). Equipos solo para tareas cortas, y se cierran al terminar.
- El modelo de cada subagente está fijado por `model:` en su definición en `~/.config/opencode/agents/`; si añado un subagente, le pongo modelo explícito y gratuito.
- Salida verbosa del propio agente → `/caveman lite|full` (opt-in).
- No dejo basura: nada de logs, capturas ni ficheros desfasados en el repo. Si creo un log para trabajar, va a `${TMPDIR:-/tmp}`.

## 7. MCP

Los MCP se habilitan por sesión y solo si la tarea los necesita (`opencode.json` → `mcp`). En una tarea S/M no hay ninguno activo por defecto. Al cerrar la sesión, revisa `opencode mcp list` y desactiva los que no se hayan usado: cada MCP añade definiciones al contexto fijo.

## 8. Stack

- **Symfony**: comandos con `php bin/console` o `docker compose exec <svc> php bin/console` según indique el AGENTS.md del proyecto. Migraciones: genero con `make:migration` y NO ejecuto `doctrine:migrations:migrate` sin que se pida. Tests: `vendor/bin/phpunit --filter <Clase>`. Servicios autowired, atributos PHP 8, DTO + Validator, nada de lógica en controladores.
- **WordPress**: `wp` CLI para inspección. Nunca edito core; plugins y temas viven en `wp-content/`. Escapado y nonces siempre.
- **Frontend (Astro/Vue/React)**: TypeScript. `tsc --noEmit` o `vue-tsc` antes de cualquier build; `npm run build` solo al final. En Astro, islas con `client:*` solo donde hace falta interactividad.
- **MySQL**: solo lecturas (`SELECT`, `SHOW`, `EXPLAIN`, `DESCRIBE`). DDL o DML destructivo, nunca.
- Detalles por stack en las skills `symfony`, `wordpress`, `frontend-astro-vue-react`, `mysql-doctrine` (se cargan solas al tocar sus ficheros).

## 9. Código mínimo

Perezoso con la solución, nunca con el cambio. Antes de escribir, me quedo con la primera opción que funcione entera:

1. ¿Hace falta? Lo que nadie pidió (opciones, flexibilidad, código «para luego») no se escribe; lo nombro en una línea.
2. ¿Ya existe en el código (helper, servicio, componente, patrón)? Lo uso como lo usa el código de alrededor.
3. ¿Lo da la stdlib, el framework o una dependencia ya instalada? Lo uso. Nunca añado una dependencia por pocas líneas.
4. Si no: lo mínimo que funcione. Borrar gana a añadir; sin wrappers ni abstracciones con una sola implementación.

- Mínimo no es saltarse capas: respeto la estructura del proyecto (Symfony: DTO + Validator y servicio; WP: escapado, nonces y capabilities).
- El cambio sí va entero: llamadores, tests y fixtures que rompa entran en la tarea. En un bug, antes de editar busco todos los llamadores y arreglo la causa una vez, en el código compartido.
- Lógica no trivial (rama, bucle, parser, dinero, seguridad) deja un test pequeño; lo trivial, ninguno.
- Nunca recorto: validación en fronteras de confianza, errores que evitan pérdida de datos, seguridad, accesibilidad, lo que pidió el usuario.
- A igual tamaño, la opción correcta en los casos límite. Comentarios solo para el *porqué*.

## 10. Errores que no cometo

- No hago commits ni `push` por iniciativa propia, ni PRs, ni `--amend` sobre lo publicado. Commit y push los decide el usuario: solo si me los pide, y el permiso `ask` le pedirá confirmación.
- No relanzo la suite completa para «asegurarme» tras un cambio acotado.
- No generalizo una petición: si el usuario nombra ficheros o funciones, voy a esos.
- No «mejoro» código fuera del alcance de la tarea.
- No ejecuto migraciones, ni pino a main, ni borro ramas; pregunto.
- No dejo logs ni ficheros temporales en el repo.
- No confío en plugins/proxies que prometen reducir tokens sin medir antes: muchos hacen el efecto contrario.

## 11. Git

Commit y push los decide siempre el usuario: no los hago por iniciativa propia, solo si me los pide (S/M/L), y ambos están en `ask`, así que se confirman uno a uno. Conventional Commits en inglés, atómicos. No hago PRs, `reset --hard`, `checkout -- .`, `clean` ni `--amend` (deny). En L, GSD comitea por tarea: cada commit pasa por `ask` y el usuario decide; si lo rechaza, continúo sin commitear y lo anoto en el resumen del hito. `planning.commit_docs` va a `false`.

## Índice: dónde está el detalle

| Qué buscas | Dónde |
| --- | --- |
| Modelos, esfuerzo, atajos, caché | `docs/MODELOS.md` |
| Cómo escribir buenas peticiones | skill `prompting` y `docs/PROMPTING.md` |
| Errores frecuentes y checklist diaria | `docs/ERRORES-COMUNES.md` |
| Plantilla de handoff y de to-do | `docs/templates/handoff.md`, `docs/templates/todo.md` |
| Escribir el handoff ahora | `/handoff` |
| Convenciones de un proyecto concreto | su propio `AGENTS.md` |
