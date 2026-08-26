# Product experience QA report

## Review context

- Requirement IDs and user journey: Preserve the existing logged-in session when opening the Vatsalya app inside the MyPracteaz iframe.
- Environment, viewport/device, and account state: Browser session unavailable in this environment; source-level validation only.
- Build/revision reviewed: Working tree changes in `my-angular-app` and `MyPracteazFrontend`.

| Area | Expected behavior | Result | Evidence | Severity | Follow-up |
|---|---|---|---|---|---|
| Primary flow | A logged-in parent passes its token to the iframe before the login view is rendered. | Pass | Query-token bootstrap, validated `AUTH_TOKEN`, and request/response handshake implemented. | — | Verify in a signed-in browser session. |
| Responsive layout | Existing PDF/content layout remains unchanged. | N/A | No layout styles or PDF viewer code changed. | — | Verify in a signed-in browser session. |
| Accessibility | Existing controls remain available after authentication. | Pass | Patient search remains available; login form is hidden only after authentication. | — | Verify keyboard focus in browser. |
| Loading/error states | Auth handoff is not dependent on one timing-sensitive load event. | Pass | Parent replies to `REQUEST_AUTH_TOKEN`; load and timeout delivery remain as fallback. | — | Verify expired/invalid token behavior in browser. |
| Performance/perceived quality | Avoid an avoidable second login render. | Pass | URL token is consumed during bootstrap and removed from browser history. | — | Verify visual transition in browser. |

## Release recommendation

- Ready / blocked: Blocked pending browser validation because no browser session is available.
- Required fixes: None identified by source/type validation.
- Accepted limitations: Angular build/test runner exits with code 134 during compilation in this environment, with no diagnostic output.
- Retest evidence: `npx tsc --noEmit -p tsconfig.app.json`, `npx tsc --noEmit -p tsconfig.spec.json`, and `git diff --check` pass.
