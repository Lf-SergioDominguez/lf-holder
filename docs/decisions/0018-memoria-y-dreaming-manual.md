# 0018 — Memoria y «dreaming» manual

Fecha: 2026-11-17 (implementación en el hito 3)

Contexto: más allá de `/lf:handoff` manual no había carga del handoff al abrir sesión, consolidación entre sesiones ni memoria de usuario.

Decisión: la consolidación es **manual** (`/lf:dream`) con aviso en SessionStart cuando hay algo que consolidar, no automática. El handoff y las notas siguen las reglas de `MEMORIA.md`: predictivos, un hecho por nota, sobrescribir, fechas absolutas.
Motivo: una consolidación automática gasta tokens sin que nadie la pida y puede fijar como «hecho» algo que el usuario descartó; el aviso cuesta una línea.
Alternativa descartada: tarea programada o hook Stop que consolide cada sesión (multiplica peticiones; mismo defecto que se vio en Smith, ADR 0002).
