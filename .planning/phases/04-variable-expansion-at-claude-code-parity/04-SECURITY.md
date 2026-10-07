---
phase: "4"
slug: "variable-expansion-at-claude-code-parity"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-07"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin manifest → install writer | A third-party plugin declares MCP server values with variable references | Untrusted strings (commands, args, env, url, headers) |
| Pi process environment → written entry | Install-time expansion reads the environment | Secrets and credentials (must never reach disk or notices) |
| Written entry → pi-mcp-adapter | The adapter re-expands values and can run a leading `!` as a shell command | Encoded strings the adapter interprets |
| CI / local scratch → third-party package | The conformance test installs pi-mcp-adapter@5.1.0 outside the repo | Package code (supply chain) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information disclosure | `substituteAndInject` / `expandClaudeValue` (secrets on disk) | high | mitigate | Only `:-` default text and the three builtin paths are resolved at install; a set variable is written as `${NAME}`; segments carry names only. Sentinel cases in `stage.test.ts` (the tracer and the staged-document case) and `substitute.test.ts` assert no value reaches the document (AVAR-02); plan 04-02 adds the install-level case. (plan 04-01) | closed |
| T-04-02 | Information disclosure | `serializeSegments` (adapter-only syntax in literal text) | high | mitigate | `{env:`, `$env:` and `${\w+}` in literal text get the split token, after merging adjacent text, so the adapter never expands a name Claude keeps literal (D-04-04). Goldens here; real-adapter proof in plan 04-08. (plan 04-01) | closed |
| T-04-03 | Information disclosure | `serializeSegments` (kept-reference spacer composition) | high | mitigate | Boundary guard before a kept reference whose preceding run ends in a prefix of `$env`/`{env` (D-04-19); the eight-tail rows and the case-table guard and merge rows; bounded-exhaustive proof in plan 04-08. (plan 04-01) | closed |
| T-04-04 | Elevation of privilege | written `env`/`headers` values (shell execution through a leading `!`) | high | mitigate | Every written env and headers value that starts with `!` gets one more `!`, including `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (D-04-03); an invariant case asserts no written env or headers value starts with a single `!`. (plan 04-01) | closed |
| T-04-05 | Information disclosure | `variables-missing` notice | medium | mitigate | The notice carries names only; values never reach `shared/`; the gate pins the bytes to the catalog block; the integration case sets a referenced variable to a sentinel and asserts that neither the written file nor any notification holds it. (plan 04-02) | closed |
| T-04-06 | Information disclosure | `expandClaudeValue` remote arm (credential exfiltration through url/headers) | high | mitigate | Remote-sink names, Claude's name patterns and the base-URL value rule blank the reference at install, always `""`, never left for the adapter (D-04-08); `stage.test.ts` security case and the integration case assert no sentinel in the file or a notification. (plan 04-03) | closed |
| T-04-07 | Information disclosure | `expandClaudeValue` plain arm (Claude's own credentials in command/args/env) | high | mitigate | Plain set plus `NDe`; set gives `""`; unset gives the default or the escaped literal, never a kept reference, so a value set later cannot leak. (plan 04-03) | closed |
| T-04-08 | Tampering | deny-list snapshot drift | medium | mitigate | Digests of the three sets computed from the 2.1.291 evidence are pinned; any list edit fails until the evidence is re-extracted. (plan 04-03) | closed |
| T-04-09 | Information disclosure | credential-free `*_BASE_URL` kept at install, credential added later | low | accept | D-04-13: Claude evaluates the value at each load; the residual is documented in docs/mcp-compatibility.md by plan 04-09. (plan 04-03) | closed |
| T-04-10 | Information disclosure | mode-gated sets omitted (`Gqe`, `Voo`, `Gur`, `tRe`) | low | accept | D-04-14: Claude-only runtime state (host-managed provider, bridge child, HIPAA tier, subprocess scrub); documented divergence. (plan 04-03) | closed |
| T-04-11 | Information disclosure | `credentials-blanked` notice | medium | mitigate | Names only; the security case asserts no sentinel in any notification. (plan 04-03) | closed |
| T-04-12 | Tampering | `classifyMcpServer` stdio arm (home expansion changes the spawned path) | medium | mitigate | A leading `~`, `~/`, `~\` or `${NAME:-~…}` in `command`/`args` blocks the server (`{unsupported mcp}`); a normal install refuses and `--partial` leaves it out (D-04-06, D-04-15); classifier rows and the two integration cases assert it. (plan 04-04) | closed |
| T-04-13 | Tampering | env-dependent leading `~` after install-time expansion | low | accept | `${X:-}~/a` or a kept reference whose runtime value starts with `~/` is home-expanded by the adapter where Claude would not; it needs an empty default before a literal marker or a user-set value; flagged assumption, documented by plan 04-09. (plan 04-04) | closed |
| T-04-14 | Denial of service | reserved variable unset when the adapter resolves a split-token url | medium | mitigate | Set first in the factory and again in `session_start` (D-04-05, D-04-19); index and session-env cases assert both set points. (plan 04-05) | closed |
| T-04-15 | Denial of service | adapter loads first and connects an eager user-scope server before the factory runs | low | accept | No extension API orders loading; the adapter's own `session_start` re-initializes after the factory; documented by plan 04-09. (plan 04-05) | closed |
| T-04-16 | Information disclosure | `CLAUDE_PROJECT_DIR` inserted and re-scanned by the adapter | medium | mitigate | A cwd holding `$env:` or `{env:` is not exported and the skip is debug-logged (D-04-16); session-env and index cases assert it. (plan 04-05) | closed |
| T-04-17 | Tampering | a user sets the reserved variable to a non-empty value | low | accept | Overwritten to `""` at every load and session start; a non-empty value only corrupts literal text (inserted once, never re-scanned), it cannot expand a secret. (plan 04-05) | closed |
| T-04-18 | Tampering | split tokens depend on pi-mcp-adapter internals (pass order, `\w`, a new literal mode) | high | mitigate | Peer range `>=5.1.0 <6` pinned by the peer-floor gate and the AFILE-06 assertion (D-04-17); the escape is proven against 5.1.0's real functions in CI by plan 04-08. (plan 04-06) | closed |
| T-04-19 | Information disclosure | bash and every MCP child inherit `CLAUDE_PROJECT_DIR` | low | accept | D-04-09 accepted side effect: it holds the session cwd, not a secret; Claude Code does not set it for Bash; documented by plan 04-09. (plan 04-05) | closed |
| T-04-20 | Information disclosure | info `mcp:` line | medium | mitigate | The scan returns names only and the renderer receives names only; the info case sets a deny-listed variable to a sentinel and asserts no notification contains it. (plan 04-07) | closed |
| T-04-21 | Information disclosure | info network or write surface | low | mitigate | The scan is pure domain code over the injected environment map; info stays read-only and network-free (NFR-5; BLOCK F still gates `orchestrators/`). (plan 04-07) | closed |
| T-04-22 | Elevation of privilege | `adapterOutput` calling `resolveCommandSecret` | high | mitigate | The harness fails a case whose written value starts with a single `!` before calling the adapter; only `!!` and non-`!` values reach it. (plan 04-08) | closed |
| T-04-23 | Tampering | adapter change silently breaks the escape | high | mitigate | Case table and bounded-exhaustive property through the real functions, the dist drift guard, and the range check; CI runs them on every pull request with zero skips (D-04-18). (plan 04-08) | closed |
| T-04-24 | Repudiation | a skipped or stale proof reads as a pass | medium | mitigate | `PI_MCP_ADAPTER_ROOT` only, no global fallback; a set root that is missing, another package or out of range fails; CI always sets it; the negative run is recorded. (plan 04-08) | closed |
| T-04-25 | Information disclosure | `process.env` mutations leak between cases | low | mitigate | `withProcessEnv` restores every key in `finally`; the integration file runs in its own process. (plan 04-08) | closed |
| T-04-26 | Repudiation | a staging path drops the notices (user never learns a credential was withheld or a variable is unset) | medium | mitigate | One case per staging verb (install in plans 04-02/04-03; update, reinstall, enable, import and reconcile here) asserts both warnings and the absence of the value. (plan 04-09) | closed |
| T-04-27 | Information disclosure | accepted residuals (T-04-09, T-04-13, T-04-15, T-04-19) left undocumented | low | mitigate | docs/mcp-compatibility.md states each one in plain English. (plan 04-09) | closed |
| T-04-SC | Tampering | scratch install of pi-mcp-adapter@5.1.0 (local and CI) | high | mitigate | Blocking-human legitimacy checkpoint before the first install (Task 1); exact version pin; `--ignore-scripts --omit=peer`; CI installs into `$RUNNER_TEMP`, outside the repository; the peer stays out of package.json dependencies and the lock (peer-floor gate). (plan 04-08) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-09 | D-04-13: Claude evaluates the value at each load; the residual is documented in docs/mcp-compatibility.md by plan 04-09. | plan 04-03 threat model (operator-approved plans) | 2026-10-07 |
| AR-04-02 | T-04-10 | D-04-14: Claude-only runtime state (host-managed provider, bridge child, HIPAA tier, subprocess scrub); documented divergence. | plan 04-03 threat model (operator-approved plans) | 2026-10-07 |
| AR-04-03 | T-04-13 | `${X:-}~/a` or a kept reference whose runtime value starts with `~/` is home-expanded by the adapter where Claude would not; it needs an empty default before a literal marker or a user-set value; flagged assumption, documented by plan 04-09. | plan 04-04 threat model (operator-approved plans) | 2026-10-07 |
| AR-04-04 | T-04-15 | No extension API orders loading; the adapter's own `session_start` re-initializes after the factory; documented by plan 04-09. | plan 04-05 threat model (operator-approved plans) | 2026-10-07 |
| AR-04-05 | T-04-17 | Overwritten to `""` at every load and session start; a non-empty value only corrupts literal text (inserted once, never re-scanned), it cannot expand a secret. | plan 04-05 threat model (operator-approved plans) | 2026-10-07 |
| AR-04-06 | T-04-19 | D-04-09 accepted side effect: it holds the session cwd, not a secret; Claude Code does not set it for Bash; documented by plan 04-09. | plan 04-05 threat model (operator-approved plans) | 2026-10-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-07 | 28 | 28 | 0 | gsd-secure-phase (orchestrator, ASVS L1 grep-level; register authored at plan time) |

Evidence: mitigations located in `domain/claude-mcp-variables.ts`, `domain/claude-credential-denylist.ts`, `bridges/mcp/adapter-escape.ts`, `domain/mcp-server-features.ts`, `shared/session-env.ts`, `index.ts`, `package.json` peer range and `tests/architecture/peer-floor.test.ts`, and `tests/integration/adapter-expansion-conformance.test.ts` (44/44 pass, 0 skipped against adapter 5.1.0; negative run fails). Accepted residuals T-04-09, T-04-10, T-04-13, T-04-15, T-04-19 are documented in `docs/mcp-compatibility.md`. T-04-SC (scratch install) passed the blocking-human legitimacy checkpoint, approved by the operator on 2026-10-07. `npm run check` exit 0 on `63ad2116`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-07
