---
name: performance-optimization
description: Úsala cuando existan requisitos de rendimiento, sospeches una regresión o detectes patrones N+1, para medir y optimizar con datos, no suposiciones.
---

# Performance Optimization

Measure before optimizing. Performance work without measurement is guessing. Profile first, identify the actual bottleneck, fix it, measure again. Optimize only what measurements prove matters.

**When NOT to use:** don't optimize before you have evidence of a problem.

## Core Web Vitals Targets

LCP ≤2.5s good / ≤4.0s needs improvement / >4.0s poor. INP ≤200ms / ≤500ms / >500ms. CLS ≤0.1 / ≤0.25 / >0.25.

## The Optimization Workflow

MEASURE (baseline with real data) → IDENTIFY (actual bottleneck) → FIX → VERIFY (re-measure, keep or revert) → GUARD (monitoring/tests against regression).

**Measure with both:** synthetic (Lighthouse/DevTools, reproducible, good for CI) and RUM (`web-vitals` library, CrUX — required to confirm real users improved). Backend: response-time logging, APM, query timing.

**Where to start:** first-load slow → check bundle size / TTFB waterfall (DNS, TCP/TLS, server wait) / render-blocking resources. Interaction sluggish → profile main thread for long tasks (>50ms), re-renders, layout thrashing. Post-navigation slow → API waterfalls or component render/N+1 fetches. Backend slow → single endpoint (query/index), all endpoints (pool/memory/CPU), intermittent (locks/GC).

## Common Anti-Patterns and Fixes

**N+1 queries:** replace a per-row query in a loop with a single query using `include`/join/eager-load.

**Unbounded fetching:** always paginate (`take`/`skip` or `LIMIT`/`OFFSET`, `orderBy`).

**Queries ignoring their index:** run `EXPLAIN ANALYZE` — don't guess. `Seq Scan` on a large table = no usable index; estimated vs actual rows off by an order of magnitude = stale stats; a `Sort` node above the scan = index covers the filter but not the `ORDER BY`. Index for the query shape: equality columns first, then the range/sort column in a composite index. An index won't help when: selectivity is low (querying the 95%-dominant value), there's a leading wildcard `LIKE '%x'` (needs trigram/full-text), a function wraps the column (index the expression instead), or the table is write-heavy (every index taxes every write). Re-run `EXPLAIN ANALYZE` after — an unchanged plan means revert.

**Connection pool exhaustion:** signature is every endpoint slowing at once, time spent waiting not executing, DB mostly idle. Fix: one pool per process sized against the DB's connection ceiling, `connectionTimeoutMillis` to fail fast. A pool larger than the DB can serve just relocates the queue; under serverless/autoscaling use a multiplexing proxy (pgbouncer, RDS Proxy), not a higher `max`.

**Images:** always set width/height, use `<picture>`/`srcset` for responsive art direction on LCP images with `fetchpriority="high"`, and `loading="lazy" decoding="async"` below the fold.

**Unnecessary re-renders (React/Vue):** hoist stable object/array literals out of render; memoize expensive components and computations; don't over-apply `memo`/`useMemo` everywhere either.

**Bundle size:** modern bundlers tree-shake ESM automatically when `sideEffects: false` — the real gains come from dynamic `import()` for heavy/rare features and route-level code splitting with `Suspense`.

**Caching:** cache what's expensive to produce and read far more than it changes — caching an already-fast query adds a network hop, staleness, and eviction cost for nothing. Pick the layer deliberately: in-process (one instance, per-instance staleness OK), shared/Redis (instances must agree), CDN/edge (public, identical per URL, hard to invalidate). The cache key must include every input the response depends on (tenant, locale, permissions) — omitting one leaks one user's data to another. Pick one invalidation strategy: TTL (simplest, state the staleness window), event/tag-based (fresh on write, more coupling), versioned keys (never invalidate, costs memory). Guard against stampede: stale-while-revalidate or coalesce concurrent misses behind one in-flight promise. Never cache correctness-critical data (balances, permissions, checkout inventory) or per-user data under a non-user-scoped key.

## Verify: Keep or Revert

Re-measure the same way as the baseline (same command/conditions/fixed budget). Change one thing at a time — bundled optimizations can't be attributed. Beat the noise: compare the delta against run-to-run variance, not just the mean.

| Result vs. baseline                    | Action                                      |
| -------------------------------------- | ------------------------------------------- |
| Past threshold, tests green            | **Keep** — commit with before/after numbers |
| Within noise / worse / a test went red | **Revert**                                  |

"Neutral" is a revert, not a keep — code you keep, you maintain forever. Correctness gates the metric: a win from skipping needed validation or caching something that must be fresh is a regression. Log every attempt, kept or reverted, in the PR description or a `PERF.md` so a dead idea isn't re-tried.

## Guard Against Regression

Guard the metric that justified the fix (LCP, INP, p95, etc.), not every number. Synthetic CI gate with a performance budget (compare median/trend, not a single noisy run) plus field monitoring on RUM p75. Typical budgets: JS <200KB gz initial, CSS <50KB, images <200KB above fold, API p95 <200ms, Lighthouse ≥90. When a guard fires, return to Step 1 with a fresh baseline.

## Common Rationalizations

| Rationalization                            | Reality                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| "It's fast on my machine"                  | Profile on representative hardware/network.                                               |
| "The query is slow, add an index"          | Read the plan first — it may already exist and be unusable, and every index taxes writes. |
| "Just cache it"                            | Caching an already-cheap call buys nothing and adds a staleness bug.                      |
| "It didn't help much, but it doesn't hurt" | Neutral changes are a revert — you maintain them forever for nothing.                     |

## Red Flags

- Optimization without profiling data to justify it
- N+1 query patterns; an index added without a before/after query plan
- A cache key omitting an input the response depends on; no stated staleness window
- Pool size raised in response to exhaustion without finding what holds connections
- List endpoints without pagination; images without dimensions/lazy-loading
- Optimizations kept without a re-measurement; several bundled into one measurement
- A "win" that required a test to be changed, skipped, or deleted

## Verification

- [ ] Before/after measurements exist and were taken the same way
- [ ] Improvement exceeds run-to-run variance; non-wins were reverted, not kept
- [ ] Attempts (kept and reverted) are logged
- [ ] Core Web Vitals within "Good"; bundle size hasn't grown unreviewed
- [ ] No N+1 in new data-fetching code; any new index justified by a query plan
- [ ] Any new cache states what it keys on and how it goes stale
- [ ] A synthetic budget or field monitor can detect regression on the measured metric
- [ ] Existing tests still pass

## Notas para nuestro stack

- Detecta N+1 en Doctrine con el profiler de Symfony (panel de Doctrine) y corrige con `JOIN FETCH`/`addSelect`; en WordPress revisa `WP_Query` con `posts_per_page`, `fields`, y evita `get_post_meta` en bucles sin `update_post_meta_cache`.
- Usa `EXPLAIN`/`EXPLAIN ANALYZE` en MySQL antes de añadir un índice; recuerda que MySQL usa el mismo criterio de columnas de igualdad primero y rango/orden después en índices compuestos.
- Perfila backend con el Symfony Profiler/Blackfire y cachea con `symfony/cache` (Redis/APCu) solo lo que sea costoso y se lea mucho más de lo que cambia.
- En Astro, usa `client:visible`/`client:idle` en vez de `client:load` para islas no críticas, y `astro check` para detectar problemas antes del build.
- En Vue/React, evita renders innecesarios con memoización selectiva; mide con Lighthouse/DevTools antes de aplicar `memo`/`useMemo` "por si acaso".
- Pagina siempre listados: `KnpPaginatorBundle`/`Paginator` de Doctrine en Symfony, `paged`/`posts_per_page` en WP, `LIMIT`/`OFFSET` con índice adecuado en MySQL.
- Cachea fragmentos de WordPress con transients o un object cache (Redis) en vez de recalcular queries pesadas en cada request.
- Revisa el pool de conexiones de MySQL (`max_connections`, PDO/Doctrine pool) cuando escales instancias PHP-FPM, evitando agotarlo en picos de tráfico.

Adaptado de addyosmani/agent-skills (MIT).
