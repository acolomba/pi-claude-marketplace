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

This extension resolves a dependency by version range only. It does not pin a dependency to a commit. So an element that carries a `sha` is refused, and the install fails with `{invalid manifest}` (D-03-36). It is not ignored. If the extension ignored it, the dependency would install at whatever commit its marketplace names while the plugin author believed it was pinned.

Every field must match a character rule.

| Field                 | Rule                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `marketplace` | 1 to 256 characters. The first character is a letter or a digit. The rest are letters, digits, hyphens, periods or underscores.         |
| `version`             | 1 to 64 characters, taken from `A-Z`, `a-z`, `0-9`, and the characters `.`, `-`, `+`, `*`, `~`, `^`, `<`, `>`, `=`, `\|` and the space. |
| `sha`                 | 7 to 40 hexadecimal characters.                                                                                                         |

If one element breaks any of these rules, this extension refuses the whole `dependencies` declaration. It does not install part of the array and drop the rest. A constraint that disappears quietly is worse than a declaration that is refused, because the install would then pin a version nobody asked for.

## Which marketplace a dependency comes from

If an element names a marketplace, the dependency resolves from that marketplace. If an element names no marketplace, the dependency resolves from the marketplace of the plugin that declared it.

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

If the effective constraint is anything else, this extension reads the tag list of the dependency's source repository over the network. It then pins the install to a tag that satisfies the constraint. This read happens even when a usable copy of the dependency is already in the cache, because the constraint can ask for a different tag than the cached one. This is the one network call that dependency resolution adds (NFR-5, amended by D-03-03).

The tag must be named `<plugin-name>--v<version>`, for example `formatter--v1.2.0`.

A dependency pinned this way records the version the tag names, for example `1.2.0`. It does not record a git object name, which is what a plugin installed from a git source usually records. The recorded version is what a later install checks a new constraint against, so a git object name there would fail the constraint the pin had just satisfied.

This name comes from Anthropic's own plugin-release tooling. Git does not define it, and most repositories outside Anthropic do not use it. Such a repository reports no matching tag. Today that is the expected answer for most third-party sources. It is not a defect in the repository or in this extension.

### Only a git-backed dependency can be version-constrained

Release tags live in a git repository. So a dependency can satisfy a real constraint only when its marketplace entry names a git-backed source: `url`, a git repository plus a subdirectory, or `owner/repo`.

A `path` source has no tag list at all. Most marketplaces use path sources, for example `"source": "./plugins/formatter"`, so this is the common case and not a corner case. Such a dependency reports `{no matching version}` for every constraint except the wildcard. To depend on a path-source plugin, declare it with no version.

The already-installed check does not have this limit, and the difference is deliberate. That check reads the version already in the record and never asks a repository for anything, so a path-source dependency you installed earlier can satisfy a constraint that the same plugin, not yet installed, cannot. The two answers come from two different questions: what is on disk now, and what could be fetched.

## What happens to a dependency you already installed

This extension does not install a dependency again when the target scope already has it. It still checks the recorded version against the effective constraint. A recorded version that does not satisfy the constraint is a conflict, and the install fails.

A disabled plugin still counts as installed. Its record and its reserved names stay, but its files are off disk. So this extension does not install it again, and it does not enable it for you either. Enablement is always your decision. The install goes ahead and the dependency's row says `{already installed, dependency disabled}`, which raises the message to a warning. To make the dependency work, enable it yourself.

```text
/claude:plugin enable <plugin>@<marketplace>
```

Some plugins carry no real semantic version. This extension then records a content hash (`hash-` and 12 hexadecimal characters) or a git object name (`sha-` and 12 hexadecimal characters). Such a value goes through the same normalization as any other recorded version, with no special case. A hexadecimal string can yield a misleading version number this way. This behavior matches Claude Code and is a deliberate choice (D-03-04).

## Where a dependency lands

A dependency installs into the same scope as the plugin that asked for it. `/claude:plugin install formatter --scope project` puts every plugin `formatter` needs into the project scope. It never writes into the user scope.

The configuration file names only the plugins you asked for by name. This extension does not write a dependency into `claude-plugins.json` or `claude-plugins.local.json`. Instead, its install record says that it arrived through another plugin. A reload keeps the dependency because its record says so, not because the configuration names it.

## Why a dependency can fail

Each cause shows as a reason in braces on the failing dependency's own row. This table names every reason the cascade can show.

| Reason                               | What it means                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `{no matching version}`              | The tag list was read. No `<plugin-name>--v<version>` tag in it satisfies the constraint.                                               |
| `{version conflict}`                 | Two declarations ask for version sets that do not overlap, or the copy already installed falls outside the constraint.                  |
| `{already installed}`                | Joins `{version conflict}` when the copy that fails the constraint is the one already on disk. The row also shows its recorded version. |
| `{constraint too complex}`           | The declarations pass one of the two size limits above.                                                                                 |
| `{invalid version constraint}`       | The text is not a range the evaluator can read.                                                                                         |
| `{network unreachable}`              | The tag list could not be read. The network did not answer.                                                                             |
| `{authentication required}`          | The tag list could not be read. The source repository refused the credentials.                                                          |
| `{unreadable}`                       | The tag list could not be read, for a reason that is neither of the two above.                                                          |
| `{not in manifest}`                  | The named marketplace has no entry with that plugin name.                                                                               |
| `{dependency marketplace not added}` | You have not added the marketplace the dependency names.                                                                                |
| `{dependency cycle}`                 | A plugin depends on itself, directly or through a chain of other plugins.                                                               |
| `{invalid manifest}`                 | The `dependencies` declaration cannot be used. An element breaks a character rule, or it carries a `sha`.                               |
| `{dependency failed}`                | Shown on the row of the plugin you named, when one of its dependencies is what failed.                                                  |

The three "could not be read" reasons are deliberately separate from `{no matching version}`. A list that could not be read is a different fact from a list that held nothing usable.

The unadded marketplace is the one cause with a trust rule behind it. This extension adds no marketplace and clones no repository to satisfy a dependency. So a plugin cannot introduce a new source of code by declaring a dependency against it. If you want that dependency, add its marketplace yourself first.

```text
/claude:plugin marketplace add <owner>/<repo>
```

## What a failure does to the install

One failing dependency fails the whole install. This extension then removes every plugin the command installed, including the dependencies that had already succeeded. A dependency that was installed before you ran the command is not touched.

Nothing is left half-installed. After you fix the cause, run the same command again. It starts from the same state as the first attempt.

## Further reading

- [`docs/plugin-enablement.md`](plugin-enablement.md) -- what decides whether an installed plugin is enabled, including why a plugin required by another one is not enabled on its behalf.
- [`README.md` -- Configuration files](../README.md#configuration-files) -- the user-facing introduction to `claude-plugins.json` and `claude-plugins.local.json`, the files that name the plugins you asked for.
- [Claude Code plugins reference](https://code.claude.com/docs/en/plugins-reference) -- the upstream field reference for `dependencies`.
