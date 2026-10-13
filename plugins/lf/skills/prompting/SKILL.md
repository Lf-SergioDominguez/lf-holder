---
name: prompting
description: Cómo escribir peticiones efectivas a Claude y cómo revisar las instrucciones de este arnés. Úsalo al pedir trabajo al arnés, al redactar un handoff, o al detectar que una sesión se desvía.
disable-model-invocation: true
argument-hint: "[petición o contexto a revisar]"
---

Asunto: **$ARGUMENTS**

## Las seis reglas que más cambian el resultado

1. **Nombra ficheros y funciones, no intenciones.** «Sube el límite del textarea de descripción a 3000» funciona; «mejora mi código» no produce nada verificable.
2. **Da el resultado esperado, no los pasos.** «Que el contador no supere el maxlength» es mejor que «añade un listener al evento input».
3. **Una tarea por petición.** Encadenar refactor + bug + migración en un prompt produce Context Rot: el modelo mezcla objetivos y entrega peor que en dos peticiones separadas.
4. **Contexto mínimo y relevante.** Pega el error, el fragmento, el `AGENTS.md`. No el proyecto entero: el código ya está en el repo.
5. **Da el criterio de aceptación.** «Pasa el test del componente y `php -l`» convierte la entrega en verificable.
6. **Deja que pregunte lo que no sabe.** Si falta un dato que no se puede inferir, que pregunte; si se puede inferir del código, que lo asuma y lo diga. Preguntar por lo deducible es la fricción más cara que existe.

## Errores de prompting que verás en sesiones reales

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| Cambia de enfoque a mitad de tarea | Petición con varios objetivos | Divide en peticiones S/M |
| Pregunta algo que está en el repo | No conoce el layout | Nombra la ruta en la petición |
| Verifica con la suite entera | No le diste el comando | Da el comando barato de verificación |
| Reimplementa algo que ya existe | No conoce el mapa del proyecto | Apunta a la skill de stack |
| Alarga el cambio sin pedirlo | «Mejora X» sin límites | Delimita el alcance en la petición |
| Se atasca en un fallo | Falta el error completo | Pega la salida, no la descripción del error |

## Al revisar las instrucciones de este arnés

- Un `CLAUDE.md`/`AGENTS.md` es un **índice**: cómo ejecutar tests, lint y build; convenciones; directorios que no se tocan; errores que no se cometen; y enlaces al detalle. El detalle va en skills, plantillas o docs.
- Todo lo que se añade al arranque se paga en **cada** sesión. Si una skill puede ser manual (`disable-model-invocation`) o cargarse por `paths`, ese es el formato por defecto.
- Un hook que imprime cuando no aplica es un hook que hay que arreglar: passthrough silencioso.
- Una regla que el modelo ya deduce leyendo el código sobra. Una regla que previene un error caro vale por sí sola.

## Fuentes

- [Mejores prácticas de prompting](https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- [Prompting Sonnet 5.5](https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5)
- [Prompting Opus 5.5](https://platform.claude.com/docs/es/build-with-claude/prompt-engineering/prompting-claude-opus-5-5)
