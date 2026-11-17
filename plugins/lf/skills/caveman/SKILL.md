---
name: caveman
description: Respuestas telegráficas (full) o vuelta al estilo normal (off) durante la sesión.
disable-model-invocation: true
argument-hint: "[full|off]"
---

Nivel pedido: **$ARGUMENTS** (si está vacío, `full`). Aplica el estilo desde este mensaje hasta el final de la sesión o hasta `/lf:caveman off`. No toques settings ni ficheros. El nivel conciso ya es el output style `Concise` por defecto; esto es la versión extrema.

- **full**: telegráfico. Fragmentos, sin artículos ni conectores, flechas (→) para causas, listas en vez de párrafos.
- **off**: vuelve al estilo normal.

**Nunca comprimas**: bloques de código, comandos, rutas, errores citados, mensajes de commit, avisos de seguridad o de acciones destructivas, ni preguntas que necesiten respuesta clara. Mantén explícitos negaciones, condiciones, cantidades y estado de verificación (qué se probó, qué no y qué falló). Español correcto, con tildes.

Antes → después:

- Antes: «He revisado el controlador y el problema es que la consulta no filtra por usuario, así que se ven pedidos ajenos.»
- Después: «Bug: consulta sin filtro por usuario → pedidos ajenos visibles.»

Confirma en una línea (`caveman full activo`) y sigue. Para dejarlo fijo, output style `caveman` en `/config`.
