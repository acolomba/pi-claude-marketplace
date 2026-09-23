# Dependency resolution

A plugin can declare the other plugins it needs. When you install that plugin, this extension installs the declared plugins with it. This document states what a plugin can declare, how several declarations for one dependency combine, and every way a dependency can fail (RESV-01 through RESV-06).

Two terms carry the whole document. A dependency is another plugin that a plugin needs. A version constraint is a rule that says which versions of a dependency are acceptable.

## What a plugin declares

A plugin declares its dependencies in a `dependencies` array. That array can sit in the plugin's entry in a marketplace's `marketplace.json` file, or in the plugin's own `plugin.json` file. Each element of the array takes one of two shapes.

The string shape names the dependency. It can also name a marketplace and a caret range.

| Element                    | Dependency  | Marketplace            | Version constraint |
| -------------------------- | ----------- | ---------------------- | ------------------ |
| `"formatter"`              | `formatter` | the declaring plugin's | none               |
| `"formatter@tools"`        | `formatter` | `tools`                | none               |
| `"formatter@^1.2.0"`       | `formatter` | the declaring plugin's | `^1.2.0`           |
| `"formatter@tools@^1.2.0"` | `formatter` | `tools`                | `^1.2.0`           |

The string shape carries a caret range only, because `@^` is the marker that separates the range from the address. To declare any other form, use the object shape.

```json
{
  "dependencies": [
    { "name": "formatter", "marketplace": "tools", "version": ">=1.2.0 <2.0.0" },
    { "name": "linter" }
  ]
}
```

The object shape accepts four keys. Only `name` is required. `marketplace`, `version` and `sha` are optional. The `sha` field holds a git object name. The constraint rules below describe the `version` field.

This extension resolves a dependency by version range only. It does not pin a dependency to a commit. Claude Code accepts a `sha` field on a dependency element and pins the dependency to that commit. This extension refuses the field instead, and the install fails with `{invalid manifest}` (D-03-36). It is not ignored. If the extension ignored it, the dependency would install at whatever commit its marketplace names while the plugin author believed it was pinned.

Every field must match a character rule.

| Field                 | Rule                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `marketplace` | 1 to 256 characters. The first character is a letter or a digit. The rest are letters, digits, hyphens, periods or underscores.         |
| `version`             | 1 to 64 characters, taken from `A-Z`, `a-z`, `0-9`, and the characters `.`, `-`, `+`, `*`, `~`, `^`, `<`, `>`, `=`, `\|` and the space. |
| `sha`                 | 7 to 40 hexadecimal characters.                                                                                                         |

If one element breaks any of these rules, this extension refuses the whole `dependencies` declaration. It does not install part of the array and drop the rest. A constraint that disappears quietly is worse than a declaration that is refused, because the install would then pin a version nobody asked for.

## Which marketplace a dependency comes from

If an element names a marketplace, the dependency resolves from that marketplace. If an element names no marketplace, the dependency resolves from the marketplace of the plugin that declared it.

For a direct install, the marketplace of the plugin you named is the policy root. Its `allowCrossMarketplaceDependenciesOn` list in `marketplace.json` must name each foreign marketplace needed by a new dependency, including one reached through another dependency. An intermediary marketplace cannot widen the root's permission with its own list. A dependency from the root marketplace needs no entry. An absent field and `[]` both grant no foreign permission. Adding a marketplace makes it available but does not grant this permission. Names are case-sensitive and are neither trimmed nor normalized.

A dependency already recorded in the target scope is exempt from this permission check, even if its marketplace has since been removed. The existing enabled or disabled traversal rules still apply, and its version constraint is still checked. A disabled record also counts as installed; a direct install reads through it and applies the root policy to any new dependencies it declares. To resolve a refusal, install the dependency by name first, or add its marketplace to `allowCrossMarketplaceDependenciesOn` in the policy root's `marketplace.json`.

A present `allowCrossMarketplaceDependenciesOn` field must be an array of strings. A scalar or an array with a non-string entry invalidates the marketplace manifest. The validation error names the field. The extension does not coerce or discard entries.

`/claude:plugin marketplace info <name>` shows `allowed_marketplaces:` followed by the list as a JSON array, in source order, when the list is nonempty. It omits that line when the field is absent or `[]`. The info command and install cascade read the same parsed list.

## What a version constraint can say

A version constraint follows the semantic versioning range syntax. This extension evaluates these forms.

| Form            | Example              | Meaning                                         |
| --------------- | -------------------- | ----------------------------------------------- |
| Caret           | `^1.2.0`             | 1.2.0 or later, below 2.0.0                     |
| Tilde           | `~1.2.0`             | 1.2.0 or later, below 1.3.0                     |
| Comparison      | `>=1.2.0`            | 1.2.0 or later                                  |
| Two comparisons | `>=1.2.0 <2.0.0`     | both rules apply at once                        |
| Union           | `1.2.0 \|\| >=2.0.0` | either rule is enough                           |
| X-range         | `1.x`, `1.2.x`       | any version whose named parts match             |
| Wildcard        | `*`                  | any version, which is the same as no constraint |

Matching follows the standard semantic versioning rules, including prerelease precedence. So `1.0.0-beta.1` comes before `1.0.0`. A range that names no prerelease does not match a prerelease version: `^1.0.0` accepts `1.4.2` and rejects `1.4.2-rc.1`.

See [How a constrained dependency is resolved](#how-a-constrained-dependency-is-resolved) for what a constraint is evaluated against, which now differs by source kind.

## How several declarations combine

Two plugins can both depend on a third one and ask for different versions. This extension then intersects the constraints. The effective constraint accepts only the versions that every declaration accepts.

Only declarations from this install's own dependency graph count. That graph is the plugin you named plus everything it depends on, directly or through another dependency. A constraint declared by an unrelated plugin you installed weeks earlier never affects a new install.

Two size limits bound the combination. Both are this project's own values, not values read from Claude Code.

| Limit                       | Value |
| --------------------------- | ----- |
| Total declared characters   | 4096  |
| Alternative ranges produced | 1024  |

If an input passes either limit, this extension refuses it as too complex. It measures the cost before it does the work, so a very large input fails fast instead of running for a long time.

## How a constrained dependency is resolved

If the effective constraint is the wildcard, the dependency installs like any other plugin and nothing extra happens.

If the effective constraint is anything else, this extension reads a tag list and pins the install to a tag that satisfies the constraint. This read happens even when a usable copy of the dependency is already in the cache, because the constraint can ask for a different tag than the cached one.

A dependency whose marketplace entry names a git-backed source (`url`, a git repository plus a subdirectory, or `owner/repo`) has a source repository of its own, and this extension reads that repository's tag list over the network. This is the one network call that dependency resolution adds (NFR-5, amended by D-03-03).

A dependency whose marketplace entry is a relative path has no source repository of its own. Most marketplaces declare their plugins this way, for example `"source": "./plugins/formatter"`, so this is the common case and not a corner case. This extension instead reads the tag list of the marketplace repository itself, from the local clone already on disk, with no network call at all.

The tag must be named `<plugin-name>--v<version>`, for example `formatter--v1.2.0`.

A dependency pinned this way records the version the tag names, for example `1.2.0`. It does not record a git object name, which is what a plugin installed from a git source usually records. The recorded version is what a later install checks a new constraint against, so a git object name there would fail the constraint the pin had just satisfied.

This name comes from Anthropic's own plugin-release tooling. Git does not define it, and most repositories outside Anthropic do not use it. Such a repository reports no matching tag. Today that is the expected answer for most third-party sources. It is not a defect in the repository or in this extension.

### When no tag satisfies the constraint

This fallback applies only to a path-source dependency. A git-backed dependency with no satisfying tag still fails the install with `{no matching version}` (see [Why a dependency can fail](#why-a-dependency-can-fail)); a path source falls back instead, because its tags live in the marketplace clone you already have on disk, not in a separate repository that might simply be unreachable or untagged.

The highest tag that satisfies the constraint is selected, and the plugin's files come from the marketplace repository at that tag, not from the marketplace's current checkout. When no tag satisfies -- including when the marketplace clone carries no tags at all, or none named for that plugin, or when the marketplace clone's tag list cannot be read at all (for example the marketplace is not a git checkout) -- the install goes ahead anyway, with the marketplace's current copy. The dependency's row reads `{dependency current copy}`, and the install succeeds.

Claude Code reports this same fallback as a warning. This extension reports it as a plain note instead, because nothing has gone wrong at install time; the [load-time check](#the-load-time-check) is what decides whether anything is actually wrong. That check runs on every reload afterward: it disables the dependent if the fallback copy really is out of range, and lifts the disable again once it is not (D-07-03).

The already-installed check does not depend on any of this. It reads the version already in the record and never asks a repository for anything, so a path-source dependency you installed earlier can satisfy a constraint that the same plugin, not yet installed, cannot. The two answers come from two different questions: what is on disk now, and what could be fetched.

## What happens to a dependency you already installed

This extension does not install a dependency again when the target scope already has it. It still checks the recorded version against the effective constraint. A recorded version that does not satisfy the constraint is a conflict, and the install fails.

A disabled plugin still counts as installed. Its record and its reserved names stay, but its files are off disk. So this extension does not install it again; it turns it back on through that same record. Its files return to disk, and the dependency's row says `{already installed, dependency enabled}`. The re-enable is transitive: a disabled dependency's own disabled dependencies come back the same way, and a dependency it declares that was never installed is installed as an ordinary cascade member. Every one of them answers to the same rules as a dependency the plugin you named declares directly: a recorded version is checked against the effective constraint, and two declarations of one dependency are intersected, wherever in the graph they sit. A declaration under a dependency that is already enabled is not walked. A dependency that is disabled and declares something this extension cannot resolve -- a plugin its marketplace does not list, a marketplace this scope has not added, or part of a cycle -- fails the install with that dependency's own reason, even though the plugin you named never declared it. This never ADDS a config entry for the dependency -- no config file gains a key for it (D-04-02). Where the target scope already declares the dependency with `enabled: false` -- what disabling it directly writes -- a standalone install overwrites that entry to `true` too, so a later reload does not plan the dependency's disable back; a dependency the configuration does not mention at all stays untouched, and only the installation record moves for it. A reconcile-driven install re-enables the record the same way but never patches the configuration entry, so a still-`false` entry there survives until the next standalone `enable` or `install`.

Some plugins carry no real semantic version. This extension then records a content hash (`hash-` and 12 hexadecimal characters) or a git object name (`sha-` and 12 hexadecimal characters). Such a value goes through the same normalization as any other recorded version, with no special case. A hexadecimal string can yield a misleading version number this way. This behavior matches Claude Code and is a deliberate choice (D-03-04).

## Where a dependency lands

A dependency installs into the same scope as the plugin that asked for it. `/claude:plugin install formatter --scope project` puts every plugin `formatter` needs into the project scope. It never writes into the user scope.

The configuration file names only the plugins you asked for by name. This extension does not ADD a dependency to `claude-plugins.json` or `claude-plugins.local.json`; an entry the configuration already holds for it is overwritten as described above. Its install record says that it arrived through another plugin. A reload keeps the dependency because its record says so, not because the configuration names it.

The same rule protects the dependency's marketplace. A dependency can come from a marketplace you added at user scope while the plugin that needs it installs at project scope. The project configuration then never names that marketplace, and this extension does not add it there. A reload keeps that marketplace record while a dependency is recorded under it. Any other plugin under it that the configuration does not name is still removed, as under any other marketplace.

## Installing a dependency by name

A plugin you install by name is recorded as one you asked for, even if another plugin also needs it. A later install of a plugin that needs it does not change that record. The move only goes the other way: when you install a dependency by name later, its record changes to say that you asked for it, and the row reads `{already installed, dependency promoted}`. This is a promotion. It changes nothing else about the record, and it writes the plugin's key into the configuration file, as a fresh install by name does. If the dependency was disabled, the same command enables it, because a plugin you ask for by name is enabled. `reinstall` and `update` never promote: they replace files and versions and leave the record's origin as it is, and an update's version choice is now bounded by what depends on the plugin.

`install` takes no version, so a promotion never changes the dependency's version. To move a dependency to another version, run `update` or `reinstall`, within the ranges its dependents allow.

A dependency that was installed partially, with some of its component kinds unsupported, needs `--partial` again. This is the same consent every partial install needs. Without the flag the command refuses with `{already installed}`. With it the record changes only its provenance and keeps its partial shape. On a fully supported dependency `--partial` changes nothing. `--map-model` has no effect on this command: it changes how generated agents are written, and this command generates none.

## What happens when an update is constrained by other plugins

An update never moves a plugin outside the range the installed plugins that declare it hold it to. When those ranges leave room, the update takes the highest version inside their intersection. When they leave none, that plugin's update is skipped and its row names who is holding it, and every other plugin in the same run updates as before. This applies to `update <plugin>`, `update <marketplace>`, a bare `update`, and to the background `autoupdate` cascade -- all four reach the same check.

Every installed plugin in the same scope constrains, enabled or disabled. A disabled plugin keeps its declarations exactly as it keeps its files, so a plugin briefly turned off still holds the things it needs. Constraints are scope-local: a project-scope update reads project-scope declarations, and a bare `update` across both scopes evaluates each independently.

To choose a version, this extension first searches the plugin's release tags for the highest one inside the combined range -- the source repository's tags for a git-source plugin, the marketplace repository's own `<name>--v<version>` tags for a plugin whose entry is a relative path. When a tag is found, the update takes it, and the record stores the version that tag names. When no tag is found -- including a repository with no release tags at all, and a marketplace whose tag list cannot be read -- the update resolves as it otherwise would, and the version that comes out is then measured against the same range. In range it proceeds; out of range it is skipped.

A marketplace entry that names its own commit is no exception. When a tag inside the combined range is found, the update moves the plugin to that tag, and the record stores the tag's version and commit. The dependents' ranges outrank the entry's pin, because a pinned commit outside a dependent's range is the conflict this check exists to settle.

A skipped update's row reads `{dependents constrain}`, and the `cause:` line says which of three situations it is -- the declared ranges admit nothing in common, no release tag satisfies them, or the version that resolved falls outside them -- and names the plugins holding it, marking any that are currently disabled. On the last of these, only the plugins whose own range rejects that version are named; a plugin whose range the version satisfies never appears on the line.

A plugin whose entry is a relative path and whose marketplace has no satisfying tag falls back to the marketplace's current copy, and that copy is then measured like any other version. When it is in range the update goes through and the row reads `{dependency current copy}` -- the same phrase an install uses for the same fact. When it is out of range the update is skipped. This differs from the install side, on purpose: on an install the alternative is having nothing, while on an update the alternative is keeping a copy that is already in range, so an update never knowingly moves an in-range plugin out of it.

When the plugin is already at the highest version its dependents admit, the row still reads `{up-to-date}`, and the `cause:` line names the range and its holders, so you can tell "nothing newer exists" from "nothing newer is allowed."

When some other installed plugin's declarations cannot be established, this plugin's update is skipped and the `cause:` line names that plugin and says why -- the same fail-closed rule [the uninstall refusal](#removing-a-plugin-other-plugins-need) already follows, differing only in that an update is skipped rather than refused.

The skipped row is reported as a warning on every surface, including a background autoupdate, because the condition persists until a declaration changes.

## Removing a plugin other plugins need

`uninstall` removes a plugin even while another installed plugin in the same scope declares it. A disabled plugin still counts as installed, so it still holds its dependencies. The row reads `{dependents unsatisfied}`, and its `cause:` line names each dependent as `name@marketplace`. The plugin, its files and its record are gone when the command returns.

At the next reload, each named dependent is disabled and told what to do: install the plugin again, or uninstall the dependent. Nothing is lost while you decide, because a disabled plugin keeps its record. See [The load-time check](#the-load-time-check) for what that reload reports.

To remove a dependent as well, uninstall it too. If the plugin arrived as a dependency, you can instead run `--prune` on the dependent. The dependent goes, and the plugin goes with it as an orphan (see the next section).

```text
/claude:plugin uninstall <dependent>@<marketplace> --prune
```

A reload applies the same rule. If you remove a plugin from the configuration file while another installed plugin still declares it, the reload removes it. The reload row is the plain one: the reload reports the dependents on their own rows instead, with the full remedy, on the pass after the removal.

The check reads the declarations of every other installed plugin in the scope, offline, from each plugin's own manifest or its marketplace entry (D-05-06). If any one of them cannot be read, the uninstall is refused (D-05-07). This is a deliberate choice. This extension never removes a plugin on incomplete information. A declaration cannot be read in four cases: the plugin's marketplace no longer lists it, the marketplace manifest itself is unreadable, its `dependencies` value cannot be used, or the plugin's own manifest file exists but cannot be read. A plugin with no manifest file of its own (for example a git plugin whose clone is not on disk) is answered by its marketplace entry, and an entry with no `dependencies` value means the plugin declares nothing. A manifest file that exists but cannot be read never counts as one that declares nothing, because a damaged file may hide a dependency the plugin really declares. The refused row reads `{unreadable}`, and the `cause:` line names which plugin could not be read and why. The simplest repair is to uninstall the plugin that cannot be read: the check never reads the plugin being removed, so that command is not refused, and the check passes for everything else afterwards. If that plugin should stay, repair its manifest file, or update the marketplace so the manifest lists it again. If the whole marketplace is stale, remove it instead.

```text
/claude:plugin uninstall <unreadable-plugin>@<marketplace>
/claude:plugin marketplace update <name>
/claude:plugin marketplace remove <name>
```

This rule has one consequence to know about. Two plugins in one scope that are both missing from their marketplace manifests refuse each other's uninstall: each one is the other's unreadable declarer, so neither can be uninstalled first. `marketplace remove` is the exit, because it does not run this check.

## Pruning dependencies nothing needs

`uninstall <plugin> --prune` also removes every plugin in the same scope that arrived as another plugin's dependency and that no remaining installed plugin declares. This includes dependencies that a plain `uninstall` or a reload orphaned earlier, and it includes the dependencies of the dependencies it removes. The sweep repeats until nothing new qualifies (D-05-01 / D-05-02).

```text
/claude:plugin uninstall <plugin>@<marketplace> --prune
```

The sweep never removes a plugin you installed by name, whatever declares it. A dependency you later installed by name counts as installed by name (see [Installing a dependency by name](#installing-a-dependency-by-name)). It never removes a plugin that a remaining installed plugin, enabled or disabled, still declares. It never removes a plugin in the other scope. It runs only after the named plugin was removed: a refused or failed uninstall prunes nothing (D-05-03).

Each removed dependency shows its own `(uninstalled) {dependency pruned}` row under its marketplace. `--keep-data` covers every plugin the command removes, and the rows then read `{dependency pruned, data kept}`. When nothing qualifies, the command prints the plain uninstall row and nothing more. If one removed dependency fails to remove, the others stay removed and its row shows the failure (D-05-13). The failed plugin is still installed, so the dependencies only it declares stay too.

A reload never prunes. An orphaned dependency stays installed until you run `--prune`, because its install record says that it arrived through another plugin (see [Where a dependency lands](#where-a-dependency-lands)). This matches Claude Code, which keeps orphaned dependencies on disk in case you reinstall a plugin that needs them.

## The load-time check

A dependency can go missing after the install that brought it in. You can uninstall it, disable it, or move it to another version. Every reload therefore re-reads what each installed plugin in the scope declares and checks it against what the scope has now.

A declaration is unsatisfied in three cases: the dependency is not installed, the dependency is installed but disabled, or the dependency's recorded version falls outside the declared range.

A plugin whose declaration is unsatisfied is disabled. Its skills, prompts, agents, MCP entries and hooks come off disk, so it stops loading instead of running against a dependency that is not there. Its install record stays, so nothing else is lost.

The row says which of the three cases the plugin hit. The `cause:` line names the remedy, and it names both plugins, so you can see what to repair and what to remove.

The dependency is not installed:

```text
● mp [project]
  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}
    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"
```

The dependency is installed but disabled:

```text
● mp [project]
  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}
    cause: Enable "secrets-vault@mp" or uninstall "deploy-kit@mp"
```

The dependency's recorded version is outside the declared range. This case carries its own reason, because its remedy is a different kind of action:

```text
● mp [project]
  ◍ deploy-kit v1.0.0 (disabled) {dependency version unsatisfied}
    cause: Update "secrets-vault@mp" to satisfy >=2.0.0 <3.0.0-0, or uninstall "deploy-kit@mp"
```

The range on that line is the range the check actually tested. It is every constraint the dependent declared for that dependency, intersected and written in full form. So a declared `^2.0.0` reads `>=2.0.0 <3.0.0-0`.

The version arm can also fire on a dependency that carries no real semantic version. A dependency recorded as `hash-` or `sha-` plus 12 hexadecimal characters goes through the same normalization as any other recorded version (D-03-04), which reads an arbitrary digit run out of the hexadecimal string. That number fails almost any range that is not a wildcard. The dependent is then disabled at load time and the row tells you to update the dependency, but the dependency has no semantic version to move to. Two things clear it: declare no version constraint on that dependency, or use a dependency whose marketplace gives it a real version.

This disable is a consequence, not a choice you made. So this extension does not write it into `claude-plugins.json` or `claude-plugins.local.json`. Those files hold what you asked for. The install record carries a marker instead, and the check works that marker out again on every reload.

A reload does not flip the plugin back and forth. While the dependency stays unsatisfied, later reloads leave the plugin disabled and report nothing new about it. When you satisfy the dependency, the next reload enables the plugin again and drops the marker. You edit nothing to lift it.

A disable you asked for is never lifted this way. The check lifts only the disable it applied itself.

One broken dependency reaches every plugin above it in a single reload. If `a` needs `b` and `b` needs `c`, then uninstalling `c` disables both `b` and `a` on the next reload, not one of them per reload. Installing `c` again brings both back on the next reload too.

A `/reload` also installs a dependency the scope has never seen. If an installed plugin declares a dependency with no install record, `/reload` installs it through the same install cascade `install` uses, from the marketplace the declaration names, at a version inside every declaring plugin's range, and records it as installed for a dependency, not by name. The dependent then loads in the same reload.

For this missing dependency, `/reload` checks every eligible plugin that originally declared it. A declarer in the dependency's marketplace grants permission. A declarer from another marketplace grants permission when its marketplace lists the dependency's marketplace in `allowCrossMarketplaceDependenciesOn`. Any one of these declarers can authorize the original edge. The first `requiredBy` key provides a stable name for a refusal message; it is not the only authority checked. After that edge is authorized, the missing dependency becomes the root of its own install cascade. Its marketplace's list controls any new foreign dependency that it declares. For example, when A needs B and B needs C, A's marketplace controls A-to-B and B's marketplace controls B-to-C.

A refusal installs nothing from that cascade. The command does not add a marketplace for you. Install the missing dependency by name first, or add its marketplace to `allowCrossMarketplaceDependenciesOn` in an original declarer's marketplace manifest. If the refusal concerns a dependency inside B's cascade, edit B's marketplace manifest instead. Then run `/reload` again. The dependent remains disabled until its declaration is satisfied.

```text
● mp [project]
  ● secrets-vault v1.0.0 (installed) {dependency installed}
  ● deploy-kit v1.0.0 (installed)

Reconcile: 2 successes
```

Session start does not install anything. It reports the missing dependency and waits for a `/reload`.

A dependency that is installed but disabled is not enabled by a reload. The row still tells you to enable it or uninstall the dependent.

When the install fails, the dependency gets its own row naming the reason. The dependent stays disabled with the install remedy. Nothing is left half installed. The next `/reload` tries again.

```text
A plugin operation has failed.

● mp [project]
  ⊘ secrets-vault (failed) {dependency failed}
    cause: Dependency "crypto-core@mp" is not declared by its marketplace.
  ◍ deploy-kit v1.0.0 (disabled) {dependency unsatisfied}
    cause: Install "secrets-vault@mp" or uninstall "deploy-kit@mp"

Reconcile: 1 failure, 1 warning
```

## Why a dependency can fail

Each cause shows as a reason in braces on the failing dependency's own row. This table names every reason the cascade can show.

| Reason                               | What it means                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{no matching version}`              | The tag list was read. No `<plugin-name>--v<version>` tag in it satisfies the constraint.                                                                  |
| `{version conflict}`                 | Two declarations ask for version sets that do not overlap, or the copy already installed falls outside the constraint.                                     |
| `{already installed}`                | Joins `{version conflict}` when the copy that fails the constraint is the one already on disk. The row also shows its recorded version.                    |
| `{constraint too complex}`           | The declarations pass one of the two size limits above.                                                                                                    |
| `{invalid version constraint}`       | The text is not a range the evaluator can read.                                                                                                            |
| `{network unreachable}`              | The tag list could not be read. The network did not answer.                                                                                                |
| `{authentication required}`          | The tag list could not be read. The source repository refused the credentials.                                                                             |
| `{unreadable}`                       | The tag list could not be read, for a reason that is neither of the two above.                                                                             |
| `{not in manifest}`                  | The named marketplace has no entry with that plugin name.                                                                                                  |
| `{dependency marketplace not added}` | You have not added the marketplace the dependency names.                                                                                                   |
| `{cross-marketplace}`                | The root marketplace does not allow this new dependency's marketplace. Install the dependency by name first, or add its marketplace to the root allowlist. |
| `{dependency cycle}`                 | A plugin depends on itself, directly or through a chain of other plugins.                                                                                  |
| `{invalid manifest}`                 | The `dependencies` declaration cannot be used. An element breaks a character rule, or it carries a `sha`.                                                  |
| `{dependency failed}`                | Shown on the row of the plugin you named, when one of its dependencies is what failed.                                                                     |

The three "could not be read" reasons are deliberately separate from `{no matching version}`. A list that could not be read is a different fact from a list that held nothing usable.

The failing dependency can be one the plugin you named never declared. A dependency that is already installed but disabled is walked like any other, so its own declarations can fail the install with any reason in this table -- `{not in manifest}`, `{dependency marketplace not added}` or `{dependency cycle}` among them -- and the row names the disabled dependency as the one that declared it. A dependency that is already installed and enabled is not walked, so nothing below it can fail an install.

The unadded marketplace is the one cause with a trust rule behind it. This extension adds no marketplace and clones no repository to satisfy a dependency. So a plugin cannot introduce a new source of code by declaring a dependency against it. If you want that dependency, add its marketplace yourself first.

```text
/claude:plugin marketplace add <owner>/<repo>
```

## What a failure does to the install

One failing dependency fails the whole install. This extension then removes every plugin the command installed, including the dependencies that had already succeeded. A dependency that was installed before you ran the command is not touched.

Nothing is left half-installed. After you fix the cause, run the same command again. It starts from the same state as the first attempt.

## Further reading

- [`docs/plugin-enablement.md`](plugin-enablement.md) -- what decides whether an installed plugin is enabled, including how a plugin required by another one is turned on through its own record.
- [`README.md` -- Configuration files](../README.md#configuration-files) -- the user-facing introduction to `claude-plugins.json` and `claude-plugins.local.json`, the files that name the plugins you asked for.
- [Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference) -- the upstream field reference for `dependencies`.
