---
description: Bucle de automejora del arnés (solo mantenedor): cruza evals y telemetría por versión y propone 1–3 cambios con hipótesis y métrica.
argument-hint: "[--project NOMBRE] [--metrics DIR]"
disable-model-invocation: true
---

Bucle de automejora del arnés (pauta 5, ADR 0027). Argumentos: `$ARGUMENTS`

Solo propone: no edites el plugin, no lances evals ni hagas `git pull`.

## 0. Guard

Si en el directorio actual no existen `scripts/evals.sh` y `scripts/improve.mjs`, no ejecutes nada: di «solo para el mantenedor, en el repo del arnés» y para. Todo va dentro del sandbox.

## 1. Datos

`node scripts/improve.mjs $ARGUMENTS` (Node 22+). Solo admite `--summary`, `--metrics`, `--project` y `--json`; con otro argumento sale con código 1: muestra el error y para. Sale 0 aunque no haya datos o haya regresiones: es un informe, no un gate. Guarda el stdout, sin resumirlo ni añadir rutas.

## 2. Propuestas

A partir de los datos, y solo de ellos, 1–3 propuestas ordenadas por impacto: regresiones primero, luego casos sin señal. Cada una:

```
### Pn — título
Hipótesis: qué creemos que falla y por qué.
Cambio: fichero concreto del plugin y qué se toca.
Métrica: el dato del informe y el umbral (score −0,10, coste o telemetría +30 %, autocompact +5 pp).
Cómo medir: `bash scripts/evals.sh --baseline …` o el próximo informe de telemetría.
```

Con casos sin señal (Δ < 0,05), una propuesta es endurecerlos. Sin regresiones ni casos sin señal, o con una sola versión, escribe «sin propuestas con estos datos» en vez de inventar una.

## 3. Informe

Escribe `docs/improve/AAAA-MM-DD.md` (fecha de hoy; si existe, sufijo `-2`):

```
# Automejora <fecha> · plugin <versión>

## Datos
<stdout del script tal cual>

## Propuestas
<propuestas>
```

Dile al usuario la ruta y las propuestas en una línea cada una. No hagas commit. Aplicar una propuesta y medirla es un hito M aparte; el ADR de cada una se escribe al medir.
