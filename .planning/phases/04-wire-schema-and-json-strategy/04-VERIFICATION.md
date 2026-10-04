---
phase: 04-wire-schema-and-json-strategy
verified: 2026-10-03T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
covered_files:
  - .planning/phases/04-wire-schema-and-json-strategy/04-01-PLAN.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-01-SUMMARY.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-02-PLAN.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-02-SUMMARY.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-03-PLAN.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-03-SUMMARY.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-04-PLAN.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-04-SUMMARY.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-05-PLAN.md
  - .planning/phases/04-wire-schema-and-json-strategy/04-05-SUMMARY.md
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - schema/claude-plugin.schema.json
  - scripts/generate-wire-schema.mjs
  - scripts/wire-schema.mjs
  - tests/architecture/catalog-uat/catalog-wire.test.ts
  - tests/architecture/no-credential-leak.test.ts
covered_digest: "v2:sha256:b5939997a765f9a762cac84be14f41e16f681ad9cc5ef911bbd1f1aa5696f247"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC3 / PMOD-04: the model redacts credentials (URL userinfo and tokens), so they are absent from both text and JSON"
    status: partial
    reason: "Redaction covers thrown-message strings (cause chains, rollback causes, leaks, raw-surface strings, info urls and notes, advisories) but not marketplace block or row names. A failed `marketplace add <url-with-userinfo>` uses the user-typed raw source as the block name (`addSubjectName` returns `rawSource`), and the model emits `name` verbatim, so the userinfo reaches both the text and the JSON payload."
    artifacts:
      - path: "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
        issue: "line 562 `name: addSubjectName(err, opts.rawSource)`; line 345 returns the raw user-typed source for every failure that has no derived name"
      - path: "extensions/pi-claude-marketplace/shared/notification-resolve.ts"
        issue: "redactCredentials is applied at leaks and raw surfaces only; block and row `name` are never redacted"
      - path: "tests/architecture/no-credential-leak.test.ts"
        issue: "PLANTED_CREDENTIAL_SITES lists 15 sites; none plants a credential in a marketplace block name, so the gate cannot see this path"
    missing:
      - "Apply redactCredentials to the marketplace block name (and the marketplace-not-added name) in resolve or present, so text and JSON both read the redacted subject"
      - "Add a planted-credential site for a block name to PLANTED_CREDENTIAL_SITES"
      - "Alternatively record an explicit accepted-risk override: 04-RESEARCH.md lines 274 and 309 chose not to redact names, reasoning only from the scp-style `git@host:owner/repo` subject, which has no `scheme://` and would be untouched by the userinfo pattern"
---

# Phase 4: Wire Schema and JSON Strategy Verification Report

**Phase Goal:** A versioned typebox wire schema and a JSON strategy turn every model kind into a schema-valid payload that discloses nothing the text form does not. The JSON strategy is a format-only peer of the text strategy, and it is validated as a pure function before any sink is wired.
**Verified:** 2026-10-03
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Every catalog fixture and raw kind converts to a payload with integer `schemaVersion` and a `kind` from one typebox union, and validates; a planted invalid fixture fails; a `{}` converter turns the suite red | VERIFIED | `notification-wire.ts` exports one 18-member `Type.Union` keyed by `kind`, `schemaVersion: Type.Literal(1)`. `catalog-wire.test.ts` presents all 260 catalog examples (21 sections; the ROADMAP's "205" is stale, resolved in CONTEXT) plus 8 raw kinds, validates `JSON.parse(JSON.stringify(payload))` with the compiled union. Controls present and passing: `{}` converter fails every tuple, planted off-vocabulary reason fails by tuple, foreign raw-only member fails, emit fixture without `present` fails typecheck (`@ts-expect-error`). Ran: 144 tests across catalog-wire, notification-wire, notification-json, generate-wire-schema, no-credential-leak, all pass |
| 2 | Raw verbatim values; closed-set tokens only; versions/timestamps unabbreviated; install-scoped rows carry `scope`; optional fields absent not null; empty collections `[]`; model order; `id`; `summary` on warning/error; numeric tally; `noOp` on update no-op | VERIFIED | WIRE-03: status, reason, scope, severity, hint literals built from `as const satisfies Record<ClosedSet, true>` enrollment maps, so a closed-set change fails typecheck. `wireRow` emits `id: name@marketplace`, raw `version`, `from`/`to` on updated rows; `wireScope` always emits `scope` for the 15 install-scoped statuses. Every schema object sets `additionalProperties: false`; the walk test rejects any `undefined`/`null` member. `wireEnvelope` adds `summary` only when severity is not info; WIRE-05 test asserts `summary` present exactly when warning/error across all structured payloads; `noOp` test asserts exactly the two update no-op payloads carry `noOp: true`. Raw kinds carry no `summary` by D-01 (the raw model composes none; `async-rewake-summary` uses `text`). Per-row `dependencies` is omitted on cascade rows by the D-04 "emit what the text shows" rule |
| 3 | Whole-payload walk finds no hidden absolute path and no live `Error`; the model redacts credentials, absent from both text and JSON; AUTH-09 covers JSON; redaction is the only text difference from baseline | PARTIAL (gap) | WIRE-08 walk (`walkAll` over all 268 presented sources) passes with controls (POSIX/Windows path planted mid-link, `Error` member, `undefined` member each yield exactly one finding; path-source `absPath` detected and accepted). AUTH-09 extended: 15 planted-credential sites each read the presentation, the JSON payload and the text delivered by production `notify`. Corpus: `node scripts/notify-corpus.mjs check` = 3143 baseline present, 0 extra (3134 plus the 9 approved D-13 entries); `git diff --exit-code 4e6c568a -- docs/output-catalog.md` empty. BUT marketplace block names are not redacted: reproduced end to end (see Gaps) |
| 4 | JSON Schema generated from typebox source is committed and in the npm package; a test fails on drift | VERIFIED | `schema/claude-plugin.schema.json` (62.4 kB) is generated by `scripts/generate-wire-schema.mjs` from `NOTIFICATION_PAYLOAD_SCHEMA`; `package.json` `files` lists it; `npm pack --dry-run` lists `schema/claude-plugin.schema.json` (290 files). `generate-wire-schema.test.ts` deep-compares a fresh build with the committed file, checks idempotence, member count 18, a planted missing-kind drift, and the `files` entry |
| 5 | Both LLM tools build `details` from the wire plugin-row and marketplace-block shapes, verbatim status tokens (`upgradable` stays `upgradable`); line-format content unchanged | VERIFIED | `tools.ts` builds `details.marketplaces` from `toWirePayload(presentCascade(openNotificationRun(pi), ...))` for both tools, under `MARKETPLACE_LIST_CONTEXT` / `LIST_CONTEXT` row policies. The status-to-bucket projection remains only for content lines. `git diff fc8d845d HEAD` shows the only changed content-line statement is the `mp.name`/`mp.scope` variable rename; no content assertion was removed from `tools.test.ts`. 36 tool tests pass, including whole-block assertions for `upgradable` and `partially-upgradable` rows. `toWirePayload` has its first production consumer (tools.ts), so the ROADMAP dead-code note is satisfied without pulling Phase 5 forward |

**Score:** 4/5 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `shared/notification-wire.ts` | typebox union, 18 kinds | VERIFIED | 581 lines, substantive, imported type-only by `notification-json.ts`, runtime by generator and tests |
| `shared/notification-json.ts` | explicit total-map converter | VERIFIED | field-by-field, no model spread; switch over every presentation and raw kind; imported by `tools.ts` (production) |
| `shared/notification-present.ts` | presentation step incl. info-kind redaction | VERIFIED | `presentCascade`/`presentNotification`, imported by dispatch and tools |
| `shared/redact-credentials.ts` | single redaction function | VERIFIED | applied at resolve, errors `serializeCauseChain`, present |
| `schema/claude-plugin.schema.json` | generated, packaged | VERIFIED | in pack list; drift-tested |
| `scripts/generate-wire-schema.mjs`, `scripts/wire-schema.mjs` | generator | VERIFIED | `npm run schema:generate` wired |
| `tests/architecture/catalog-uat/catalog-wire.test.ts` | catalog-wide proof | VERIFIED | passes with controls |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `edge/handlers/tools.ts` | `notification-json.ts` | `toWirePayload(presentCascade(...))` both tools | WIRED |
| `notification-dispatch.ts` | `notification-present.ts` | text formatted from the presentation | WIRED |
| `notification-json.ts` | `notification-wire.ts` | static type only (D-12, no runtime validation in production) | WIRED |
| generator | `notification-wire.ts` | `buildWireSchemaDocument()` | WIRED |
| `errors.ts serializeCauseChain` | `redact-credentials.ts` | every cause link | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Wire, converter, drift, AUTH-09, catalog proof | `node --test` on 5 files | 144 pass, 0 fail | PASS |
| LLM tools | `node --test tests/edge/handlers/tools.test.ts` | 36 pass | PASS |
| Text corpus equality | `node scripts/notify-corpus.mjs check` | 3143 present, 0 extra; exit 0 | PASS |
| Catalog byte lock | `git diff --exit-code 4e6c568a -- docs/output-catalog.md` | empty | PASS |
| Package ships schema | `npm pack --dry-run` | lists `schema/claude-plugin.schema.json` | PASS |
| Credentialed URL as failed-add subject | probe: `addMarketplace` with `rawSource: "https://alice:s3cret@gitlab.example.com/team/private-mp"`, clone throws HTTP 401 | delivered text: `⊘ https://alice:s3cret@gitlab.example.com/team/private-mp [project] (failed) {authentication required}`; model probe shows the same string as `marketplaces[0].name` in the JSON payload | FAIL |

Full `npm run check` was not re-run; the supplied evidence (full-scope pre-commit run at ad5348ab, code identical to HEAD) is accepted per `skills/local-verification`.

### Requirements Coverage

Plan frontmatter IDs: 04-01 (LLMT-01, WIRE-03, WIRE-04, WIRE-05, WIRE-06, WIRE-09), 04-02 (LLMT-01, WIRE-05), 04-03 (WIRE-01, WIRE-03, WIRE-04, WIRE-06), 04-04 (PMOD-04), 04-05 (JOUT-02, WIRE-08, WIRE-01). The union covers all 10 phase IDs. No orphaned requirements: REQUIREMENTS.md maps exactly these 10 to Phase 4; WIRE-02 and WIRE-07 map to Phase 6.

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| WIRE-01 | 04-03, 04-05 | SATISFIED | 18-kind union; all examples validate |
| WIRE-03 | 04-01, 04-03 | SATISFIED | `satisfies Record<ClosedSet, true>` enrollment |
| WIRE-04 | 04-01, 04-03 | SATISFIED | absent-not-null, `[]`, raw values, `additionalProperties: false`, walk |
| WIRE-05 | 04-01, 04-02 | SATISFIED | summary / tally / noOp tests |
| WIRE-06 | 04-01, 04-03 | SATISFIED | `id` on cascade and info rows |
| WIRE-08 | 04-05 | SATISFIED | walk plus controls |
| WIRE-09 | 04-01 | SATISFIED | generated, packed, drift test |
| JOUT-02 | 04-05 | SATISFIED | validate-all with `{}`, planted, foreign-member controls |
| LLMT-01 | 04-01, 04-02 | SATISFIED | both tools |
| PMOD-04 | 04-04 | BLOCKED (partial) | redaction of thrown-message strings is complete and gated; block-name subject path leaks (gap) |

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX` in any file the phase changed. No stubs: the union, converter and tools are wired and exercised.

### Known and Dispositioned Items (judged against the success criteria)

| Item | Breaks a Phase 4 criterion? |
| ---- | --------------------------- |
| WR-06 (JSON emits for raw surfaces the text strategy suppresses) | No. Deferred to ROADMAP Phase 5 criterion 6. SC1 to SC5 concern conversion of fixtures and kinds, and no sink is wired yet |
| T-04-06 (marketplace tool content line echoes URL userinfo via `sourceLogical`) | No for SC3, which concerns the notification model's text and JSON. SC5 locks the content line unchanged. It is the same class of leak as the gap below and should be scheduled together with it |
| deferred-items.md (plugin tool load-error text outside redaction) | No. Carries a `state.json` read error, outside the model |
| 9 open Info items (IN-01..IN-09) | No. IN-06 (unhandled credential forms such as `Authorization: Basic`, `?access_token=`) is a documented residual scope of D-05 |

### Human Verification (not counted toward status; gaps_found takes precedence)

1. WR-01 Bearer rule: judge whether the token-shape heuristic (secret of 16 or more characters, or any digit or one of `_.~+/-`) is an acceptable trade between hiding a secret and rewriting prose such as `Bearer token required`. Only a human can accept that policy.

### Gaps Summary

One gap against SC3 / PMOD-04. The phase delivers the schema, the converter, the catalog-wide proof, the packaged generated schema, both tools' wiring, and gated redaction of every thrown-message site. What it misses is a subject-name path: when `marketplace add` fails for a source with no derived name, the row subject is the user-typed raw source, and the model never redacts names. Reproduced: a credentialed URL appears verbatim in the delivered text and in the JSON payload's `marketplaces[0].name`. The AUTH-09 gate has no site for it, so it stayed green. The research explicitly left names unredacted but only analysed the scp-style `git@host:owner/repo` subject, which the userinfo pattern (which requires `scheme://`) would not touch. Redacting names with the existing function should change no corpus byte (the research measured zero diffs on all 3134 corpus messages and the catalog for the same regex set). If the maintainer decides user-typed subjects are exempt, record an override in this file's frontmatter instead.

---

_Verified: 2026-10-03_
_Verifier: Claude (gsd-verifier)_
