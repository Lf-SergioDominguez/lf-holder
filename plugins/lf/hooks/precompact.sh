#!/usr/bin/env bash
# precompact.sh — hook PreCompact del plugin lf.
# El stdout se añade a las instrucciones del resumen. No evita la compactación (la política es /lf:handoff + /clear):
# hace recuperable lo que el resumen por defecto pierde primero.
cat <<'TXT'
Conserva en el resumen, aunque no sea obvio:
1. Tarea en curso y punto exacto.
2. Decisiones tomadas y por qué, incluidas las alternativas descartadas (un enfoque que ya falló es lo primero que se pierde).
3. Ficheros modificados, con ruta y qué cambió en cada uno.
4. Bloqueos: qué espera a una persona o a un tercero.
5. Próximo paso concreto, con fichero:línea y cómo se comprueba.
Si existen handoff.md o to-do.md en el proyecto, mandan sobre este resumen. Formato: máximo 30 líneas, sin relato ni lo que se deduce leyendo el código.
TXT
exit 0
