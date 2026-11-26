# Prompting: cómo pedir las cosas

Resumen operativo de las prácticas de prompting que el arnés aplica en sus propias instrucciones (la skill `lf:prompting` lo cita; esta es la única fuente). Para la versión oficial:

- [Mejores prácticas de prompting](https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Prompting Sonnet 5.5](https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- [Prompting Opus 5.5](https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)

## Las seis reglas

1. **Nombra ficheros y funciones, no intenciones.** La petición que funciona dice *qué* y *dónde*: «el contador de `templates/product/_form.html.twig`, el que ya está en el `maxlength`». La que no produce nada verificable dice «mejora mi código».
2. **Da el resultado esperado, no los pasos.** «Que no supere el `maxlength`» deja libertad para elegir la implementación; «añade un listener al evento input» la quita y suele ser peor.
3. **Una tarea por petición.** Meter refactor + bug + migración en un prompt produce Context Rot: el modelo entrelaza objetivos y entrega peor que en dos peticiones separadas. Si son dos tareas, son dos sesiones (`/clear` entre medias).
4. **Contexto mínimo y relevante.** Pega el error, el fragmento, el `AGENTS.md`. El proyecto entero ya está en el repo, y mandarlo cuesta contexto que no se recupera.
5. **Da el criterio de aceptación.** «Pasa el test del componente y `php -l`» convierte la entrega en algo verificable sin que tengas que revisar línea por línea.
6. **Deja que pregunte lo que no sabe, y solo eso.** Si falta un dato que no se puede inferir del código, que pregunte; si se puede inferir, que lo asuma y lo diga en una línea. Preguntar por lo deducible es la fricción más cara que existe, y el arnés la elimina con los flujos S y M.

## Qué es «terminado»

Toda petición M y toda entrega llevan una línea `Hecho cuando: <comprobación ejecutable>`: un comando o prueba que cualquiera puede lanzar («`vendor/bin/phpunit --filter ProductFormTest` en verde y `php -l` limpio»). Sin ella «terminado» es una opinión. Si no hay comprobación ejecutable, se dice qué no se ha podido comprobar.

## Esfuerzo

Empieza en `medium` (es el valor por defecto del arnés). Sube con `/effort high` o escribe `ultrathink` en ese turno solo si la tarea se atasca; no empieces alto «por si acaso».

Lo que dicen las guías oficiales de Sonnet 5.5 y Opus 5.5 (verificadas 2026-11-26) y cómo se traduce aquí:

- Los niveles se recalibraron entre modelos: `medium` de Opus 5.5 iguala o supera al `high` de Opus 5. No copies el esfuerzo de un modelo anterior; mide.
- En `low` y `medium` Sonnet 5.5 puede parar a consultar antes de acabar, y en `low` a veces da por hecho un cambio sin ejecutar una comprobación real. De ahí `Hecho cuando:` en toda entrega M: obliga a nombrar y lanzar la comprobación.
- Añade tests, docs o ficheros no pedidos, más cuanto mayor es el esfuerzo. Pedir el alcance exacto («solo esto; si ves algo más, menciónalo al final») es la regla de «Código mínimo» de `CLAUDE.md`.
- En `xhigh`/`max` revisa y verifica por su cuenta, incluso lanzando subagentes revisores: cuesta más tiempo y tokens, y por eso solo tras aprobación y no como rutina.
- No pidas «piensa menos» en el prompt: baja el esfuerzo, que es lo fiable.

## Patrones a evitar

- Pedir «mejora», «revisa todo» o «optimiza» sin alcance ni criterio.
- Meter dos tareas en una petición.
- Describir el síntoma de un error en vez de pegarlo.
- Prohibir en negativo («no hagas X») sin decir qué sí: da la alternativa.
- Pedir documentos de análisis, resúmenes o planes que nadie va a leer.
- Dar órdenes de razonamiento («piensa a fondo»): se paga en cada turno y no mejora el resultado; usa el esfuerzo.

## Estilo de la casa

- Respuestas en español; identificadores, código y commits en inglés.
- Conciso: resultado primero, sin preámbulos ni resúmenes de lo que ya se ve en el diff.
- Cambio mínimo y entero; sin abstracciones «para luego».
- Notas de memoria: un hecho por nota, predictivas («lo que la próxima sesión necesitará»), con fecha absoluta.

## Errores que se ven en sesiones reales

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| Cambia de enfoque a mitad de tarea | Petición con varios objetivos | Divídela en S/M, una por sesión |
| Pregunta algo que está en el repo | No conoce el layout | Nombra la ruta en la petición |
| Verifica con la suite entera | No le diste el comando | Da el comando barato de verificación |
| Reimplementa algo que ya existe | No conoce el mapa del proyecto | Apúntale a la skill de stack |
| Alarga el cambio sin pedirlo | «Mejora X» sin límites | Delimita el alcance explícitamente |
| Se atasca en un fallo | Falta la salida real | Pega el error, no la descripción del error |
| Se reimplementa lo que ya funciona | Petición ambigua de refactor | «No toques X» en la petición |

## Cómo revisar las instrucciones del arnés

Cuando toques `CLAUDE.md`/`AGENTS.md`, skills, agentes o hooks del repo, estas son las preguntas:

- **¿Es un índice o una enciclopedia?** Un fichero de reglas debe decir *cómo verificar*, *qué convenciones hay*, *qué no se toca* y *dónde está el detalle*. Si necesita 300 líneas, el detalle se va a una skill y queda el enlace.
- **¿Cuánto cuesta en cada sesión?** Todo lo que se carga al abrir sesión se paga siempre. Si una skill puede ser manual (`disable-model-invocation`) o activarse por `paths`, ese es el formato por defecto.
- **¿El hook es silencioso cuando no aplica?** Un hook que imprime en cada llamada es ruido puro: passthrough.
- **¿La regla previene un error caro, o el modelo ya lo dedujo?** Lo segundo sobra. Lo primero vale por sí solo, aunque ocupe tres líneas.
- **¿Hay una alternativa obvia que no sea?** Documentar por qué se descartó algo (`docs/decisions/`) vale más que defender la elección.

Y una regla del arnés que también es de prompting: **el error más caro no es una mala respuesta, es una respuesta correcta a una pregunta mal hecha**. Por eso el triaje S/M/L es la primera instrucción: clasificar la tarea evita que una tarea de diez minutos arranque con un plan de arquitectura.
