# Phase 11: Cross-marketplace dependency allowlist - Discussion Log

> **Audit trail only.** Decisions are in `11-CONTEXT.md`; research and planning
> consume that file instead of this log.

**Date:** 2026-09-23
**Phase:** 11-cross-marketplace-dependency-allowlist
**Areas discussed:** marketplace info output, malformed allowlist values,
cross-marketplace refusal detail

---

## Marketplace info output

| Question | Option | Description | Selected |
| --- | --- | --- | --- |
| Empty or absent list | Always show the field | List permitted marketplaces or show `none` when empty. | |
| Empty or absent list | Show only when nonempty | An omitted line means no marketplaces are allowed. | ✓ |
| Empty or absent list | Other | User-supplied display. | |
| Nonempty list label | `allowCrossMarketplaceDependenciesOn:` | Match the manifest field and refusal message. | |
| Nonempty list label | `allowed_marketplaces:` | Shorter, matching the command's snake-case labels. | ✓ |
| Nonempty list label | Other | User-supplied label. | |

**User's choice:** Emit `allowed_marketplaces:` only for a nonempty list.
The list separator, order, and placement follow existing output conventions.

## Malformed allowlist values

| Option | Description | Selected |
| --- | --- | --- |
| Reject the marketplace manifest | Identify the invalid field; matches Claude Code 2.1.267. | ✓ |
| Treat it as an empty allowlist | Keep the marketplace usable but block new cross-marketplace dependencies. | |
| Keep valid entries | Discard invalid list items and use the rest. | |
| Other | User-supplied behavior. | |

**User's choice:** Reject the manifest. An isolated Claude Code probe showed
that both validation and marketplace add reject malformed field values.

## Cross-marketplace refusal detail

| Option | Description | Selected |
| --- | --- | --- |
| Both remedies | Name the dependency, declarer, and target; explain manual install and the root manifest field. | ✓ |
| Manifest remedy only | Name the blocked dependency and tell the user which root manifest field to edit. | |
| Other | User-supplied message. | |

**User's choice:** Give both remedies, matching the Claude Code message and
official dependency guide. Use Pi's existing failed-row grammar.

## Agent discretion

- List separator, order, and placement within `marketplace info`.
- Sentence structure for the failure cause, with all required facts retained.

## Deferred ideas

None.
