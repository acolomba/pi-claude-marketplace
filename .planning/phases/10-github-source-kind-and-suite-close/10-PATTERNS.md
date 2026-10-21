# Phase 10: GitHub Source Kind and Suite Close - Pattern Map

**Mapped:** 2026-10-21
**Files analyzed:** 22 (new or modified)
**Analogs found:** 21 / 22 (every file has an in-repo analog, except CHANGELOG wording, which follows the changelog skill)

All analog paths below are git-tracked source (none under `.gsd/` or other mirrors).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/e2e/_rpc.ts` (`RpcGitEnvironment`, `rpcChildEnvironment`) | test driver / config | request-response (env allowlist) | itself, lines 45-53 and 179-197 (add a 4th key exactly like the 3 git keys) | exact |
| `features/support/pi-process.ts` (override value; IN-07 BeforeAll/AfterAll) | test support / lifecycle hook | event-driven | itself, lines 56-120; IN-07 cleanup mirrors `world.release()` | exact |
| `tests/architecture/hermetic-git-environment.test.ts` | test (architecture) | transform | itself, lines 71-110 | exact |
| `features/lib/published-marketplace.ts` (github arms; drop `noStandIn`) | library (fixture dispatch) | file-I/O | its own `url` arms, lines 112-127, 150-163, `publishMarketplaceIn`, `removePublishedSource`, `publishUnreadableSkillFile` | exact |
| `features/lib/git-marketplace.ts` (+ branch-publishing helper; header) | library (fixture) | file-I/O (git) | `pushGitRepository`, lines 37-43 | exact |
| `features/lib/https-git-host/cgi.ts` (HOST-EPIPE) | stand-in library | streaming (CGI stdin/stdout) | itself, lines 135-163 | exact |
| `features/lib/https-git-host/server.ts` (IN-03, IN-06, IN-09; maybe owner export) | stand-in library | request-response | itself, lines 60-64, 86-90, 167-179, 230-248, 400-412 | exact |
| `features/step_definitions/marketplace/git-host.steps.ts` (IN-04 comment; possible branch step) | step definitions | request-response | itself, lines 28-76 | exact |
| `features/step_definitions/marketplace/publishing.steps.ts` (branch step, option a) | step definitions | file-I/O | `the marketplace {string} is published as a {source kind} source`, lines 46-58 | exact |
| `features/marketplace/github-source.feature` (NEW: SRC-02, SRC-03, github add-401 Outline per D-11) | feature (behavioral test) | request-response | `features/marketplace/url-source.feature` lines 1-40, 112-144 | role-match |
| `features/marketplace/git-source.feature` (D-09/D-10 Outlines; folded url 401 add scenario) | feature | request-response | itself, lines 1-60 (tagged `@url`/`@github` Examples) | exact |
| `features/marketplace/url-source.feature` (loses the two 401 add scenarios) | feature | request-response | itself, lines 112-144 (move out) | exact |
| `features/marketplace/info.feature` (git rows at `#stable`, D-03/IN-11) | feature | request-response | itself, lines 30-46 | exact |
| `features/marketplace/unsupported-source.feature` (IN-05 description) | feature | request-response | itself, lines 3-5, 17, 23-24 | exact |
| `.agents/skills/cucumber/rules/steps.md`, `rules/features.md`, `SKILL.md` (IN-05 amend; exclusion paragraph) | docs/rules | n/a | existing paragraphs | exact |
| `cucumber.json` (remove `"tags": "not @github"`) | config | n/a | itself | exact |
| `extensions/pi-claude-marketplace/domain/source.ts` (P-1 `#ref` shorthand) | domain (parser) | transform | `parseShorthandSourceForm` `@` arm, lines 406-424 | exact |
| `tests/domain/source.test.ts` (P-1 cases) | test (unit, paired) | transform | table rows lines 75-145 | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` or `shared.ts` (P-2 remedy line) | orchestrator | request-response (network) | `refreshUrlClone`, `shared.ts` lines 346-392 | exact |
| `tests/orchestrators/marketplace/update.test.ts` / `shared.test.ts` (P-2 cases) | test (unit, paired) | request-response | `GHB-02` case, `update.test.ts` 5208-5240; url remedy cases `update.test.ts:518, :996, :1034`, `shared.test.ts:735` | exact |
| `tests/architecture/https-git-host-cgi.test.ts` (IN-01, IN-10) | test (architecture) | transform / request-response | itself, lines 83-89 and the status-message loop below | exact (IN-01) / partial (IN-10: no live-host case exists yet) |
| `docs/json-output.md:580`, `CHANGELOG.md` (IN-02, IN-08, P-1, P-2 lines) | docs | n/a | `CHANGELOG.md` lines 3-12 (sub-bullet shape) + `.agents/skills/changelog/rules/entries.md` | role-match |
| `.planning/phases/09-*/09-REVIEW-DISPOSITION.md` (to `open: 0`) | planning ledger | n/a | its own `deferred` rows | exact |

## Pattern Assignments

### `tests/e2e/_rpc.ts` (test driver, env allowlist)

**Analog:** itself. Interface (lines 45-53):
```ts
export interface RpcGitEnvironment {
  readonly NODE_EXTRA_CA_CERTS: string;
  readonly GIT_CONFIG_NOSYSTEM: "1";
  readonly GIT_CONFIG_GLOBAL: string;
}
```
Copy loop (lines 184-197) -- add one line, same shape:
```ts
  if (git !== undefined) {
    environment.NODE_EXTRA_CA_CERTS = git.NODE_EXTRA_CA_CERTS;
    environment.GIT_CONFIG_NOSYSTEM = git.GIT_CONFIG_NOSYSTEM;
    environment.GIT_CONFIG_GLOBAL = git.GIT_CONFIG_GLOBAL;
    // + environment.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL = git.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL;
  }
```
Update the doc comment above the interface (lines 45-48) to name the override (GHB-02, D-MF-01).

---

### `features/support/pi-process.ts` (lifecycle hooks)

**Analog:** itself, `BeforeAll` lines 56-83:
```ts
  const gitHost = await HttpsGitHost.start(path.join(root, "git-host"));
  const piEnvironment = {
    NODE_EXTRA_CA_CERTS: gitHost.certificatePath,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(sandbox.home, ".gitconfig"),
    // + PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: `https://${gitHost.address}`,
  } satisfies RpcGitEnvironment;
  piRun = { root, sandbox, marketplacesRoot: ..., gitHost, piEnvironment,
    pi: await PiProcess.start(sandbox, piEnvironment) };
```
The `Before` restart path (`PiProcess.start(run.sandbox, run.piEnvironment)`, lines 87-92) reuses the object, so no second change. IN-07: today `AfterAll` (lines 115-120) is three sequential awaits:
```ts
AfterAll(async (): Promise<void> => {
  const run = currentRun();
  await run.pi.stop();
  await run.gitHost.close();
  await rm(run.root, { recursive: true, force: true });
});
```
Wrap `PiProcess.start` in `BeforeAll` in try/catch (close host, `rm(root)`, rethrow); in `AfterAll` run each stage in its own try, collect failures, throw one `AggregateError` (the `world.release()` pattern in `features/support/world.ts`).

---

### `tests/architecture/hermetic-git-environment.test.ts`

**Analog:** itself, lines 71-110. Whole-object `deepStrictEqual` with AAA comments:
```ts
  test("adds the three git keys to the allowlist and no inherited git variable", (t) => {
    // arrange
    inheritGitVariables(t);
    const git = { NODE_EXTRA_CA_CERTS: "/run/cert.pem", GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig" } satisfies RpcGitEnvironment;
    // act
    const environment = rpcChildEnvironment(sandbox, git);
    // assert
    assert.deepStrictEqual(environment, { HOME: "/sandbox/home", ..., GIT_CONFIG_GLOBAL: "/sandbox/home/.gitconfig" });
  });
```
Change the title ("three git keys" -> four keys / "the git keys and the override"), add the override to both `git` and the expected object, and plant `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` in `inheritGitVariables` so the "returns only the allowlist" case proves an operator's own value is not inherited.

---

### `features/lib/published-marketplace.ts` (fixture kind dispatch)

**Analog:** its url arms. `changePublication` (lines 112-127):
```ts
  switch (published.kind) {
    case "dir":
    case "file":
      await write();
      return;
    case "url":
      await write();
      await pushGitRepository(published.root, published.gitHome);
      return;
    case "github":
      throw noStandIn(published.kind);
  }
```
Replace with `case "url": case "github":` fall-through. Same for `requireFreeRoot` (lines 150-163), `publishMarketplaceIn`, `removePublishedSource`. `publishUnreadableSkillFile`'s github arm throws the same "a git repository cannot hold a file nobody may read" error as url. The only difference is `source`: `` `acme/${directory}` `` vs `gitHost.repositoryUrl(directory)` (RESEARCH Code Examples). Delete `noStandIn` (lines 103-105) once unused (fallow dead-code). Avoid a second `acme` literal: export `OWNER` from `server.ts` (line 32) or add a `GitRepositoryHost` method returning the shorthand. Update the file header.

---

### `features/lib/git-marketplace.ts` (git fixture)

**Analog:** `pushGitRepository` (lines 37-43):
```ts
export async function pushGitRepository(workTree: string, home: string): Promise<void> {
  await runGit(workTree, home, "add", "-A");
  await runGit(workTree, home, "commit", "-q", "--allow-empty", "-m", "publish");
  await runGit(workTree, home, "push", "-q", "origin", "main");
}
```
New branch helper uses the same `runGit(workTree, home, ...)` sequence: `checkout -q -b stable`, write, `add -A`, `commit`, `push -q origin stable`, `checkout -q main` (must return to `main` so later republishes leave `stable` alone). For RESEARCH Pattern 3(b), `pushGitRepository` would push `main` and `main:stable`. Doc comment style: one `/** ... */` stating behavior and the HOME. Update the header line "the github kind will share it".

---

### `features/lib/https-git-host/cgi.ts` (HOST-EPIPE, D-14)

**Analog:** itself, `runHttpBackend` lines 135-163:
```ts
    child.on("error", reject);
    child.stdin.on("error", reject);   // <- replace
    ...
    child.stdin.end(body);
```
Replacement (trialled):
```ts
// A backend that needs no body may exit before it reads stdin; its exit code decides.
child.stdin.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") {
    reject(error);
  }
});
```

---

### `features/lib/https-git-host/server.ts` (IN-03, IN-06, IN-09)

**Analog:** itself. `answerServerError` (lines 230-248):
```ts
function answerServerError(logged: LoggedRequest, res: ServerResponse): void {
  logged.status = 500;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  ...
}
```
IN-09: move `logged.status = 500` below the `headersSent` branch; that branch sets `"dropped"` (widen the `GitHostRequest.status` doc at lines 86-90). IN-06: in `receive` (around lines 400-412, `const arm = armFor(this.arms, logged.path);`) decode the pathname once in a try, answer 500 on `URIError`, pass the decoded path to `armFor`; keep `logged.path` as sent. IN-03: doc at lines 60-64 says "every request".

---

### `features/step_definitions/marketplace/publishing.steps.ts` / `git-host.steps.ts` (branch step, if option a)

**Analog:** `publishing.steps.ts` lines 46-58:
```ts
Given(
  "the marketplace {string} is published as a {source kind} source",
  async function (this: ScenarioWorld, name: string, kind: SourceKind) {
    if (this.publishedMarketplace(name) !== undefined) {
      assert.fail(`the marketplace ${name} is already published in this scenario`);
    }
    const root = await requireFreeRoot(this.publicationSites, name, kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    this.recordPublished(name, await publishMarketplace(this.publicationSites, name, kind, []));
  },
);
```
A branch step resolves `this.requirePublished(name)` and delegates to a `published-marketplace.ts` function that fails loudly for `dir`/`file` (as `git-host.steps.ts` lines 20-26 `publishedRepository` does with `assert.fail(... is not published as a git source)`). Steps stay kind-agnostic; the library dispatches.

IN-04: rewrite the comment at `git-host.steps.ts:86-87` per 09-REVIEW wording.

---

### `features/marketplace/github-source.feature` (NEW)

**Analog:** `features/marketplace/url-source.feature`. Header and first scenario (lines 1-23):
```gherkin
Feature: Marketplace url source

  A url source is an https git URL that Pi clones the marketplace from.
  ...

  Scenario: Adding a url marketplace clones it from the git host
    Given the marketplace "tools" is published as a url source
    When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | project | added  |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source                            |
      | tools | https://{git host}/acme/tools.git |
    Then the git host receives these requests:
      | method | path                                              | status |
      | GET    | /acme/tools.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/tools.git/git-upload-pack                   | 200    |
```
Title must be `Feature: Marketplace github source` (check-features rule). Scenarios are untagged (single-kind file) and run from their first commit, so this file lands after the override wiring, fixture arms, and P-1. SRC-02 Outline: Examples column `source` with 6 spellings; declaration column pinned verbatim (RESEARCH measured table); info result fields `source kind github`, `source owner acme`, `source repo tools` (step from `info.feature` lines 14-28). SRC-03: `@stable`, `#stable`, URL `#stable` rows asserting `description` + `source ref` from one `marketplace info` When. D-11 github add-401 Outline: 3 rows, child-row cause chain `The operation was canceled., fetched https://{git host}/acme/tools.git`.

---

### `features/marketplace/git-source.feature` (D-09/D-10 Outlines)

**Analog:** itself, lines 7-34 (tagged Examples per kind):
```gherkin
  Scenario Outline: A removed git marketplace can be added again from the same source
    Given the marketplace "tools" is published as a <source kind> source
    ...
    Then the git host receives these requests:
      | method | path                                                | status |
      | GET    | <repository path>/info/refs?service=git-upload-pack | 200    |

    @url
    Examples:
      | source kind | scope   | source                            | repository path |
      | url         | project | https://{git host}/acme/tools.git | /acme/tools.git |

    @github
    Examples:
      | source kind | scope   | source     | repository path |
      | github      | project | acme/tools | /acme/tools.git |
```
Folded url 401 scenarios come from `url-source.feature` lines 112-144 (no-credential stays a single url scenario per D-11; with-credential becomes the D-09 Outline). Credential steps: `Given the git host requires the user "alice" with the password "s3cret" for the marketplace "tools"` and `Given the user has stored a credential for the git host with the user "alice" and the password "s3cret"` (`git-host.steps.ts` 45-76). Update-401 cause cell must escape: `printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve`; never name a column `user` or `token`.

---

### `features/marketplace/info.feature` (D-03 / IN-11)

**Analog:** itself, lines 36-44:
```gherkin
    @url
    Examples:
      | source kind | source                                 | expected source kind | ... | source ref |
      | url         | https://{git host}/acme/tools.git#main | url                  | ... | main       |

    @github
    Examples:
      | source kind | source          | expected source kind | ... | source ref |
      | github      | acme/tools#main | github               | ... | main       |
```
Switch both to `#stable` (requires the stable branch fixture choice, Pattern 3(b), and P-1 for the github row).

---

### `extensions/pi-claude-marketplace/domain/source.ts` (P-1, D-12)

**Analog:** the `@` arm, lines 406-424:
```ts
function parseShorthandSourceForm(raw: string): ParsedSource {
  const atIdx = raw.lastIndexOf("@");
  if (atIdx !== -1) {
    const github = parseOwnerRepo(raw.slice(0, atIdx), raw);
    const ref = raw.slice(atIdx + 1);
    if (github.kind === "github" && ref.length > 0) {
      return { ...github, ref };
    }
    return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
  }
  ...
```
Add a `#` arm before it. D-12 divergence from the RESEARCH trial: an empty ref (`acme/tools#`) is accepted as no ref, so return `github` (without `ref`) when `ref.length === 0`, matching the URL form's "drops an empty GitHub reference" behavior. Update the doc comment above (lines 400-405) with D-12 and the recorded upstream divergence. Fix it test-first: the failing `info.feature` row (or the SRC-03 row) is the RED evidence.

### `tests/domain/source.test.ts`

**Analog:** table rows, lines 75-85 and 127-145:
```ts
  {
    name: "parses an owner and repository shorthand with a reference",
    raw: "acme/tools@v2.0",
    source: { kind: "github", raw: "acme/tools@v2.0", owner: "acme", repo: "tools", ref: "v2.0" },
  },
  {
    name: "drops an empty GitHub reference",
    raw: "https://github.com/o/r#",
    source: { kind: "github", raw: "https://github.com/o/r#", owner: "o", repo: "r" },
  },
```
Add rows: `acme/tools#stable` (ref `stable`), `acme/tools#` (github, no ref, D-12), `acme#x` (unknown), so the new arm reaches 100% direct coverage.

---

### `orchestrators/marketplace/update.ts` or `shared.ts` (P-2, D-13)

**Analog:** `refreshUrlClone`, `shared.ts` lines 377-392:
```ts
  try {
    await refreshGitHubClone(cloneDir, source.ref, gitOps, onFetchSucceeded, auth);
  } catch (err) {
    if (
      err instanceof Error &&
      err.cause === undefined &&
      classifyGitTransportFailure(err) === "authentication required" &&
      auth.kind === "stored-credential" &&
      !(err instanceof CrossOriginChallengeError)
    ) {
      err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(host));
    }
    throw err;
  }
```
The github arm (`update.ts` lines 382-409) builds `auth = buildGitHubAuth(...)` and calls `refreshGitHubClone` bare. The github variant cannot use `err.cause === undefined` (the `FetchedUrlCause` fills it); it wraps instead, so the remedy sits before the `fetched` tail:
```ts
err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(auth.host), { cause: err.cause });
```
Guard on `auth.kind === "stored-credential"` (false when the override is unset, so GHB-04 byte-identity holds). `classifyGitTransportFailure` is already imported in `update.ts` (line 117): do not re-import. Prefer a `shared.ts` helper beside `refreshUrlClone`; comment cites GAUTH-04 / GHB-01 / D-13.

### `tests/orchestrators/marketplace/update.test.ts` (P-2)

**Analog:** `GHB-02` case, lines 5208-5240:
```ts
test("GHB-02: updating a GitHub marketplace under the override fetches with the override-host bundle", async (t) => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example:8443/git");
    await seedGithubMarketplace({ cwd, name: "ref-mp", ref: "main" });
    const { ctx, run, notifications } = makeCtx();
    const { credOps: credentialOps } = createCredentialOps();
    const { gitOps, state } = createGitOps({ remoteRefs: { ... } });
    // act
    await updateMarketplace({ completionCache: createCompletionCache(), ctx, run, name: "ref-mp",
      scope: "project", cwd, gitOps, credentialOps });
    // assert
    assert.deepStrictEqual(notifications, [ ... ]);
  });
});
```
New case: same setup, `createGitOps` configured to throw an auth failure with a fetched-URL cause; assert the full cause chain order. Also a no-override case proving the device-flow arm is unchanged. Url remedy precedents: `update.test.ts:518, :996, :1034`, `shared.test.ts:735`.

---

### `tests/architecture/https-git-host-cgi.test.ts` (IN-01, IN-10)

**Analog:** lines 83-89:
```ts
  test("throws on output with no blank line after its headers", () => {
    // arrange
    const backendOutput = Buffer.from("Content-Type: text/plain\r\nok");
    // act & assert
    assert.throws(() => parseCgiResponse(backendOutput), Error);
  });
```
IN-01: replace `Error` with `{ name: "Error", message: "the CGI response has no blank line after its headers" }`; add `Buffer.from("NoColon\r\n\r\n")` expecting `the CGI response header "NoColon" has no colon`. The status loop right below (`{ status, expectedMessage }` table) is the shape for message-pinned negatives. IN-10 (no live-host analog in this file): start `HttpsGitHost` in a `mkdtemp` root, request `/acme/%E0%A4%A.git/info/refs` via `node:https` with `ca: readFileSync(host.certificatePath)`, assert 500, a logged 500, and a second request answered; `t.after(() => host.close())`.

---

### `CHANGELOG.md`, `docs/json-output.md`

**Analog:** `CHANGELOG.md` lines 3-12 (top-level bullet plus indented sub-bullets):
```markdown
- An empty argument now fails with a message that names it, such as `Source must not be empty.` ...

  - Plugin commands report an empty `<plugin>@<marketplace>` as `Plugin name must not be empty.`. ...
```
IN-02 folds lines 5-7 into this branch's single entry as sub-bullets with short sentences; add P-1 and P-2 lines. Read `.agents/skills/changelog/rules/entries.md` first. Markdown is formatted by mdformat, not prettier.

## Shared Patterns

### Kind dispatch lives in the library, not in steps
**Source:** `features/lib/published-marketplace.ts` (switch on `SourceKind`); `git-host.steps.ts` lines 20-26 (`publishedRepository` fails loudly for non-git kinds).
**Apply to:** every github arm and any branch step. Never a Given that silently no-ops for path kinds.

### Tagged Examples per kind
**Source:** `features/marketplace/git-source.feature` lines 24-34, `info.feature` lines 36-44.
**Apply to:** D-09/D-10 Outlines. `@url` and `@github` blocks; single-kind files stay untagged.

### Request-log assertions only in git-kind feature files
**Source:** `git-host.steps.ts` lines 77-90 (`the git host receives these requests:` / `receives no request`); `.agents/skills/cucumber/rules/steps.md`.
**Apply to:** `github-source.feature`, `git-source.feature`; IN-05 amends the rule for `unsupported-source.feature`.

### Credential in the sandbox only
**Source:** `git-host.steps.ts` lines 59-76 (writes `.gitconfig` + `.git-credentials` mode 0600 keyed to `this.gitHost.address`, registered with `onRelease`).
**Apply to:** every with-credential scenario; it already matches the override auth host.

### Unit test shape
**Source:** `tests/orchestrators/marketplace/update.test.ts` 5208-5240; `tests/domain/source.test.ts` row tables.
**Apply to:** P-1, P-2 cases. `// arrange` / `// act` / `// assert`, `withHermeticHome`, titles cite durable IDs (GHB-0N, D-12, D-13), no phase numbers.

### Error-cause chaining
**Source:** `shared.ts` lines 377-392; `auth-host.ts` lines 124-125 (`NO_STORED_CREDENTIAL_CAUSE`).
**Apply to:** P-2. Wrap with `{ cause }`, never re-stringify.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| IN-10 live `HttpsGitHost` case in `tests/architecture/https-git-host-cgi.test.ts` | test | request-response | No architecture test starts the host today; use RESEARCH's IN-10 recipe. |

## Metadata

**Analog search scope:** `features/{lib,support,step_definitions,marketplace}`, `tests/{e2e,architecture,domain,orchestrators/marketplace}`, `extensions/pi-claude-marketplace/{domain,orchestrators/marketplace}`, `CHANGELOG.md`
**Files scanned:** 16
**Pattern extraction date:** 2026-10-21
