---
name: incremental-implementation
description: Úsala al implementar cambios multi-archivo o al retomar una tarea de un plan, para avanzar en incrementos pequeños y verificables.
---

# Incremental Implementation

Build in thin vertical slices — implement one piece, test it, verify it, then expand. Each increment should leave the system in a working, testable state.

**When NOT to use:** single-file, single-function changes where the scope is already minimal.

## The Increment Cycle

For each slice: **Implement** the smallest complete piece → **Test** (run suite or write one) → **Verify** (tests pass, build succeeds, manual check) → **Commit** with a descriptive message → move to the next slice, carrying forward.

## Slicing Strategies

- **Vertical (preferred):** one complete path through the stack per slice (e.g., create → list → edit → delete a task), each delivering working end-to-end functionality.
- **Contract-first:** define the API contract (types/OpenAPI) first, then backend and frontend (against mock data) develop in parallel, then integrate.
- **Risk-first:** tackle the riskiest/most uncertain piece first so failure is discovered before investing in the rest.

## Implementation Rules

**Rule 0: Simplicity First.** Ask "what's the simplest thing that could work?" Avoid generic frameworks/abstract factories/config-driven builders for one or a few use cases — three similar lines beat a premature abstraction. Implement the naive, obviously-correct version first; optimize only after correctness is proven with tests.

**Rule 0.5: Scope Discipline.** Touch only what the task requires. Don't "clean up" adjacent code, refactor unrelated imports, remove comments you don't fully understand, or add unspecified features. Note out-of-scope improvements instead of fixing them, and ask before acting on them.

**Rule 1: One Thing at a Time.** Each increment/commit changes one logical thing — don't mix a new feature, a refactor, and a config update in one commit.

**Rule 2: Keep It Compilable.** After each increment, the project must build and existing tests must pass.

**Rule 3: Feature Flags for Incomplete Features.** Gate work-in-progress behind an env-driven flag so increments can merge without exposing incomplete work.

**Rule 4: Safe Defaults.** New code defaults to safe, conservative, opt-in behavior.

**Rule 5: Rollback-Friendly.** Prefer additive changes; keep modifications to existing code minimal and focused; pair DB migrations with rollback migrations; don't delete-and-replace in the same commit.

## Working with Agents

Be explicit about what's in scope and out of scope for each increment: e.g., "implement just the DB schema and API endpoint, don't touch the UI yet — run tests and build to verify nothing broke."

## Increment Checklist

- [ ] The change does one thing and does it completely
- [ ] All existing tests still pass
- [ ] The build succeeds; type checking passes where applicable
- [ ] Linting passes
- [ ] The new functionality works as expected
- [ ] The change is committed with a descriptive message

Run each verification command after a change that could affect it — don't re-run an unchanged check for reassurance.

## Common Rationalizations

| Rationalization                                    | Reality                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| "I'll test it all at the end"                      | Bugs compound — a bug in slice 1 makes slices 2-5 wrong.              |
| "It's faster to do it all at once"                 | Feels faster until something breaks in 500 changed lines.             |
| "These changes are too small to commit separately" | Small commits are free; large ones hide bugs.                         |
| "This refactor is small enough to include"         | Mixed refactor+feature is harder to review and debug — separate them. |

## Red Flags

- More than ~100 lines written without running tests
- Multiple unrelated changes in a single increment
- "Let me just quickly add this too" scope expansion
- Build or tests broken between increments
- Building abstractions before the third use case demands it
- Touching files outside task scope "while I'm here"
- Running the same build/test command twice with no intervening code change

## Verification

- [ ] Each increment was individually tested and committed
- [ ] The full test suite passes and the build is clean
- [ ] The feature works end-to-end as specified
- [ ] No uncommitted changes remain

Per-increment verification is local; apply the project's Definition of Done as the final gate before declaring a task done.

## Notas para nuestro stack

- Cada slice de Symfony: entidad/migración Doctrine → servicio → controlador → test, verificado con `vendor/bin/phpunit --filter` antes de pasar al siguiente.
- En WordPress, separa slices por hook/CPT/shortcode; no mezcles un cambio de `functions.php` con un refactor del tema en el mismo commit.
- Frontend Vue/React/Astro: implementa el componente con datos mock, luego conéctalo a la API real como segundo incremento (contract-first con el DTO/OpenAPI del backend).
- Usa flags de entorno (`.env`, `APP_FEATURE_X`) o feature flags de WordPress (opción en `wp_options`) para ocultar trabajo incompleto en producción.
- Migraciones Doctrine (`doctrine:migrations:diff`) deben incluir siempre su `down()`; no las mezcles con cambios de datos manuales.
- Verifica cada incremento con `vendor/bin/phpstan analyse`, `vue-tsc --noEmit` o `astro check` según el área tocada, no solo al final.
- No "aproveches" un ticket de backend para tocar estilos del theme de WordPress ni componentes Vue no relacionados.
- Commits atómicos por capa: migración, servicio, endpoint y UI como commits separados cuando sea razonable revisar cada uno por separado.

Adaptado de addyosmani/agent-skills (MIT).
