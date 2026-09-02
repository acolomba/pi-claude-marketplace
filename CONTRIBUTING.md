# Contributing

## General

This project welcomes issues and pull requests.

## Responsible AI contributions

The use of generative AI is welcome, provided these conditions are met:

- **Human ownership:** You as a human are responsible for the contents of your contribution.
- **Human oversight and expertise:** Please review, validate, and revise issues and pull requests with your own expertise so they reflect your personal understanding and voice.

## Development setup

Prerequisites:

- [Open GSD](https://www.opengsd.net/), specifically [gsd-core](https://opengsd.net/products/gsd-core).

```bash
npm install
npx @opengsd/gsd-core@latest --install --local
git lfs install
pre-commit install
pre-commit install --hook-type commit-msg
```

## Checks

```bash
npm run check          # typecheck, lint, fallow, format check, unit + integration tests
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```

## Vendored skills

The skills under `.agents/skills/` come from other repositories. `.claude/skills/` and `.pi/skills/` hold symlinks to them. `skills-lock.json` records their source, and `THIRD_PARTY_NOTICES.md` records their version and license.

To update a skill:

```bash
npx skills@latest update <name> -p -y
```

The installer copies the skill directory only, and some upstream repositories keep the license at the repository root. After an update, check that the `LICENSE` file is still in place, and record the new version and commit in `THIRD_PARTY_NOTICES.md`.
