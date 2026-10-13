---
name: prompting
description: Cómo escribir peticiones efectivas al modelo y cómo revisar las instrucciones de este arnés. Úsala al pedir trabajo al arnés, al redactar un handoff, o al detectar que una sesión se desvía.
---

Asunto: **la tarea o el contexto a revisar**

## Las seis reglas que más cambian el resultado

1. **Nombra ficheros y funciones, no intenciones.** La petición que funciona dice *qué* y *dónde*: «el contador de `templates/product/_form.html.twig`, el que ya está en el `maxlength`». La que no produce nada verificable dice «mejora mi código».
2. **Da el resultado esperado, no los pasos.** «Que no supere el `maxlength`» deja libertad para elegir la implementación; «añade un listener al evento input» la quita y suele ser peor.
3. **Una tarea por petición.** Meter refactor + bug + migración en un prompt produce Context Rot: el modelo entrelaza objetivos y entrega peor que en dos peticiones separadas. Si son dos tareas, son dos sesiones.
4. **Contexto mínimo y relevante.** Pega el error, el fragmento, el `AGENTS.md`. El proyecto entero ya está en el repo, y mandarlo cuesta contexto que no se recupera.
5. **Da el criterio de aceptación.** «Pasa el test del componente y `php -l`» convierte la entrega en algo verificable sin que tengas que revisar línea por línea.
6. **Deja que pregunte lo que no sabe, y solo eso.** Si falta un dato que no se puede inferir del código, que pregunte; si se puede inferir, que lo asuma y lo diga en una línea. Preguntar por lo deducible es la fricción más cara que existe.

## Errores que se ven en sesiones reales

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| Cambia de enfoque a mitad de tarea | Petición con varios objetivos | Divídela en S/M, una por sesión |
| Pregunta algo que está en el repo | No conoce el layout | Nombra la ruta en la petición |
| Verifica con la suite entera | No le diste el comando | Da el comando barato de verificación |
| Reimplementa algo que ya existe | No conoce el mapa del proyecto | Apúntale a la skill de stack |
| Alarga el cambio sin pedirlo | «Mejora X» sin límites | Delimita el alcance explícitamente |
| Se atasca en un fallo | Falta la salida real | Pega el error, no la descripción del error |
| Rompe algo que ya funcionaba | Refactor ambiguo | «No toques X» en la petición |

## Al revisar las instrucciones de este arnés

- Un `AGENTS.md` es un **índice**: cómo verificar, qué convenciones hay, qué no se toca y dónde está el detalle. Si necesita 300 líneas, el detalle va a una skill y queda el enlace.
- Todo lo que se carga al abrir sesión se paga en **cada** sesión. Lo que pueda ser manual o activarse por ruta, ese es el formato por defecto.
- Un hook que imprime cuando no aplica es un hook que hay que arreglar: passthrough.
- Una regla que el modelo ya deduce leyendo el código sobra. Una que previene un error caro vale por sí sola.
- **En OpenCode no existe compactación por comando**: `/new` es la herramienta. Si aun así se compacta, el plugin `lf.ts` inyecta en el resumen lo que no quieres perder.

## Fuentes

- [Documentación de OpenCode](https://opencode.ai/docs) — agentes, comandos, plugins, permisos y skills.
- [Modelos de OpenCode](https://opencode.ai/docs/models) — catálogo y cómo se eligen por tarea.
- Catálogo de modelos de referencia: <https://models.dev>.
