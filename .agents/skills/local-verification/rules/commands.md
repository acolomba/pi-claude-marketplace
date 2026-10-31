# Commands

Part of the `local-verification` skill: `.agents/skills/local-verification/SKILL.md`.

`npm run check:static` runs type checking, ESLint, the workflow install-script check, Fallow, the Prettier check, source/test pairing, and the feature-file check at the same time. The feature-file check, `npm run check:features`, dry-runs every cucumber scenario without starting Pi, including the rows that `cucumber.json` excludes. It fails on an unused, undefined, or ambiguous step, and on a broken rule for feature files. Locally it prints one line for each passing step and the full output of each failing step. A warning fails its step: ESLint runs with `--max-warnings 0`, and Prettier, Fallow, and the gate scripts fail on every finding. Fallow also fails when a rule-pack rule matches no file.

`npm run check:commit` runs `check:static`, then the unit tests that have no source pair (`test/architecture/` and the four fake contract suites), then direct coverage for the staged source-test pairs. It reads only the staged files. Unstaged edits and untracked files do not count. It runs all pairs when a staged file can change the coverage of any pair: a file under `test/` that is not a `.test.ts` file (a fake, contract, fixture, or harness), `scripts/test-coverage-direct.mjs`, `scripts/test-reporter.mjs`, `package.json`, `package-lock.json`, or `tsconfig.json`.

`npm run check` runs `check:static`, the unit tests that have no source pair, the integration suite, the behavioral tests under `features/`, and direct coverage for all pairs. `check:commit` does not run the behavioral tests. Direct coverage runs the test of each pair alone and requires 100% line, function, and branch coverage of its source. Every source has exactly one paired test, so this also covers the whole unit suite.

Locally, the test and direct coverage steps print nothing when they pass. The all-pair run also prints one `Merged LCOV` line. A failing test prints Node's report and the count line, and a coverage shortfall names the source and its coverage.

In CI, every check prints at info level. GitHub Actions sets the `CI` variable, and the checks print everything when it is not empty. Tests print each result and the skip and todo counts. `check:static` also prints the output of passing steps. Fallow prints its progress lines and the full duplication report. Direct coverage adds one line for each pair and a run summary. A warning still fails its check.

Use the owner test (`node --test <test-path>`) or a named suite (`test:modules`, `test:architecture`, `test:integration`, `test:cucumber`, `test:e2e`) for feedback while you edit. Run one named unit test with `node --test --test-name-pattern '<title>' <test-path>`, one source/test pair's direct coverage with `npm run test:coverage:direct -- <path>`, where `<path>` is the source or its test, and one scenario with `npx cucumber-js --name '<scenario title>'`. Set `TEST_CONCURRENCY` to a positive integer to limit concurrent tests and coverage workers.

ESLint keeps a cache in `node_modules/.cache/eslint/`. The cache keys each result to the file's content and the configuration. Typed rules also read other files' types, so a cached pass can be stale after another file changes. CI lints from an empty cache and is the backstop. To lint fresh locally, delete that directory first. TypeScript and Prettier also use native disposable caches.
