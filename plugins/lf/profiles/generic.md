---
name: generic
description: Perfil base para cualquier equipo de tecnología; sin stack ni flujo de deploy propios.
---

# Perfil generic

Punto de partida para equipos sin perfil propio. Cópialo a `profiles/<equipo>.md` y concrétalo por PR.

## Stack

- Lo indica el `CLAUDE.md` de cada proyecto.

## Ramas

- Rama principal protegida; el trabajo va en ramas y entra por revisión.

## Deploy

- Lo indica el proyecto (pipeline o script). El arnés no despliega.

## Gates

Bloquean (el cambio no se entrega sin ellos):
- Tests del proyecto en verde.
- Sin secretos ni credenciales en el diff.

Avisan:
- Lógica nueva sin test.

```yaml gates
gates:
  code: []
  test: []
  ignore: []
  commands: {}
```
