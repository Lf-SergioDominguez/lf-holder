# Decisiones de diseño

Un fichero por decisión (ADR). Para añadir una, crea `NNNN-slug.md` con el siguiente número y esta plantilla, y enlázala aquí:

```text
# NNNN — <título>

Fecha: AAAA-MM-DD
Decisión: …
Motivo: …
Alternativa descartada: …
```

| ADR | Fecha | Decisión |
| --- | --- | --- |
| [0001](0001-diagnostico-inicial.md) | 2026-09-15 | Diagnóstico inicial |
| [0002](0002-decisiones-fundacionales.md) | 2026-09-15 | Decisiones fundacionales |
| [0003](0003-sandbox-en-wsl2-requiere-enableweakernestedsandbox.md) | 2026-09-18 | Sandbox en WSL2 requiere `enableWeakerNestedSandbox` |
| [0004](0004-blockreadsoutsideworkingdirectories-rompe-el-stack-dentro-del-sandbox.md) | 2026-09-18 | `blockReadsOutsideWorkingDirectories` rompe el stack |
| [0005](0005-caches-escribibles-dentro-del-sandbox.md) | 2026-09-18 | Cachés escribibles dentro del sandbox |
| [0006](0006-sonnet-5-siempre-corre-con-1m-hay.md) | 2026-09-18 | Sonnet 5 con 1M: fijar `autoCompactWindow` |
| [0007](0007-modelo-contexto-y-prompting-de-la-v0.md) | 2026-09-29 | Modelo, contexto y prompting (v0.2.0) |
| [0008](0008-rtk-opcional.md) | 2026-10-08 | RTK opcional (v0.3.0) |
| [0009](0009-instalador-dentro-del-plugin.md) | 2026-10-13 | Instalador dentro del plugin (v0.4.0) |
| [0010](0010-guardia-de-lectura-por-hook-y-caveman.md) | 2026-10-13 | Guardia de lectura por hook y caveman opt-in (v0.5.0) |
| [0011](0011-windows-nativo-como-modo-sin-sandbox.md) | 2026-10-13 | Windows nativo como modo sin sandbox (v0.5.2) |
| [0012](0012-ponytail-destilado-graphify-descartado.md) | 2026-10-15 | Ponytail destilado, Graphify descartado (v0.6.0) |
| [0013](0013-haiku-5-5.md) | 2026-10-26 | Haiku 5.5 |
| [0014](0014-gsd-una-orden-por-sesion-y-planner.md) | 2026-11-05 | GSD: una orden por sesión y planner en Sonnet |
| [0015](0015-modern-web-guidance-de-google-como-plugin.md) | 2026-11-17 | Modern Web Guidance de Google como plugin por defecto |
| [0016](0016-retirada-de-rtk.md) | 2026-11-17 | Retirada de RTK |
| [0017](0017-bash-gate-y-permisos-por-capas.md) | 2026-11-17 | `bash-gate` y permisos por capas |
| [0018](0018-memoria-y-dreaming-manual.md) | 2026-11-17 | Memoria y «dreaming» manual |
| [0019](0019-novedades-de-plugins-evals-si-mods-aplazados.md) | 2026-11-17 | Novedades de plugins: evals sí, mods aplazados |
| [0020](0020-house-style-de-serie-y-comando.md) | 2026-11-17 | House style corporativo de serie y `/lf:house-style` |

Las decisiones de 0001–0015 conservan el texto original; las cifras de coste son de la fecha indicada.
