---
status: pending
branch: gsd/v1.3-replan-catalog
milestones_covered: [v1.4, v1.4.1, v1.5]
scope: >
  Branch-wide merge gate UAT. Covers all user-visible behaviour shipped in
  v1.4 (structured notification messages), v1.4.1 (post-ship UAT patches),
  and v1.5 (notification output polish). Intended to be run once before
  /gsd-complete-milestone and merge to main.
catalog_ref: docs/output-catalog.md
created: 2026-05-31
---

# Branch UAT -- gsd/v1.3-replan-catalog

Run this before merging to `main`. Every requirement below maps to a
shipped fix in this branch; a `pass` on all tests means the branch is safe
to ship.

---

## Setup

### 1. Start Pi with an isolated home

```bash
scripts/pi.sh --home /tmp/pi-uat
```

The `--home` flag points Pi's agent directory at `/tmp/pi-uat/agent` so no
test state bleeds into your real Pi home. Drop `--home /tmp/pi-uat` to test
against your real Pi home instead (not recommended on first run).

To reset between runs:

```bash
rm -rf /tmp/pi-uat && scripts/pi.sh --home /tmp/pi-uat
```

### 2. Working directory

Pi's working directory must be the project root (where `scripts/pi.sh`
lives). All relative paths below (`./uat/uat-mp`) resolve from there.

### 3. Test marketplace

The fixture marketplace lives at `uat/uat-mp/` and declares four plugins:

| Plugin | Version | Installable? | Notes |
|--------|---------|-------------|-------|
| `alpha` | 1.0.0 | Yes | skill only |
| `beta` | 2.0.0 | Yes | skill + command |
| `claude-only` | 1.0.0 | No | declares `hooks` (unsupported feature) |
| `hashplugin` | *(none)* | Yes | no version → PI-7 hash-version |

### 4. Restore the fixture after version-bump tests

Tests T-11 and T-12 bump `alpha`'s version in the fixture. Restore with:

```bash
git checkout uat/uat-mp/
```

---

## How to read the expected output

**What the test shows** is the full on-screen string as rendered by the Pi
host (`@earendil-works/pi-coding-agent`). The host's severity mapping:

| severity arg (2nd `notify()` arg) | Host renders |
|------------------------------------|--------------|
| `"error"` | `Error: <message>` in red -- `Error: ` prepended to the first line |
| `"warning"` | `Warning: <message>` in yellow -- `Warning: ` prepended to the first line |
| omitted / info | `<message>` in dim -- no prefix, no color |

Phase 29 (UXG-07) adds a **summary line** (`N plugin operation(s) failed.`
/ `N plugin operation(s) skipped.`) as the first line of every
error/warning message. The host label therefore reads `Error: 1 plugin
operation failed.` as its first rendered line.

---

## Section 1 -- Empty state

### T-01: List with no marketplaces

```
/claude:plugin list
```

Expected:

```
(no marketplaces)
```

- No label prefix (info severity).
- No `/reload to pick up changes` trailer.

✓ Tests: empty list surface.

---

## Section 2 -- Marketplace lifecycle

### T-02: Add the test marketplace (path source)

```
/claude:plugin marketplace add ./uat/uat-mp
```

Expected:

```
● uat-mp [user] (added)
```

- No `Warning:` or `Error:` label prefix (info severity).
- **No** `/reload to pick up changes` trailer -- `marketplace add` changes a
  record, not a Pi-visible resource (v1.4.1 G-MIL-02 fix).

✓ Tests: path-source add; reload-hint suppressed on marketplace-only
  change.

### T-03: List after add (4 plugin rows)

```
/claude:plugin list
```

Expected:

```
● uat-mp [user]
  ○ alpha v1.0.0 (available)
  ○ beta v2.0.0 (available)
  ⊘ claude-only (unavailable) {hooks}
  ○ hashplugin (available)
```

- `claude-only` shows `⊘ (unavailable) {hooks}` because its manifest entry
  declares the unsupported `hooks` field -- reasons name the field verbatim.
- `hashplugin` shows no version token (manifest entry has none).
- No `<last-updated ...>` token anywhere (UXG-01 fix).
- No label prefix, no reload trailer.

✓ Tests: list surface shape; `{hooks}` unsupported-feature reason; UXG-01
  (no `<last-updated>` token).

### T-04: Marketplace autoupdate -- enable (UXG-04)

```
/claude:plugin marketplace autoupdate uat-mp
```

Expected:

```
● uat-mp [user] <autoupdate>
```

- Info severity (no label).

```
/claude:plugin marketplace autoupdate uat-mp
```

*(run a second time -- idempotent)*

Expected:

```
● uat-mp [user] <autoupdate> {already autoupdate}
```

- **No `Warning:` prefix** (info severity -- benign idempotent no-op routes
  to info per UXG-02 / D-28-06).

### T-05: Marketplace autoupdate -- disable (UXG-04)

```
/claude:plugin marketplace noautoupdate uat-mp
```

Expected:

```
● uat-mp [user] <no autoupdate>
```

- Explicit `<no autoupdate>` off-marker present (UXG-04 explicit-off-marker
  fix).
- Info severity.

```
/claude:plugin marketplace noautoupdate uat-mp
```

*(idempotent)*

Expected:

```
● uat-mp [user] <no autoupdate> {already no autoupdate}
```

- **No `Warning:` prefix** (info -- benign UXG-02).

✓ Tests: UXG-04 autoupdate marker grammar; UXG-02 idempotent flip is
  label-free.

### T-06: Marketplace list shows autoupdate marker -- no `<last-updated>` (UXG-01)

Re-enable autoupdate so the marker is visible:

```
/claude:plugin marketplace autoupdate uat-mp
```

Then:

```
/claude:plugin marketplace list
```

Expected (the `uat-mp` line):

```
● uat-mp [user] <autoupdate>
```

- `<autoupdate>` marker present (autoupdate is on).
- **No `<last-updated ...>` token** anywhere in the output (UXG-01 fix --
  the raw ISO timestamp was dropped because it is noise for path sources).

✓ Tests: UXG-01 (`<last-updated>` dropped from list surface).

### T-07: Marketplace update -- no change (UXG-02 + UXG-05)

```
/claude:plugin marketplace update uat-mp
```

*(manifest on disk has not changed)*

Expected:

```
● uat-mp [user] (skipped) {up-to-date}
```

- **No `Warning:` prefix** (info severity -- `up-to-date` is benign,
  UXG-02).
- **No** `/reload to pick up changes` trailer (no Pi-visible resources
  changed, G-MIL-06).
- `(skipped) {up-to-date}` token (UXG-05 fix -- was incorrectly `(updated)`
  before Phase 27).

✓ Tests: UXG-05 no-op renders `(skipped) {up-to-date}`; UXG-02 benign
  skip is label-free; G-MIL-06 no reload on manifest-only refresh.

---

## Section 3 -- Plugin install

### T-08: Install alpha (success)

```
/claude:plugin install alpha@uat-mp
```

Expected:

```
● uat-mp [user]
  ● alpha v1.0.0 (installed)

/reload to pick up changes
```

- Info severity (no label prefix).
- `/reload to pick up changes` trailer fires because `installed` is a
  state-changing token (v1.4 SNM-33 / D-22-01).

✓ Tests: install success shape; reload hint fires on install.

### T-09: List after install -- no reload trailer (G-21-01 regression)

```
/claude:plugin list
```

Expected:

```
● uat-mp [user] <autoupdate>
  ● alpha v1.0.0 (installed)
  ○ beta v2.0.0 (available)
  ⊘ claude-only (unavailable) {hooks}
  ○ hashplugin (available)
```

- `alpha` shows `(installed)` with no scope bracket (orphan-fold: plugin
  scope == marketplace scope, bracket suppressed per MSG-PL-6).
- **No** `/reload to pick up changes` trailer at the end -- list is a
  read-only surface (G-21-01 fix).
- `<autoupdate>` marker on the header (autoupdate is enabled from T-06).

✓ Tests: G-21-01 (list must not emit reload hint); installed/available row
  shapes; orphan-fold bracket suppression.

### T-10: Install already-installed plugin -- UXG-07 summary line (error)

```
/claude:plugin install alpha@uat-mp
```

Expected (host prepends `Error: ` to the first line):

```
Error: 1 plugin operation failed.

● uat-mp [user]
  ⊘ alpha (failed) {already installed}
    cause: Plugin "alpha" is already installed in marketplace "uat-mp".
```

- **`Error: ` prefix** from the host (severity `"error"`).
- **`1 plugin operation failed.`** summary line as the first rendered line
  (UXG-07 / Phase 29 fix -- the summary gives the `Error: ` prefix a
  meaningful sentence to introduce).
- No reload trailer.

✓ Tests: UXG-07 summary line on error cascade; `{already installed}` fail
  classification.

### T-11: Install plugin not in manifest -- UXG-07 summary line

```
/claude:plugin install ghost@uat-mp
```

Expected:

```
Error: 1 plugin operation failed.

● uat-mp [user]
  ⊘ ghost (failed) {not in manifest}
    cause: Plugin "ghost" not found in marketplace "uat-mp".
```

- `Error: ` prefix; summary line; `{not in manifest}` reason with cause.

✓ Tests: install of nonexistent plugin; UXG-07.

---

## Section 4 -- Plugin update

### T-12: Update beta -- not installed, in manifest (UXG-07 warning summary)

```
/claude:plugin update beta@uat-mp
```

*(beta is in the manifest but not installed)*

Expected (host prepends `Warning: `):

```
Warning: 1 plugin operation skipped.

● uat-mp [user]
  ⊘ beta v2.0.0 (skipped) {not installed}
```

- **`Warning: ` prefix** (actionable skip routes to `"warning"`).
- **`1 plugin operation skipped.`** summary line (UXG-07).
- No reload trailer (no state-changing outcome).

✓ Tests: UXG-07 summary on warning cascade; actionable skip still shows
  label (UXG-02 contrast: non-benign skips stay warning).

### T-13: Update plugin not in manifest -- UXG-08 fix

```
/claude:plugin update ghost@uat-mp
```

Expected:

```
Error: 1 plugin operation failed.

● uat-mp [user]
  ⊘ ghost (failed) {not in manifest}
```

- **`Error: ` prefix + summary** (severity `"error"`, UXG-07).
- `(failed) {not in manifest}` -- NOT `(skipped) {not installed}`.

> **Before Phase 29 (UXG-08 fix):** this rendered
> `Warning: ● uat-mp [user]`
> `  ⊘ ghost (skipped) {not installed}`.
> The fix makes `preflightUpdate` consult the manifest before concluding
> "not installed", so a typo / nonexistent plugin correctly classifies as
> `failed` (matching `install`'s behaviour).

✓ Tests: **UXG-08** -- update of manifest-absent plugin → `(failed) {not
  in manifest}`, not `(skipped) {not installed}`.

### T-14: Update alpha -- already up-to-date (UXG-02 benign info)

```
/claude:plugin update alpha@uat-mp
```

*(alpha v1.0.0 installed; marketplace.json still at v1.0.0)*

Expected:

```
● uat-mp [user]
  ⊘ alpha (skipped) {up-to-date}
```

- **No `Warning:` prefix** -- `up-to-date` is benign, routes to info
  (UXG-02 / D-28-06 benign-softening fix).
- No reload trailer.

> **Before Phase 28 (UXG-02):** this rendered `Warning: ● uat-mp [user]`
> with `⊘ alpha (skipped) {up-to-date}` -- a misleading warning for a
> routine no-op.

✓ Tests: **UXG-02** -- benign no-op routes to info (no `Warning:` label).

### T-15: Update alpha after version bump -- version arrow display (v1.4.1 SNM-34)

Bump alpha's version in the fixture to simulate a fresh manifest:

```bash
# from the project root, outside Pi
sed -i 's/"version": "1.0.0"/"version": "1.1.0"/' uat/uat-mp/.claude-plugin/marketplace.json
sed -i 's/"version": "1.0.0"/"version": "1.1.0"/' uat/uat-mp/plugins/alpha/.claude-plugin/plugin.json
```

Then in Pi:

```
/claude:plugin update alpha@uat-mp
```

Expected:

```
● uat-mp [user]
  ● alpha 1.0.0 → v1.1.0 (updated)

/reload to pick up changes
```

- Version arrow `1.0.0 → v1.1.0`: `from` is bare (no `v`), `to` is
  `v`-prefixed (v1.4.1 SNM-34 / `composeVersionArrow` asymmetric-v rule).
- Info severity (no label); reload hint fires (`updated` is state-changing).

Restore after this test:

```bash
git checkout uat/uat-mp/
```

✓ Tests: version arrow display; `from` bare / `to` v-prefixed.

---

## Section 5 -- Hash-version display (v1.4.1 SNM-35)

### T-16: Install hashplugin -- hash renders as v#\<7hex\>

```
/claude:plugin install hashplugin@uat-mp
```

Expected:

```
● uat-mp [user]
  ● hashplugin v#XXXXXXX (installed)

/reload to pick up changes
```

where `XXXXXXX` is exactly 7 lowercase hex characters (e.g. `v#2ea95f8`).

Then list:

```
/claude:plugin list
```

The installed hashplugin row should show `v#XXXXXXX`, **NOT** the full
`vhash-<12hex>` persistence form:

```
● uat-mp [user] <autoupdate>
  ● alpha v1.0.0 (installed)
  ● hashplugin v#XXXXXXX (installed)
  ○ beta v2.0.0 (available)
  ⊘ claude-only (unavailable) {hooks}
```

> The persistence record stores `hash-<12hex>` (PI-7 contract is intact);
> the display layer shortens it to `v#<7hex>` for readability (SNM-35 /
> D-23-05).

✓ Tests: v1.4.1 SNM-35 -- hash-version renders as `v#<7hex>`, not
  `vhash-<12hex>`.

---

## Section 6 -- Uninstall and remove

### T-17: Uninstall alpha

```
/claude:plugin uninstall alpha@uat-mp
```

Expected:

```
● uat-mp [user]
  ○ alpha (uninstalled)

/reload to pick up changes
```

- `○` glyph, `(uninstalled)` token, no version (the `successfullyUnstaged`
  accumulator tracks names only).
- Reload hint fires (`uninstalled` is state-changing).
- Info severity (no label).

✓ Tests: uninstall success shape.

### T-18: Marketplace remove -- reload hint fires on plugin unstaging

```
/claude:plugin marketplace remove uat-mp
```

*(hashplugin is still installed at this point)*

Expected:

```
● uat-mp [user] (removed)
  ○ hashplugin (uninstalled)

/reload to pick up changes
```

- `(removed)` marketplace header; `(uninstalled)` plugin row per D-22-02.
- Reload hint fires because at least one plugin was unstaged.
- Info severity.

After this test the Pi home is clean (no `uat-mp` in state).

✓ Tests: marketplace remove; plugin rows on remove; reload-hint fires on
  plugin unstaging.

---

## Summary checklist

| ID | Surface | What it tests | result |
|----|---------|--------------|--------|
| T-01 | `list` empty | Empty state | |
| T-02 | `marketplace add` | Path-source add; no reload on mp-add | |
| T-03 | `list` 4 plugins | Available/unavailable tokens; `{hooks}`; UXG-01 | |
| T-04 | `autoupdate` + idempotent | UXG-04 markers; UXG-02 idempotent no label | |
| T-05 | `noautoupdate` + idempotent | UXG-04 off-marker; UXG-02 | |
| T-06 | `marketplace list` | UXG-01 (no `<last-updated>`) | |
| T-07 | `marketplace update` no-op | UXG-05 `(skipped) {up-to-date}`; UXG-02; G-MIL-06 | |
| T-08 | `install` success | Install shape; reload hint fires | |
| T-09 | `list` after install | G-21-01 no reload on list | |
| T-10 | `install` already-installed | **UXG-07** summary line on error | |
| T-11 | `install` not-in-manifest | UXG-07; `{not in manifest}` | |
| T-12 | `update` not-installed | **UXG-07** summary line on warning | |
| T-13 | `update` manifest-absent | **UXG-08** `(failed)` not `(skipped)` | |
| T-14 | `update` up-to-date | **UXG-02** benign → info (no Warning:) | |
| T-15 | `update` version bump | SNM-34 version arrow `from → vto` | |
| T-16 | `install` hashplugin + `list` | SNM-35 `v#<7hex>` display | |
| T-17 | `uninstall` | Uninstall shape | |
| T-18 | `marketplace remove` | Remove + plugin unstaging reload hint | |

---

## Key regressions to confirm

These are the cases most likely to regress if something went wrong:

1. **UXG-08 (T-13):** `update ghost@uat-mp` must be `(failed) {not in
   manifest}`, not `(skipped) {not installed}`. If you see `Warning:` with
   `(skipped)`, the Phase 29 fix did not land.

2. **UXG-07 (T-10, T-12):** error and warning cascades must have a summary
   line as their first content line (`1 plugin operation failed.` /
   `1 plugin operation skipped.`). If you see `Error: ● uat-mp [user]`
   directly, the summary line is missing.

3. **UXG-02 (T-07, T-14):** `marketplace update` no-op and `update
   <plugin>` when up-to-date must render dim with **no `Warning:` prefix**.
   If you see `Warning:`, the benign-routing fix did not land.

4. **G-21-01 (T-09):** `list` must have **no `/reload to pick up changes`**
   trailer. If you see it, the G-21-01 regression is back.

5. **UXG-01 (T-06):** `marketplace list` must not include any
   `<last-updated ...>` token. If you see an ISO timestamp, UXG-01 did not
   land.
