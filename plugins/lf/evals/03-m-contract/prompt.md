---
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
runs: 3
---

/lf:m añadir a un proyecto Symfony un módulo de «solicitudes de demo»: entidad `DemoRequest` (nombre, email, empresa, estado), migración, endpoint POST `/api/demo-requests` con DTO + Validator, un servicio que la persista y un componente Vue `DemoRequestForm` con sus props y emits.

Entorno de prueba sin repositorio: entrega solo el contrato y el cierre, no implementes.
