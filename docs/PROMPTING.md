# Prompting: cómo pedir las cosas

Resumen operativo de las prácticas de prompting que el arnés aplica en sus propias instrucciones. Las reglas valen para cualquier modelo: no dependen del que esté sentado en la sesión. Para la versión oficial:

- [Documentación de OpenCode](https://opencode.ai/docs) — agentes, comandos, plugins, permisos y skills.
- [Modelos de OpenCode](https://opencode.ai/docs/models) — catálogo y selección por tarea.

## Las seis reglas

1. **Nombra ficheros y funciones, no intenciones.** La petición que funciona dice *qué* y *dónde*: «el contador de `templates/product/_form.html.twig`, el que ya está en el `maxlength`». La que no produce nada verificable dice «mejora mi código».
2. **Da el resultado esperado, no los pasos.** «Que no supere el `maxlength`» deja libertad para elegir la implementación; «añade un listener al evento input» la quita y suele ser peor.
3. **Una tarea por petición.** Meter refactor + bug + migración en un prompt produce Context Rot: el modelo entrelaza objetivos y entrega peor que en dos peticiones separadas. Si son dos tareas, son dos sesiones nuevas.
4. **Contexto mínimo y relevante.** Pega el error, el fragmento, el `AGENTS.md`. El proyecto entero ya está en el repo, y mandarlo cuesta contexto que no se recupera.
5. **Da el criterio de aceptación.** «Pasa el test del componente y `php -l`» convierte la entrega en algo verificable sin que tengas que revisar línea por línea.
6. **Deja que pregunte lo que no sabe, y solo eso.** Si falta un dato que no se puede inferir del código, que pregunte; si se puede inferir, que lo asuma y lo diga en una línea. Preguntar por lo deducible es la fricción más cara que existe, y el arnés la elimina con los flujos S y M.

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

Cuando toques `AGENTS.md`, skills, agentes, comandos o plugins del repo, estas son las preguntas:

- **¿Es un índice o una enciclopedia?** Un fichero de reglas debe decir *cómo verificar*, *qué convenciones hay*, *qué no se toca* y *dónde está el detalle*. Si necesita 300 líneas, el detalle se va a una skill y queda el enlace.
- **¿Cuánto cuesta en cada sesión?** Todo lo que se carga al abrir sesión se paga siempre. Si una skill puede ser manual o activarse por ruta, ese es el formato por defecto.
- **¿El hook es silencioso cuando no aplica?** Un hook que imprime en cada llamada es ruido puro: passthrough.
- **¿La regla previene un error caro, o el modelo ya lo dedujo?** Lo segundo sobra. Lo primero vale por sí solo, aunque ocupe tres líneas.
- **¿Hay una alternativa obvia que no sea?** Documentar por qué se descartó algo (`docs/DECISIONS.md`) vale más que defender la elección.

Y una regla del arnés que también es de prompting: **el error más caro no es una mala respuesta, es una respuesta correcta a una pregunta mal hecha**. Por eso el triaje S/M/L es la primera instrucción: clasificar la tarea evita que una tarea de diez minutos arranque con un plan de arquitectura.
