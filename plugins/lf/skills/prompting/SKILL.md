---
name: prompting
description: Cómo pedir trabajo al arnés y revisar sus instrucciones; resume ~/.claude/lf/docs/PROMPTING.md.
disable-model-invocation: true
argument-hint: "[petición o contexto a revisar]"
---

Asunto: **$ARGUMENTS**

La fuente única es `~/.claude/lf/docs/PROMPTING.md` (léela antes de responder; no la copies aquí). Aplícala al asunto:

1. Si es una petición: ¿nombra ficheros, resultado esperado y `Hecho cuando:`? ¿Mezcla dos tareas? Devuelve la versión reescrita en ≤8 líneas, con el esfuerzo sugerido (empieza en `medium`).
2. Si son instrucciones del arnés (`CLAUDE.md`, skills, agentes, hooks): pásalas por las preguntas de «Cómo revisar las instrucciones del arnés» y lista solo lo que falla.
3. No des órdenes de razonamiento («piensa a fondo»): si hace falta más, `/effort high` o `ultrathink` en ese turno.
