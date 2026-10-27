# Quick 261027-a3p: Claude Code's full reserved marketplace name rules - Research

**Researched:** 2026-10-27
**Question:** What are all of Claude Code's reserved-marketplace-name rules (MKTNAME-01), where does it apply each one, and how do they map onto this extension's add, update, and load surfaces? This record supports the user decision that reverses D-PL5-03 (decision 5.2, recorded as D-PL5-28).
**Upstream position applies:** yes. The rules govern the `marketplace add` and `marketplace update` command surface and which recorded marketplaces load.

## Sources

| Source | What | Retrieved |
| --- | --- | --- |
| Binary | Claude Code **2.1.310**, `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`, through the strings dump `cc.txt` in the session scratchpad. Minified names are cited as they appear (`f4e`, `GTt`, ...); they change from build to build. | 2026-10-27 |
| Docs | `https://code.claude.com/docs/en/plugins/marketplace-reference.md#reserved-names` | 2026-10-27 |
| Docs | `https://code.claude.com/docs/en/errors.md`, sections "Marketplace is registered from an untrusted source", "Marketplace name is another spelling of a reserved name", "Claude Code refuses the marketplace name" | 2026-10-27 |
| Docs | `https://code.claude.com/docs/en/plugins/troubleshooting.md`, sections "`Cannot add marketplace "<name>": Claude Code reserves this name ...`", "`... cannot install plugins from a marketplace with this name`", "Marketplace "<name>" is added but ignored" | 2026-10-27 |
| Probe | none. The binary and the docs agree on every rule this record uses. | -- |

A Python port of the predicates below (scratchpad `a3p-scripts/rules.py`) reproduced every example the docs give: `official-claude-plugins` and `claude-plugins-v2` impersonate, `claude.code.plugins` is another spelling of `claude-code-plugins`, and `claude_code_plugins` is not refused.

## Evidence records

### R-1 The reserved set and the exact-name check (already ported by D-PL5-01) -- confidence high

Unchanged since E-1: `PZ` is 14 official names, 3 community names (`claude-community`, `claude-plugins-community`, `healthcare`), and 2 directory names (`anthropic-plugin-directory`, `claude-plugin-directory`), compared lowercased. `GTt(name, source)` returns null for a `github` source whose repo owner is `anthropics`, or a `git` URL on GitHub under `anthropics/`. Otherwise it returns the `github.com/anthropics/` sentence (github and git sources) or the `'anthropics' organization` sentence (every other source).

### R-2 Look-alike (impersonation) names -- confidence high

Code (2.1.310, schema chunk):

```js
var on=["marketplace","plugins","official"];
function rn(){return[...on,"directory","directories"]}
var an="official[^a-z0-9]*(anthropic|claude)|(?:anthropic|claude)[^a-z0-9]*official";
function ln(e){return new RegExp(`(?:${an}|^(?:anthropic|claude)[^a-z0-9]*(${e.join("|")}))`,"i")}
var $t=ln(rn()),Ls=ln(on),u3r=/[^\u0020-\u007E]/;
function f3r(e){return e.split(/[^a-z0-9]+/i).filter((n)=>n!=="")}
function*oQo(e,n){let s=f3r(e),r="";for(let[i,a]of s.entries())if(r+=a,yield{joined:r,isWhole:i===s.length-1},r.length>n)return}
function f4e(e){if(PZ.has(e.toLowerCase()))return!1;if(Ge(e))return!0;if($t.test(e))return!0;
  {if($t.test(e.replace(/^[^a-z0-9]+/i,"")))return!0;
   if(/official(?:anthropic|claude)|(?:anthropic|claude)official/i.test(e.replace(/[^a-z0-9]+/gi,"")))return!0;
   let n=rn(),s=new RegExp(`^(?:anthropic|claude)(?:${n.join("|")})s?$`,"i"),r=9+Math.max(...n.map((i)=>i.length))+1;
   for(let{joined:i}of oQo(e,r))if(s.test(i))return!0}return!1}
function r6(e){return f4e(e)&&!u3r.test(e)}
function Ge(e){return!PZ.has(e.toLowerCase())&&(u3r.test(e)||Ls.test(e))}
var c$e="Marketplace name impersonates an official Anthropic/Claude marketplace";
```

- **`f4e(name)`** is the full look-alike test. An exact reserved name, in any case, is never a look-alike, because `GTt` owns it. A name is a look-alike when any of these holds:
  - **Strong (`Ge`):** it holds a character outside printable ASCII (0x20-0x7E, so any non-ASCII character or control character), or it matches `Ls`.
  - It matches `$t`.
  - With its leading non-alphanumerics stripped, it matches `$t`.
  - With every non-alphanumeric removed, it contains `officialanthropic`, `officialclaude`, `anthropicofficial`, or `claudeofficial`.
  - One of its token-joined prefixes is `(anthropic|claude)(marketplace|plugins|official|directory|directories)s?`. Tokens are split on non-alphanumerics, and prefixes are tried up to the first one longer than 21 characters.
- Neither `Ls` nor `$t` is anchored at the end. `claude-plugins-v2`, `anthropic-plugins-extra`, and `claudeplugins` all match `^claude[^a-z0-9]*plugins`. The `an` half matches anywhere, so `unofficial-claude-tools` is a look-alike.
- **Soft look-alike (`C3r`):** `f4e && !Ge`. Examples: `claude-directory`, `anthropic-directories`, `claude-market-place`, `_claude-plugins`.
- **Where:** the catalog schema `m4e` declares `name: un(f4e)`, so the rule runs on every parse of a `marketplace.json`.
  - **Add:** `Lle` -> `But(source, undefined, ...)` -> `R3r(use(undefined))` uses the full `f4e`.
  - **Load and refresh:** `nse` and `$ut` parse with `R3r(use(registeredName))`. When the registered name is a soft look-alike (`C3r`), `yQo` relaxes the schema to `s.toLowerCase()===registered.toLowerCase() ? Ge(s) : f4e(s)`.
  - **Net load and refresh rule:** refuse when `declared ≡ registered` (ignoring case) and `Ge(declared)`, and refuse when `declared ≢ registered` and `f4e(declared)`. Both sides were derived and checked: when the registered name is not soft and the two names are equal, `f4e(declared)` and `Ge(declared)` give the same verdict.
  - `use(n)` returns undefined in cowork mode (`Njr()`), which turns the relaxation off. The normal CLI keeps it.
- **Messages:**
  - The schema issue is `Marketplace name impersonates an official Anthropic/Claude marketplace`.
  - The CLI add surfaces it as `Failed to add marketplace: Failed to parse marketplace file at <path>: Invalid schema: <path> name: <issue>`, or `Invalid marketplace schema from URL: name: <issue>` for a hosted catalog.
  - When a registered marketplace's catalog fails that issue, plugin load errors (`claude plugin list`, the `/plugin` Errors tab) read `Claude Code refuses the marketplace name "<registered>": it looks like one of Anthropic's own` (`fWt`, `nameRefused`; docs: v2.1.282+).
  - The install getter (`mG`) throws `Claude Code refuses this marketplace's name: it looks like one of Anthropic's own. Reloading won't help. Remove it in /plugin → Marketplaces (...)` (`tjo`/`njo`).
- **The explicit registered-name look-alike checks are off in 2.1.310.** `function VXn(){return!1}`, so `vne(e,n)=VXn()&&f4e(e)` is always false, and `xut` (refresh, settings sources) never throws. A registered look-alike is refused only through its catalog parse, above.

### R-3 Names Claude Code uses itself (`Be`): `npm`, `pip`, `uv`, `cargo`, `github`, `gh`, `inline`, `builtin`, `skills-dir`, `synced`, `claude-plugin-test` -- confidence high

```js
Be={inline:"--plugin-dir session plugins",builtin:"built-in plugins","skills-dir":"plugins auto-loaded from .claude/skills/",
 synced:"plugins synced from your claude.ai account","claude-plugin-test":"plugins loaded by claude plugin test",
 npm:"plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name",
 pip:"plugins installed from a Python package index (reserved; not yet available)",
 uv:"plugins installed from a Python package index through uv (reserved; not yet available)",
 cargo:"plugins installed from a Rust crate registry (reserved; not yet available)",
 github:"plugins installed straight from a GitHub repository (`<owner>/<repo>@github`; reserved; not yet available)",
 gh:"plugins installed straight from a GitHub repository (reserved; not yet available)"}
function SM(e){return Object.hasOwn(Be,e)}  var Ns=["npm","pip","uv","cargo","github","gh"];
function p3r(e){return Ns.includes(e.toLowerCase())}
// qe(...).superRefine: r=n.toLowerCase(); if(!SM(r)||p3r(r))return; addIssue(`Marketplace name "${r}" is reserved for ${Be[r]}`)
// js (via un()):        s=e.toLowerCase(); if(p3r(s)&&SM(s)) addIssue(`Marketplace name "${s}" is reserved for ${Be[s]}`)
```

- **Rule:** the lowercased name is a key of `Be`. Membership is an own-key test (`Object.hasOwn`), so `constructor` is not a key.
- **Message:** `Marketplace name "<lowercased name>" is reserved for <description>`, with no final period. The descriptions are verbatim above.
- **Where:** the catalog schema (`un(f4e)` = `qe(f4e).superRefine(js)`), so every catalog parse checks it: add, load, and refresh alike, with no grandfathering.
- **Docs:** the package names `npm`, `pip`, `uv`, `cargo`, `github`, and `gh` are reserved in any casing from 2.1.275. `claude plugin validate` lists every variant.

### R-4 Names starting with `claudeai-` -- confidence high

```js
vfe="claudeai-"
function _T(t){return t.replace(/[\u200c-\u200f\u202a-\u202e\u206a-\u206f\ufeff]/g,"").toUpperCase().toLowerCase()}
function _$(e){return _T(e).replace(/[. ]+$/,"")}
function _Wt(e){return e.replace(/[^a-zA-Z0-9\-_]/g,"-")}
function Cet(e){let n=_$(e.normalize("NFKC"));return n.startsWith(vfe)||_Wt(n).toLowerCase().startsWith(vfe)}
// kut(e): if(Cet(e)) throw `Cannot add marketplace ${JSON.stringify(e)}: names starting with "claudeai-" are reserved for marketplaces hosted on claude.ai (claude plugin marketplace add --claudeai <name>).`
```

- **Rule:** the name, after NFKC, invisible-character removal, case folding, and trailing dot and space removal, starts with `claudeai-`. A version with every character outside `[A-Za-z0-9_-]` changed to `-` counts too, so `ClaudeAI.tools` matches, and `claudeai_tools` does not.
- **Where:** add only (`kut`, called from the `Lle` name callback and from the registry write `pJe`). Load and refresh do not check it.
- **Docs quote** `Cannot add marketplace "<name>": names starting with "claudeai-" are reserved for marketplaces hosted on claude.ai`. The binary appends ` (claude plugin marketplace add --claudeai <name>).`

### R-5 Another spelling of a reserved name -- confidence high

```js
var Sn="anthropic-plugin-directory";
function fo(e){return e.replace(/[^a-zA-Z0-9\-_]/g,"-").toLowerCase()}
function g6r(e,n){let r=e.normalize("NFKC");return fo(e)===n||fo(r)===n||
  fo(r.replace(/[\u200c-\u200f\u202a-\u202e\u206a-\u206f\ufeff]/g,"").toUpperCase().toLowerCase().replace(/[. ]+$/,""))===n}
function uA(e){return g6r(e,Sn)}
function o$t(e){for(let n of PZ)if(n!==Sn&&e.toLowerCase()!==n&&g6r(e,n))return n;return}
function Qz(e){return/^\w[\w.@-]*$/.test(e)}
function Lbe(e){return`"${e}" is a reserved marketplace name.`}
function mdi(e,n){return Qz(e)?`"${e}" is another spelling of "${n}", a reserved marketplace name.`
  :`This marketplace's name is another spelling of "${n}", a reserved marketplace name. It is not exactly the reserved name it appears to be.`}
function BRo(e,n){return c3r.has(n)?Lbe(e):mdi(e,n)}   // c3r = the two directory names
// kut(e): ...; if(uA(e)){ if(lv()) throw `Cannot add marketplace ${JSON.stringify(e)}: the name is reserved for the built-in Anthropic Directory.`; throw Lbe(e) }
//         let n=o$t(e); if(n!==void 0) throw BRo(e,n)
```

- **Rule:** after every character outside `[A-Za-z0-9_-]` becomes `-` and the name is lowercased, it equals a reserved name without being that name in another case. NFKC and the invisible-character and trailing-dot fold also apply. This matches the docs: "differs ... only by a trailing dot, or by a symbol other than an underscore in place of a hyphen". `claude.code.plugins` and `healthcare.` are other spellings. `claude_code_plugins` is not.
- **Messages:**
  - A directory name (`anthropic-plugin-directory`, `claude-plugin-directory`) gets `"<name>" is a reserved marketplace name.`
  - Any other name gets `"<name>" is another spelling of "<reserved>", a reserved marketplace name.`, or the `This marketplace's name ...` form when the name fails `^\w[\w.@-]*$`.
  - With `lv()` on (GrowthBook `tengu_encapsulated_pebble`, default true), a spelling of `anthropic-plugin-directory` instead gets the `built-in Anthropic Directory` sentence. That sentence includes the exact name, from any source, the anthropics organization's included.
- **Where:**
  - **Add:** `kut` on the declared name. It runs after the schema and `GTt`, and it has no source exemption.
  - **Load:** `Kge` -> `BIe(registeredName)` refuses the registered name. The message is `known_marketplaces.json has an entry named "<e>", another spelling of the reserved marketplace name "<r>", so it is ignored. Remove it with: claude plugin marketplace remove <e>` (`h6r`). `claude plugin list` reads `Marketplace "<name>" is added but ignored (see the debug log)`.
  - **Refresh:** the refreshed catalog's name is not checked. Only the registered name is, through `rYn`.
- **Version:** v2.1.280+.
- **Overlap:** the categories are disjoint except that a spelling can also be a strong look-alike (`claude-plugins-official.`). The schema runs first, so the look-alike message wins.

### R-6 JavaScript object member names -- confidence high

```js
// Lle name callback, after kut(we):
if(s===void 0&&!K$(we)&&!Object.hasOwn(S,we)&&!bF(S).has(we)) throw `Cannot add marketplace "${Ve(we,64)}": Claude Code cannot install plugins from a marketplace with this name. ...`
if(Object.hasOwn(Object.prototype,we)&&!Object.hasOwn(S,we)&&!bF(S).has(we))
  throw `Cannot add marketplace "${Ve(we,64)}": Claude Code reserves this name and cannot register a marketplace under it. The name is set by "name" in the marketplace's marketplace.json; ask its maintainer to change it.`
```

- **Rule:** `Object.hasOwn(Object.prototype, name)`, skipped when the name is already registered (`S` = known marketplaces).
  - The predicate covers 12 names in V8 and JSC: `constructor`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `toString`, `valueOf`, `__proto__`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, and `__lookupSetter__`.
  - The plugin-id rule `K$` (`^[A-Za-z0-9][-A-Za-z0-9._]*$`) runs first, so the five `__` names get the plugin-id sentence instead. That is why the docs list only the first seven.
- **Where:** add only (v2.1.296+). Load does not check it, so a marketplace registered before 2.1.296 keeps loading.
- `Ve(e,64)` truncates the name to 64 characters and folds `"`/`'` to typographic quotes. It does not change these names.

### R-7 The `<owner>-<repo>` download folder of a registered GitHub marketplace -- confidence high

- `lse(source)` names a github source's download folder `<owner>-<repo>`. Claude Code clones into `marketplaces/<owner>-<repo>/`, uses `.bak` while it downloads again, and renames the folder to `marketplaces/<name>/`.
- `Uqn`/`qhs` refuse an add whose name is that folder of another registered github marketplace. The message is `Can't use the marketplace name "<x>": the registered marketplace "<y>" downloads from GitHub into the folder "<x>" ..., so a marketplace named "<x>" would stop "<y>" from downloading. Ask the author of "<x>" to rename it.` (v2.1.290+). The check skips spellings of reserved names, which `kut` already refuses.
- **This extension:** every marketplace checkout is `sources/<name>/`, staged in `sources-staging/<uuid>/` and renamed into place (`persistence/locations.ts::sourceCloneDir` / `sourcesStagingDir`, `add.ts`, D-MF-04, D-PL5-06). No folder is derived from `<owner>-<repo>`, so the collision this rule prevents cannot happen.

### R-8 A registered marketplace whose name is reserved: the load-time refusal -- confidence high

```js
function Kge(e,n){ if(e===Sn) return n.source?.source==="pluginDirectory"?null:h6r(e,lv());
  let r=BIe(e); if(r!==void 0) return r;            // spellings, incl. case variants of the directory name
  if(!PZ.has(e.toLowerCase())) return null;
  if(typeof n.installLocation==="string"&&I_(n.installLocation)) return null;   // seed-managed
  let s=n.source; if(typeof s!=="object"||s===null) return `The name '${e}' is reserved for official Anthropic marketplaces and its registered source is malformed.`;
  return GTt(e,n.source) }
function rYn(e,n){ let r=Kge(e,n),s=uA(e);
  if(r&&(s||o$t(e)!==void 0)) throw r;               // spelling: the h6r sentence as is
  if(r) throw `Marketplace "${e}" is registered from an untrusted source: ${r} To fix it, remove the marketplace and re-add it from the official source.` }
```

`Kge` and `rYn` are applied to the **registered** name and source, on these surfaces:

| Surface | Code | Effect |
| --- | --- | --- |
| Install, details, getter | `mG` (`rYn(e,w)` before the catalog read) | throws the `registered from an untrusted source` sentence or the spelling sentence |
| `marketplace update <name>` | `$ys` (`rYn(e,y)` before any fetch) | the same throw, surfaced as `Failed to refresh marketplace '<name>': <sentence>` |
| `marketplace update` (all) | `e$s` (`Kge`, then skip) | logs `Skipping marketplace '<name>' in bulk refresh: <sentence>` |
| Catalog load | `zIe` | logs `Refusing to load marketplace '<name>': <sentence>` and returns null, so the catalog is unavailable |
| Plugin load errors (`claude plugin list`, `/plugin` Errors) | `gNe` | one error per **enabled** plugin, `Marketplace <name> failed to load: <Kge sentence>` (`untrustedReservedName: true`). A disabled plugin's error is skipped (`Skipping reserved-name refusal error for disabled plugin`). |

- The docs ("Marketplace is registered from an untrusted source") give the exact `registered from an untrusted source` sentence and say the marketplace and its plugins stop loading. The remedy is `claude plugin marketplace remove <name>`, then re-adding it from `github.com/anthropics`. `marketplace remove` works on such an entry.
- `claude plugin marketplace list` (`bvi`) still lists every registered marketplace. It does not flag a refused one. It only prints a look-alike or non-ASCII name in quotes, with `Shown in quotes: the name looks like one of Anthropic's own, and is not.` (display rule `fP`).

### R-9 Add order -- confidence high

`Lle` (add) -> `But`:

1. Parse the catalog with the full schema. This checks for spaces, control and bidi characters, path separators, look-alikes, and the `Be` names.
2. Run `GTt(declared, source)`.
3. Run the name callback: the admission rule; `kut` (the `claudeai-` prefix, then directory spellings, then other spellings); the plugin-id rule `K$`; the object members; the folder and collision checks.
4. Check that the name is a plain directory name (`Nj`), and run the folder checks `wut`/`Uqn`.
5. Back in `Lle`, run `GTt` again, then write the registry, running `kut` again.

The categories are disjoint, apart from look-alike plus spelling, where the look-alike runs first. Any order that keeps the look-alike before the spelling reports the same sentence for every name.

### R-10 Refresh paths, and a note on D-PL5-27 -- confidence high

- `claude plugin marketplace update <name>` -> `tY` -> `$ys`:
  1. `rYn(registered)` runs before any fetch.
  2. The refresh runs: github and git refresh in place (`SF`), a url source re-downloads (`JVn` -> `$ut`), and file and directory sources re-read in place.
  3. The catalog is parsed with `R3r(use(registered))`: look-alike with grandfathering, `Be` names, the other schema rules.
  - **It does not run `GTt` on the refreshed catalog's name.**
- `claude plugin marketplace update` with no name -> `e$s` skips every `Kge`-refused entry, then refreshes each remaining entry through `But(source, registered, ...)`. `But` **does** run `GTt(declared, source)`, the grandfathered schema, and the folder checks.
- **D-PL5-27** applies `GTt` to the refreshed name on every `marketplace update` path. That matches the bulk path and is stricter than the single-name path. This is recorded for the user, and this task does not change it.
- Neither path checks the `claudeai-` prefix, spellings, or object members on the refreshed catalog's name.

### R-11 Fixture survey -- confidence high

The Python port was run over every marketplace name in `features/`, `test/`, and the manifest fixtures. It checked `marketplace "<x>"` step names, `<plugin>@<x>` ids, table cells, seeded record names, and `marketplace.json` names. Hits that are marketplace names:

- **`constructor`:**
  - `test/orchestrators/marketplace/add.test.ts` "D-08-07: adds a path marketplace named constructor" and "MPA-01 / D-08-07: skips a second add of a marketplace named constructor".
  - `test/integration/reserved-record-keys.test.ts`, the reload case that declares `hello@constructor`.
  - All three add a marketplace named `constructor`, which R-6 now refuses.
- **`anthropic-plugin-directory`, published by the anthropics organization:** `features/plugin/{update-dependencies,install-dependencies,git-source,apply}.feature` (GV-01 scenarios), plus unit tests. These are exact reserved names from `anthropics`, so `GTt` exempts them. Only the decision on the exact directory name (D-PL5-28, below) keeps them addable.
- **None of these trip a rule:**
  - `github`, `npm`, and `gh` appear only as source-kind cells, plugin source kinds, or plugin names.
  - `claude-plugins.json` is a config file name.
  - `café` is an atomic-json payload.
  - The e2e marketplace is renamed `upstream-e2e` (D-PL5-23).

## Pi and project constraints that shape the mapping

- **D-PL5-01/02 (row shape and token):** a refused add is the failed-add row with one failed child that carries Claude Code's sentence, reason `invalid manifest`. No new reason token, so `shared/notification-types.ts` (shared with Phase 3) stays untouched. `ReservedMarketplaceNameError` (subclass of `InvalidMarketplaceManifestError`, `shared/errors.ts`) already selects the child-row shape in `failedAddRow` and reads `invalid manifest` through `narrowProbeError`.
- **D-PL5-27 (refresh row):** the failed block with one failed child. The cause chain is the update frame, then the sentence. A hosted catalog is refused before its rename.
- **D-05-07 (fail-closed dependency walk):** `orchestrators/plugin/dependency-index.ts` fails a scope's walk on any record whose marketplace manifest cannot be read. That walk also runs inside `marketplace remove` and `uninstall`: `features/marketplace/remove.feature` shows `marketplace remove tools` failing `{unreadable}` when tools' manifest is invalid. **A name refusal placed in the manifest reader (`domain/manifest.ts`) or in the dependency walk would therefore block `marketplace remove`, which is upstream's remedy.** The refusal has to live on the surfaces that read a catalog to install, list, describe, refresh, or load, and stay out of the reader and the walk.
- **DLS-01 / DLS-D1 (`orchestrators/reconcile/delisted-plugins.ts`):** the established Pi counterpart of an upstream per-plugin load error. Each load, it reports one `plugin-declarer-unreadable` warning row for every enabled plugin, with upstream's words as the cause. The plugin keeps working, and a disabled plugin gets no row, as upstream skips it.
- **APL-D1:** a load changes no installation state. Already-materialized agents, MCP entries, and workflows are read by Pi and its companion extensions, not by this extension at load. So "stops loading, along with its plugins" maps to a warning, not to unloading. This is a Pi capability gap plus APL-D1.
- **GV-01** treats `anthropic-plugin-directory` as a marketplace a Pi user adds from the anthropics organization. Pi has no built-in Anthropic Directory to own the name.
- **D-08-07 (OWNKEY-01)** keeps `Object.prototype` member names valid for plugin and marketplace names. R-6 narrows it for marketplace adds only.
- **NFR-5:** every new check is pure and offline.

## Proposed mapping (recorded as D-PL5-28)

| Rule | add | `marketplace update` (+ autoupdate) | load surfaces (session start, `plugin list`, `plugin info`, `marketplace info`, `plugin install`) |
| --- | --- | --- | --- |
| R-1 exact reserved (D-PL5-01) | unchanged | unchanged (D-PL5-27, on the refreshed name) | **new:** the record's own name and source -> `Marketplace "<name>" is registered from an untrusted source: <sentence> To fix it, ...` |
| R-2 look-alike | full `f4e` on the declared name -> `c$e`. A D-PL5-17 repair is grandfathered against the record it repairs. | grandfathered against the record name -> `c$e` | grandfathered against the record name -> `Claude Code refuses the marketplace name "<record>": it looks like one of Anthropic's own` |
| R-3 `Be` names | -> `Marketplace name "<lc>" is reserved for <description>` | the same | the same |
| R-4 `claudeai-` | -> sentence, without the `--claudeai` remedy | -- | -- |
| R-5 spelling | -> `Lbe`/`mdi` | the record's own name, before any fetch -> `Lbe`/`mdi` | the record's own name -> `Lbe`/`mdi` |
| R-6 object member | -> sentence, skipped when the scope already records the name | -- | -- |
| R-7 folder | not ported | -- | -- |

Every refusal throws `ReservedMarketplaceNameError` (`invalid manifest`). The load-surface results follow each surface's existing invalid-manifest form:

- **Session start:** a `(failed)` warning row per enabled plugin, carrying the sentence. The plugin keeps working.
- **`plugin list`:** the bare `(failed)` marketplace header.
- **`marketplace info` and `plugin info`:** `(failed) {invalid manifest}`.
- **`plugin install`:** the install's failure row, carrying the sentence.

### Divergences and their licenses

1. **The exact `anthropic-plugin-directory` from the anthropics organization stays addable and loadable.** Upstream refuses it through `kut`/`uA` and `Kge`. Its other spellings are still refused, with `Lbe`. License: Pi capability gap (no built-in Anthropic Directory owns the name) plus GV-01.
2. **R-7 (`<owner>-<repo>` folder) is not ported.** License: recorded storage decisions D-MF-04 and D-PL5-06, under which no folder can collide.
3. **The `claudeai-` sentence drops `(claude plugin marketplace add --claudeai <name>)`.** License: Pi capability gap (no claude.ai-hosted marketplaces, no `--claudeai`).
4. **The spelling refusal on load surfaces uses the add-time sentence (`mdi`/`Lbe`) instead of `h6r`.** `h6r` names `known_marketplaces.json` and the `claude` CLI. License: Pi capability gap (neither exists in Pi).
5. **The load-surface wording is unified.** Upstream's plugin load error for an exact reserved name reads `Marketplace <name> failed to load: <sentence>`, while its getter (install) uses the `registered from an untrusted source` sentence. Pi uses the latter on every load surface. Upstream's getter wording for a look-alike (`Claude Code refuses this marketplace's name: ... Remove it in /plugin → Marketplaces ...`) names the `/plugin` UI. Pi uses the plugin-list wording (`Claude Code refuses the marketplace name "<name>": ...`) on every load surface. **No license covers the first half; it is a choice for user review.** The second half has the capability-gap license.
6. **The plugins of a refused marketplace keep working.** Pi warns at every load, and `install` and `info` refuse. License: APL-D1 plus a Pi capability gap. `marketplace remove` and `uninstall` keep working, because remove is upstream's remedy and the D-05-07 walk would otherwise block it.
7. **Not gated** (upstream's getter or catalog-unavailable state would fail them): `pending`, `apply` planning, `plugin update` (including the PUP-2 marketplace sync, Phase 7's file), `reinstall`, `enable`, `fetch`, and completions. **Known gap for user review.**
8. **A catalog renamed under a record (declared ≢ recorded):** a load surface applies the grandfathered look-alike rule exactly. A rename to another spelling on refresh is not refused, as upstream does not refuse it (R-10).
9. **The five `__` object members:** `__proto__` keeps its D-08-07 refusal (`marketplace.json schema invalid: name "__proto__" is reserved`). The other four get the R-6 sentence, where upstream gives the plugin-id (`K$`) sentence. `K$` is not part of MKTNAME-01.

### Not in scope (adjacent upstream rules, candidate backlog entries)

- **The plugin-id rule `K$`:** `Cannot add marketplace "<name>": Claude Code cannot install plugins from a marketplace with this name. ...` (v2.1.295+).
- **The remaining schema rules:**
  - No spaces: `Marketplace name cannot contain spaces. ...`.
  - The separate `cannot contain control or bidirectional-formatting characters` issue. A control or non-ASCII character still fails R-2 here, with the impersonation sentence.
  - No path separators or `..`.
- **The `marketplace list` quoting of look-alike names (`fP`):** a display rule, not a refusal.
- **Plugin-name reservations:** `Plugin name "x" is reserved: it passes as one of Anthropic's own`.

## Open questions for the user

1. Divergence 5 (one sentence per rule on the load surfaces).
2. Divergence 7 (the commands that stay ungated).
3. Whether D-PL5-27's `GTt` on the refreshed name should be narrowed to the bulk path (R-10).
