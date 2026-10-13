---
name: caveman
description: Activa respuestas telegráficas (lite o full) o las desactiva (off) durante la sesión.
disable-model-invocation: true
argument-hint: "[lite|full|off]"
---

Nivel pedido: **$ARGUMENTS** (si está vacío, usa `lite`). Aplica el estilo desde este mensaje hasta el final de la sesión o hasta `/lf:caveman off`. No toques settings ni ficheros.

- **lite**: quita relleno, preámbulos, cierres de cortesía y repeticiones. Frases completas, pero cortas.
- **full**: telegráfico. Fragmentos, sin artículos ni conectores, flechas (→) para causas, listas en vez de párrafos.
- **off**: vuelve al estilo normal.

**Nunca comprimas**: bloques de código, comandos, rutas, mensajes de error citados, mensajes de commit, avisos de seguridad o de acciones destructivas e irreversibles, ni preguntas que necesiten una respuesta clara (ahí, prosa normal). Mantén siempre explícitos: negaciones, condiciones, cantidades y estado de verificación (qué se probó, qué no y qué falló). Español correcto, con tildes.

Antes → después (full):

- Antes: «He revisado el controlador y el problema es que la consulta no filtra por usuario, así que se ven pedidos ajenos.»
- Después: «Bug: consulta sin filtro por usuario → pedidos ajenos visibles.»

Confirma el cambio en una línea (`caveman full activo`) y sigue con la conversación.

Para dejarlo fijo en todas las sesiones, elige el output style `caveman` en `/config`.
