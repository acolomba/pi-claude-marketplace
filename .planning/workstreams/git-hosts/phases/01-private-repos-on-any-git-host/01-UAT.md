---
status: diagnosed
phase: 01-private-repos-on-any-git-host
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-09-28T09:57:51Z
updated: 2026-09-28T10:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Real credential helper resolves a non-registry host (Step A)
expected: With a throwaway `credential.helper=store --file=/tmp/gauth-canary-credentials` (via GIT_CONFIG_*) and a PAT approved for YOUR.HOST, running the node snippet from 01-VERIFICATION.md Step A prints `positive: { username: "YOUR_USER", password: "YOUR_PAT" }` and `negative: null`.
result: pass
evidence: "fill(localhost:8443) -> { username: canary, password: s3cret-pat }; fill(not-stored.example.test) -> null. Tests 1-4 ran against an instrumented local server (Node HTTPS + Basic auth + git http-backend, self-signed cert trusted via NODE_EXTRA_CA_CERTS, host localhost:8443, every request Authorization header logged); the operator delegated the run."

### 2. Private marketplace on an arbitrary git host adds end to end (Step B)
expected: With the same helper env, `pi -p '/claude:plugin marketplace add https://YOUR.HOST/OWNER/PRIVATE-REPO --scope project'` (01-VERIFICATION.md Step B) renders `● <name> [project] (added)`; `[auth]` debug lines show no host-mismatch cancel.
result: pass
evidence: "RPC-mode notify rendered `● canary-marketplace [project] (added)`; wire: info/refs auth=none -> 401, info/refs auth=VALID, upload-pack auth=VALID; state.json records the url-kind marketplace and the clone is on disk. Note: Step B's documented command uses `--cwd`, which this pi version rejects (`Unknown option: --cwd`); run from the project dir instead."

### 3. No helper configured fails cleanly (Step C)
expected: Re-running Step B with the GIT_CONFIG_* helper vars unset renders a bare `⊘ <name> [project] (failed) {authentication required}` row — no crash, no silent success.
result: pass
evidence: "Rendered `A marketplace operation has failed.` + `⊘ https://localhost:8443/private-mp.git [project] (failed) {authentication required}`; one unauthenticated request on the wire, no state.json written, exit 0. Debug line reads `[auth] onAuth: Device Flow failed for localhost:8443: no credential was obtained ...` — wording says Device Flow for a host that has none (debug-only)."

### 4. Host guard holds on a real caller-side mismatch
expected: A bundle bound to one host driving a clone at another real host sends no credential — the `[auth]` debug line shows `onAuth: url host ... does not match the bound host ...` and the verb fails with `{authentication required}` rather than leaking the PAT. (Verifier notes this half is already proven offline through real isomorphic-git; answer `skip` with a reason if you accept that.)
result: issue
reported: "Instrumented redirect run: bound host localhost:8444 (credential stored for it) 302-redirects to localhost:9443. The 9443 server received `Authorization: Basic` with the VALID localhost:8444 credential on both `info/refs` and the (POST->GET) `git-upload-pack` request. Control: redirect to 127.0.0.1:9443 (different hostname) sent auth=none and failed cleanly with `{authentication required}`."
severity: major

### 5. buildAuthForHost returns a bundle for every host
expected: buildAuthForHost returns a bundle for every host, so a credential already in the user's git credential helper authenticates a clone on a host the provider registry does not claim
result: pass
source: automated
coverage_id: 01-01/D1

### 6. Credential miss names `git credential approve` on update
expected: A credential miss on a host with no Device Flow surfaces as an error whose cause chain names `git credential approve`, on the update path, driven by the failure identity that actually occurs
result: pass
source: automated
coverage_id: 01-01/D2

### 7. github.com and gitlab.com Device Flow unchanged
expected: github.com and gitlab.com run the identical Device Flow closure, memoization and prompt, and gain no stored-credential cause line on a declined flow
result: pass
source: automated
coverage_id: 01-01/D3

### 8. onAuth refuses a mismatched host before querying the helper
expected: onAuth refuses a URL whose host differs from the bundle's bound host, and refuses before the credential helper is queried
result: pass
source: automated
coverage_id: 01-02/D1

### 9. Port participates in the host compare
expected: The port participates in the compare on both sides, and the default https port normalizes away on both
result: pass
source: automated
coverage_id: 01-02/D2

### 10. Unparseable URL cancels instead of throwing
expected: An unparseable URL produces a cancel, not a raw throw reaching isomorphic-git (CP-10)
result: pass
source: automated
coverage_id: 01-02/D3

### 11. Cancel sends no Authorization header
expected: At the transport, a cancel surfaces as UserCanceledError and the recorded request carries no Authorization header
result: pass
source: automated
coverage_id: 01-02/D4

### 12. Every plugin verb threads a host-keyed bundle
expected: Every plugin verb threads a host-keyed bundle for a source on a host the provider registry does not claim, so GAUTH-03 holds on the plugin surface and not only on the marketplace surface
result: pass
source: automated
coverage_id: 01-03/D1

### 13. Edge handlers carry the bundle on clone and fetch
expected: The edge handler surfaces record the bundle on the clone and fetch calls they byte-lock, so the end-to-end handler path is asserted to carry auth
result: pass
source: automated
coverage_id: 01-03/D2

### 14. Public source on an unregistered host consults nothing
expected: A public source on an unregistered host still performs no credential lookup and fires no Device Flow prompt: the bundle is attached but nothing is consulted unless the server challenges (PROV-02's surviving half)
result: pass
source: automated
coverage_id: 01-03/D3

### 15. Device Flow hosts unchanged while helper path widens
expected: github.com and gitlab.com keep their Device Flow path unchanged while the credential-helper path widens to every host (GAUTH-05)
result: pass
source: automated
coverage_id: 01-03/D4

## Summary

total: 15
passed: 14
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-01-4
  truth: "No credential bound to one host crosses to another host (host = hostname + port, 01-02 D2) — including when the server redirects"
  status: failed
  reason: "User reported: redirect from localhost:8444 to localhost:9443 forwarded the localhost:8444 Basic credential to :9443 on info/refs and git-upload-pack"
  severity: major
  test: 4
  root_cause: "onAuth's host guard sees only the ORIGINAL url, so it passes; the Authorization header isomorphic-git then attaches is carried across the 3xx by simple-get@4.0.1 (isomorphic-git/http/node transport), which strips `authorization` only when the HOSTNAME changes (simple-get/index.js:55-59) and ignores the port. Same-hostname/different-port redirects therefore leak the credential. Git (curl >= 7.83, CVE-2022-27776) drops credentials on a port or scheme change."
  artifacts:
    - path: "node_modules/simple-get/index.js"
      issue: "redirect header scrub compares hostname only (lines 47-59)"
    - path: "extensions/pi-claude-marketplace/platform/git.ts"
      issue: "passes isomorphic-git/http/node transport straight through; no redirect policy of its own"
    - path: "extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts"
      issue: "host guard runs in onAuth against the pre-redirect url only"
  missing:
    - "A transport-level redirect policy that drops Authorization (or refuses the redirect) when the redirect target's host:port or scheme differs from the bound host"
    - "A test driving a same-hostname/different-port 3xx through real isomorphic-git asserting the second origin sees no Authorization header"
  debug_session: "scratchpad harness gitsrv/server.mjs (ports 8443/8444/9443); logs auth.log, test4.out, test4b.out"
