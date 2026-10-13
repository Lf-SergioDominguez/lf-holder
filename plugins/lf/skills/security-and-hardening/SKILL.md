---
name: security-and-hardening
description: Úsala al manejar entrada de usuario, autenticación, datos sensibles o integraciones externas, para auditar y endurecer contra OWASP Top Ten.
---

# Security and Hardening

Treat every external input as hostile, every secret as sacred, every authorization check as mandatory. Security is a constraint on every line touching user data, auth, or external systems.

## Process: Threat Model First

1. **Map trust boundaries** — HTTP requests, form fields, uploads, webhooks, third-party APIs, queues, LLM output, and local-looking values from other processes (env, command line, shared-volume filenames). Trust follows who _wrote_ a value, not the channel.
2. **Name the assets** — credentials, PII, payment data, admin actions, money movement.
3. **Run STRIDE** per boundary: Spoofing→auth/signatures; Tampering→integrity checks/parameterized queries/HTTPS; Repudiation→audit logging; Information disclosure→encryption/allowlists/generic errors; DoS→rate limiting/size caps/timeouts; Elevation of privilege→authorization/least privilege.
4. Write abuse cases next to use cases — "how would I misuse this?" becomes your first test.

## The Three-Tier Boundary System

**Always:** validate all external input at the boundary; parameterize all DB queries; encode output (framework auto-escaping); HTTPS everywhere; hash passwords with bcrypt/scrypt/argon2; security headers (CSP, HSTS, X-Frame-Options); httpOnly/secure/sameSite cookies; run the package manager's native audit before release.

**Ask first:** new auth flows, new sensitive-data categories, new external integrations, CORS changes, file upload handlers, rate-limit changes, elevated permissions.

**Never:** commit secrets; log sensitive data; trust client-side validation as a security boundary; disable security headers; use `eval()`/`innerHTML` with user data; store auth tokens in localStorage; expose stack traces to users.

## OWASP Top 10 Prevention Patterns

- **Injection:** always parameterized queries / ORM — never string-concatenated SQL.
- **Broken auth:** bcrypt/argon2 hashing (cost ≥12); sessions httpOnly+secure+sameSite, secret from env.
- **XSS:** rely on framework auto-escaping; sanitize any raw HTML with DOMPurify; never `innerHTML` with user input.
- **Broken access control:** check resource ownership, not just authentication, on every mutating endpoint.
- **Security misconfiguration:** apply `helmet`/CSP; restrict CORS to known origins, never wildcard with credentials.
- **Sensitive data exposure:** strip `passwordHash`/tokens from API responses; secrets only from env vars.
- **SSRF:** any server-side fetch of a user-influenced URL needs a host allowlist, HTTPS-only, DNS resolution of ALL records checked against private/reserved ranges (`ipaddr.js` `range() !== 'unicast'` catches loopback and the `169.254.169.254` metadata target), and `redirect: 'error'`. Note the TOCTOU gap: DNS re-resolves after the check: for high-risk surfaces pin the resolved IP or use a filtering proxy.

## Input Validation & Uploads

Validate at boundaries with a schema (e.g., Zod) returning structured 422 errors. For uploads: allowlist MIME types, cap size, don't trust the extension — check magic bytes if critical.

## Destructive Operations on Derived Paths

A delete/move/overwrite is only as safe as the value naming its target — a shape check ("absolute, one dir deep") is not authorization. Before any destructive call require all three: target resolves (symlinks followed) under an **allowlisted root**; it sits at least one level **below** that root; it carries **ownership evidence read before the operation** (and before any teardown). On refusal, log and stop — never fall back to a broader default path. A marker file is self-attestation only if protected by ownership/MAC; resolving then operating on the _name_ is a check/use race on shared volumes — hold by descriptor / use no-follow where the hierarchy can change concurrently.

## Triaging Dependency Audit Results

Audits find known advisories, not trust. Critical/high + reachable in your runtime/build/test/deploy paths → fix immediately; unreachable → fix soon; no fix available → workaround, replace, or allowlist with a review date. Moderate: fix in next cycle if reachable in prod. Low: track.

**Supply chain:** find the real installation boundary/manager (don't assume npm); block dependency install scripts before first execution, approve only what's needed; never run forced audit remediation (`--force`) blindly — read changelogs, test each upgrade; verify registry signatures where supported; review new deps' ownership, maintenance, provenance, transitive graph, and typosquats.

## Rate Limiting

Use a shared store (Redis) once there's more than one process/instance — in-memory limiters reset per-instance or per-invocation on serverless, silently multiplying the effective limit.

## Secrets Management

`.env` committed only as `.env.example`; real `.env`/`.env.local` gitignored, along with `*.pem`/`*.key`. Check staged diffs for secret-shaped strings before committing. **If a secret is ever committed, rotate it** — history rewrite alone is not enough.

## Data Privacy & Compliance

Securing data answers "can an attacker read it"; privacy answers "should we hold it, and how long." Classify fields (non-personal / PII / sensitive) as you add them. Minimize against a stated purpose; set retention and an actual deletion path (including backups/caches/indexes); support export/correct/delete (GDPR/CCPA); get auditable consent before sharing PII with vendors; make region rules configurable, not hardcoded.

## Securing AI / LLM Features

Treat model output as untrusted input — never straight into `eval`/SQL/shell/`innerHTML`/file paths. Assume prompts can be hijacked (system prompt is not a security boundary; enforce permissions in code). Keep secrets and other tenants' data out of the context window. Scope tool/agent permissions to the minimum, require confirmation for destructive actions. Cap tokens/rate/recursion depth. Partition vector-store embeddings per tenant and validate documents before indexing.

## Security Review Checklist

Auth: hashed passwords (cost ≥12), httpOnly/secure/sameSite sessions, rate-limited login, expiring reset tokens. Authorization: every endpoint checks ownership; admin actions verify role. Input: validated at boundary, parameterized SQL, encoded HTML, allowlisted server-side fetches, destructive-path checks. Data: no secrets in code, sensitive fields excluded from responses, PII encrypted/classified/purpose-limited/retention-limited, export/delete supported. Infra: security headers, restricted CORS, audited dependencies, generic error messages. Supply chain: one lockfile, native audit triaged, install scripts blocked by default. AI: model output untrusted, secrets out of prompts, scoped tool permissions.

## Common Rationalizations

| Rationalization                                     | Reality                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| "This is an internal tool, security doesn't matter" | Internal tools get compromised too.                          |
| "We'll add security later"                          | Retrofitting is 10x harder — build it in now.                |
| "The audit passed, so the dependency is safe"       | Audits match known advisories, not newly malicious packages. |
| "Collect it now, we might need it later"            | Data you don't hold can't be breached or subpoenaed.         |

## Red Flags

- User input straight into queries, shell, or HTML
- A destructive operation guarded only by a path shape check
- Secrets in source or commit history; missing/wildcard CORS
- No rate limiting on auth, or an in-memory limiter behind multiple instances
- Dependencies with known critical vulns, competing lockfiles, blanket-approved scripts
- Server fetching user-supplied URLs with no allowlist (SSRF)
- LLM output passed into a query, DOM, shell, or `eval`
- Personal data with no purpose, retention, or deletion path

## Verification

- [ ] Native audit clean of unmitigated reachable critical/high findings
- [ ] No secrets in source or history; input validated at boundaries
- [ ] Destructive filesystem ops check allowlisted root, min depth, ownership
- [ ] Auth/authorization checked on every protected endpoint; security headers present
- [ ] Rate limiting backed by a shared store when more than one instance serves traffic
- [ ] Server-side URL fetches allowlisted; LLM output validated/encoded before use
- [ ] Personal data classified, minimized, retention-limited; deletion/export work end-to-end

## Notas para nuestro stack

- Consultas Doctrine siempre parametrizadas (QueryBuilder/DQL); nunca concatenar SQL. En WordPress usar siempre `$wpdb->prepare()`.
- Autoescape de Twig activo por defecto: evita `|raw` salvo justificación; en componentes Vue/React evita `v-html`/`dangerouslySetInnerHTML` sin sanitizar (DOMPurify).
- Validación de entrada con Symfony Validator/DTOs (`#[Assert\...]`); en WordPress, `sanitize_text_field`, `esc_html`, `esc_attr`, `esc_url` en salida y nonces (`wp_verify_nonce`) en formularios/AJAX.
- Autorización: `#[IsGranted]`/voters de Symfony Security; en WP, `current_user_can()` y `permission_callback` real (nunca `__return_true`) en rutas REST.
- CSRF: tokens de formulario de Symfony (`csrf_token`) y nonces de WordPress en cada acción que mute estado.
- Secretos: variables de entorno gestionadas con Symfony `.env.local`/vault, o `wp-config.php` fuera del control de versiones; rota credenciales si algo se filtra a git.
- Rate limiting: `symfony/rate-limiter` con almacenamiento compartido (Redis) si hay varias instancias; en WP, limitar intentos de login vía plugin o transient compartido, no memoria de proceso.
- Auditoría de dependencias: `composer audit` y `npm audit` en CI, revisando alcanzabilidad antes de bloquear el pipeline; revisa el diff de `composer.lock`/`package-lock.json`.

Adaptado de addyosmani/agent-skills (MIT).
