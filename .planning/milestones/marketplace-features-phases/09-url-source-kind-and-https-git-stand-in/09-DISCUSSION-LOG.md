# Phase 9: URL Source Kind and HTTPS Git Stand-In - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 09-url-source-kind-and-https-git-stand-in
**Areas discussed:** Request-log assertions, Failure arming, Credential + isolation, Failing @url rows

---

## Request-log assertions

| Question | Options | Selected |
|----------|---------|----------|
| Row content | Method, path, status / Method and path only / Method, path, status, auth | Method, path, status |
| Window | Last command only / Whole scenario | Last command only |
| Where | Kind-only files only / Also on every @url verb row | Kind-only files only |
| Uncompared enforcement | No / Yes, in kind-only files | No |

## Failure arming

| Question | Options | Selected |
|----------|---------|----------|
| Arm target | One repository / The whole host | One repository |
| 401 arm | Accepts one credential / Always 401 | Accepts one credential |
| 5xx rows | 500, 502, 503 / 500 only | 500, 502, 503 |
| Drop point | First request / First and pack request | First request |

## Credential + isolation

| Question | Options | Selected |
|----------|---------|----------|
| Store credential | git credential approve / Write files directly | Write files directly |
| Global config | Sandbox HOME/.gitconfig / Fixed file outside HOME | Sandbox HOME/.gitconfig |
| Isolation proof | Env test + hand control / Committed scenario | Env test + hand control |
| Host HOME | Own scratch HOME / Share Pi's HOME | Own scratch HOME |

## Failing @url rows

| Question | Options | Selected |
|----------|---------|----------|
| Row fails | Triage, fix in phase / Stop and ask each time | Triage, fix in phase |
| Interim run | Ad-hoc tag run / Drop exclusion early | Ad-hoc tag run |
| RED proof | RED json, uncommitted plant / Log in SUMMARY only | RED json, uncommitted plant |

## Todo cross-reference

`2026-10-13-cucumber-rules-trial` matched on keywords; not folded (§3 concerns another repository).

## Claude's Discretion

Step wording, url feature-file names, lib module split, plan split, CGI details, refused-form row selection.

## Deferred Ideas

None beyond Phase 10's scope.
