---
name: code-review-and-quality
description: Úsala antes de fusionar cualquier cambio, para revisar código propio o ajeno en corrección, legibilidad, arquitectura, seguridad y rendimiento.
---

# Code Review and Quality

Multi-dimensional code review with quality gates. Every change gets reviewed before merge. Approve a change when it definitely improves overall code health, even if it isn't perfect — don't block because it isn't exactly how you'd have written it.

## The Five-Axis Review

**1. Correctness** — Matches spec/task? Edge cases (null, empty, boundary) and error paths handled? Tests actually test the right things? Off-by-one, race conditions, state inconsistencies?

**2. Readability & Simplicity** — Descriptive, convention-consistent names. Straightforward control flow. Could this be fewer lines? Do abstractions earn their complexity (don't generalize before the third use case)? Dead code, unused vars, "// removed" comments? A new conditional bolted onto an unrelated flow is a design smell — push it into its own helper/state/policy. Repeated conditionals on the same shape signal a missing model or dispatcher.

**3. Architecture** — Fits existing patterns, or is a new one justified? Duplication that should be shared? Dependencies flow the right direction? Does a refactor reduce complexity or just relocate it — count the concepts a reader must hold. Feature-specific logic leaking into a shared module? Gratuitous `any`/casts/silent fallbacks hiding an unclear invariant?

**4. Security** — Input validated/sanitized? Secrets out of code/logs/VCS? Auth checked? Parameterized queries? Output encoded against XSS? External/third-party data treated as untrusted? (See `security-and-hardening`.)

**5. Performance** — N+1 patterns? Unbounded loops/fetching? Sync work that should be async? Unnecessary re-renders? Missing pagination? Large objects in hot paths? (See `performance-optimization`.)

## Structural Remedies

Propose the move, not just the problem: replace conditional chains with a typed model/dispatcher; collapse duplicate branches; separate orchestration from business logic; move feature logic out of shared modules; reuse canonical helpers; make type boundaries explicit; delete pass-through wrappers; extract helpers or split large files.

## Change Sizing

~100 lines: good. ~300: acceptable if one logical change. ~1000: too large, split it. Watch file size too — a small diff can push a file past ~1000 total lines; decompose before piling on. Splitting strategies: **stack** (sequential deps), **by file group** (cross-cutting), **horizontal** (shared code first), **vertical** (full-stack slices). Separate refactoring from feature work — submit them separately.

## Change Descriptions

First line: short, imperative, standalone ("Delete the FizzBuzz RPC", not "Fix bug"). Body: what and why, with context/decisions not visible in the diff, plus links to issues/benchmarks.

## Review Process

1. **Understand context** — what is this trying to accomplish, against what spec.
2. **Review tests first** — exist? test behavior not implementation? cover edge cases? would they catch a regression?
3. **Review implementation** against the five axes, per file.
4. **Categorize findings** by severity: _(no prefix)_ required, **Critical:** blocks merge, **Nit:** optional, **Optional/Consider:** suggestion, **FYI:** informational. Lead with correctness/security, then structural issues, then nits — don't bury a real issue under cosmetic ones.
5. **Verify the verification** — what tests ran, did the build pass, manual/screenshot evidence.

## Dead Code Hygiene

After refactoring, identify orphaned code, list it explicitly, and ask before deleting: "Should I remove these now-unused elements: [list]?"

## Review Speed

Respond within one business day (maximum, not target). Prioritize fast individual responses over a quick final approval. Ask authors to split changes that are too large to review properly.

## Handling Disagreements

Priority: technical facts/data > style guides (absolute authority on style) > engineering principles > codebase consistency. Don't accept "I'll clean it up later" — require cleanup before submission or file a bug with self-assignment.

## Honesty in Review

Don't rubber-stamp ("LGTM" with no evidence). Don't soften real issues. Quantify problems when possible ("this N+1 adds ~50ms per item"). Push back on approaches with clear problems. Accept override gracefully when the author has full context; comment on code, not people.

## Dependency Discipline

Before adding a dependency: does the existing stack solve this? size/bundle impact? actively maintained? known vulnerabilities (`npm audit` or equivalent)? license compatible? Prefer standard library and existing utilities.

**Upgrading a dependency** is a change like any other: read the changelog (not just semver), upgrade one dependency per change, let tests decide (green before/after), review the lockfile diff, never hand-edit the lockfile. For audit triage and supply-chain risk, see `security-and-hardening`.

## The Review Checklist

```
Context: understand the change
Correctness: matches spec, edge/error cases, adequate tests
Readability: clear names, straightforward logic, no unneeded complexity
Architecture: fits patterns, no unnecessary coupling, refactors reduce complexity, no feature logic in shared modules
Security: no secrets, input validated, no injection, auth in place, external data untrusted
Performance: no N+1, no unbounded ops, pagination present
Verification: tests pass, build succeeds, manual check done
Verdict: Approve / Request changes
```

## Common Rationalizations

| Rationalization                 | Reality                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| "It works, that's good enough"  | Unreadable/insecure/wrong-architecture code creates compounding debt.       |
| "The tests pass, so it's good"  | Tests don't catch architecture, security, or readability problems.          |
| "The refactor makes it cleaner" | Relocating complexity isn't reducing it — look for branches that disappear. |
| "It's just a version bump"      | A bump is a behavior change you didn't write; read the changelog.           |

## Red Flags

- PRs merged without review, or review that only checks tests pass
- "LGTM" without evidence; no severity labels on comments
- Large PRs "too big to review properly"
- A refactor that moves code around without reducing concepts held
- A bulk "bump dependencies" PR with no changelog review or per-package isolation

## Verification

- [ ] All Critical/Required issues resolved or explicitly deferred
- [ ] Tests pass, build succeeds
- [ ] Verification story documented
- [ ] Dependency upgrades reviewed per-package against changelog, lockfile diff checked

## Notas para nuestro stack

- Revisa consultas Doctrine buscando N+1: usa `JOIN FETCH`, `EagerLoading` o `addSelect` en vez de iterar y volver a consultar.
- Valida entrada con Symfony Validator/DTOs y `Assert` en controladores; en WordPress exige `sanitize_*`, `esc_*` y verificación de nonce en cada handler de formulario/AJAX.
- Comprueba autorización con `Security` de Symfony (`#[IsGranted]`, voters) y con `current_user_can()`/`permission_callback` en endpoints REST de WP.
- Para tests, exige cobertura con `vendor/bin/phpunit --filter` en PHP y `vitest`/`jest` en Vue/React/Astro; revisa que cubran casos límite, no solo el happy path.
- En PRs de frontend (Vue/React), vigila renders innecesarios y bundles: revisa `vue-tsc`, `eslint` y el tamaño del build de Astro.
- Autoescape de Twig debe permanecer activo; cualquier `|raw` o `{!! !!}` en plantillas necesita justificación explícita en la review.
- Actualizaciones de Composer/npm: revisa el diff de `composer.lock`/`package-lock.json` paquete a paquete, nunca en bloque.
- Cambios en `wp-content/themes` o `wp-content/plugins` propios: aplica los mismos cinco ejes que en Symfony, sin relajar el estándar por ser "solo WordPress".

Adaptado de addyosmani/agent-skills (MIT).
