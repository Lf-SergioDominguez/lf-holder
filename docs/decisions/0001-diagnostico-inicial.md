# 0001 — Diagnóstico inicial

Fecha: 2026-09-15

Medición sobre los transcripts locales de un desarrollador (agosto–septiembre 2026, mayoritariamente Sonnet 5):

| Métrica                                                        | Valor                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Volumen que son lecturas de caché (contexto releído por turno) | 97 %                                                                        |
| Contexto medio por turno (cache_read / turno)                  | ~263K tokens                                                                |
| Turnos por sesión                                              | ~124                                                                        |
| Overhead fijo del system prompt                                | ~7–8K tokens (72 skills + 71 agentes de GSD, agente SEO, instrucciones git) |

Conclusión: el gasto no lo dominan las salidas de Bash sino **el tamaño del contexto por turno y el número de turnos por tarea**. Por eso el arnés ataca primero la política de trabajo (S/M/L, sesiones cortas, un subagente barato para lo verboso) y la superficie siempre activa, y solo después la compresión de salidas.
