---
name: api-and-interface-design
description: Úsala al diseñar endpoints REST/GraphQL, contratos entre módulos o límites entre frontend y backend, para lograr interfaces estables.
---

# API and Interface Design

Design stable, well-documented interfaces that are hard to misuse. Good interfaces make the right thing easy and the wrong thing hard. Applies to REST/GraphQL, module boundaries, component props, and any surface where code talks to code.

## Core Principles

**Hyrum's Law:** with enough users, every observable behavior — including undocumented quirks, error text, timing, ordering — becomes a de facto contract. Be intentional about what you expose; don't leak implementation details; plan for deprecation at design time.

**The One-Version Rule:** avoid forcing consumers to choose between versions of the same dependency/API. Design for one version at a time — extend rather than fork.

**1. Contract First** — define the interface (types/schema) before implementing it.

**2. Consistent Error Semantics** — pick one strategy everywhere. REST: HTTP status + structured body `{ error: { code, message, details? } }`. Map 400 bad data, 401 unauthenticated, 403 unauthorized, 404 not found, 409 conflict, 422 validation, 500 server (never expose internals). Don't mix patterns (throws vs null vs `{error}`) across endpoints.

**3. Validate at Boundaries** — trust internal code; validate at API routes, form handlers, third-party responses (always untrusted), and env/config loading. Don't re-validate between internal functions sharing type contracts, or data already from your own DB.

**4. Prefer Addition Over Modification** — add optional fields; never change existing field types or remove fields (breaks consumers).

**5. Predictable Naming** — plural nouns for REST endpoints (`/api/tasks`, no verbs), camelCase params/fields, `is/has/can` boolean prefixes, `UPPER_SNAKE` enum values.

**6. Honouring an Idempotency Key** — accepting the header is the contract; honouring it is the implementation.

- Derive the key from intent, not the attempt: client-generated `Idempotency-Key` header or `charge:v1:${orderId}` — never `crypto.randomUUID()` or a timestamp per attempt.
- Claim atomically via a unique-constraint insert, not a check-then-act (TOCTOU race).
- Guard the payload: same key + different body must fail loudly (422), not replay the first response.
- Decide the in-flight-duplicate response deliberately: reject (409), wait (bounded), or return pending (202 + status URL) — never let a second caller through because the first "seems stuck."
- Every call has three outcomes — success, failure, unknown (timeout). Record intent before calling out so a crash leaves evidence to resolve later.
- Set key retention from the longest retry chain (including DLQ replay and dispute windows), not from disk cost.

## REST API Patterns

```
GET/POST   /api/tasks              list / create
GET/PATCH/DELETE /api/tasks/:id    read / partial update / idempotent delete
GET/POST   /api/tasks/:id/comments sub-resource
```

Paginate list endpoints (`page`, `pageSize`, response includes `pagination.totalItems/totalPages`). Filter via query params. PATCH accepts partial objects — only provided fields change.

## TypeScript Interface Patterns

- **Discriminated unions** for variants (e.g., a `TaskStatus` union with a `type` tag) so consumers get type narrowing in a `switch`.
- **Input/Output separation**: `CreateTaskInput` (caller-provided) vs `Task` (includes server-generated fields like `id`, `createdAt`).
- **Branded types for IDs** (`type TaskId = string & { readonly __brand: 'TaskId' }`) to prevent passing the wrong ID type.

## Common Rationalizations

| Rationalization                                  | Reality                                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| "We'll document the API later"                   | The types ARE the documentation — define them first.                                         |
| "We don't need pagination for now"               | You will the moment someone has 100+ items.                                                  |
| "Nobody uses that undocumented behavior"         | Hyrum's Law: if it's observable, somebody depends on it.                                     |
| "Accepting the Idempotency-Key header is enough" | The header is the contract; storing the key against the result is the implementation.        |
| "Our queue guarantees exactly-once"              | No queue does across a consumer crash — design for at-least-once with idempotent processing. |

## Red Flags

- Endpoints returning different shapes depending on conditions; inconsistent error formats
- Validation scattered through internal code instead of at boundaries
- Breaking changes to existing fields; list endpoints without pagination
- Verbs in REST URLs; third-party responses used without validation
- A `SELECT` then `INSERT` for an idempotency key (race, not a guard)
- A key derived from a UUID/timestamp regenerated per attempt
- Same key accepted with a different body, silently replaying the first response
- Key retention shorter than the longest re-delivery path

## Verification

- [ ] Every endpoint has typed input/output schemas
- [ ] Error responses follow one consistent format
- [ ] Validation happens only at system boundaries
- [ ] List endpoints support pagination; new fields are additive/optional
- [ ] Naming consistent across all endpoints; docs/types committed with implementation
- [ ] State-changing endpoints honour an idempotency key or are documented unsafe to retry
- [ ] Key claimed atomically via unique constraint; reused key with different payload fails loudly
- [ ] In-flight-duplicate response is deliberate; key retention outlives the longest retry path

## Notas para nuestro stack

- Define el contrato con DTOs y atributos de Symfony (`#[MapRequestPayload]`, Validator) y documenta con NelmioApiDoc/OpenAPI antes de implementar el controlador.
- Usa `ConstraintViolationList` de Symfony Validator para errores 422 estructurados; en endpoints WP REST, usa `WP_Error` con `status` consistente.
- Protege endpoints WP con `permission_callback` explícito (nunca `__return_true` en producción) y capacidades (`current_user_can`).
- Para paginación, usa `Paginator` de Doctrine o `paginate` de KnpPaginatorBundle; en `WP_Query` usa `posts_per_page`/`paged`, nunca listados sin límite.
- Claves de idempotencia en pagos/pedidos: persiste en una tabla Doctrine con constraint único (`UNIQUE(idempotency_key)`), no un `findOneBy` seguido de `insert`.
- Tipa entradas/salidas en Vue/React con TypeScript e interfaces `Input`/`Output` separadas; evita `any` en el cliente API generado desde el OpenAPI del backend.
- Mantén el versionado de API vía rutas (`/api/v1/...`) o cabecera, nunca rompiendo campos existentes sin ciclo de deprecación.
- En Astro, valida las respuestas de la API interna/externa con un schema (Zod) antes de usarlas en el render de la isla.

Adaptado de addyosmani/agent-skills (MIT).
