# Contributing

## General

This project welcomes issues and pull requests.

## Responsible AI contributions

The use of generative AI is welcome, provided these conditions are met:

- **Human ownership:** You as a human are responsible for the contents of your contribution.
- **Human oversight and expertise:** Please review, validate, and revise issues and pull requests with your own expertise so they reflect your personal understanding and voice.

## Development setup

Prerequisites:

- [Pi Coding Agent](https://pi.dev/)
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)
- [git-lfs](https://git-lfs.com/)
- [pipx](https://pipx.pypa.io/stable/)

Run this command to set up development tools and dependencies in a fresh clone or worktree.

```bash
./scripts/init.sh
```

It installs:

- [pre-commit](https://pre-commit.com/#installation)
- [gsd-core](https://github.com/open-gsd/gsd-core)
- [codegraph](https://github.com/colbymchenry/codegraph)

## Checks

```bash
npm run check          # typecheck, lint, fallow, format check, gate scripts, unit + integration tests
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```

## Vendored skills

Every skill lives under `.agents/skills/`, `.claude/skills/` holds symlinks to them, and Pi reads `.agents/skills/` directly. Some of them are vendored from other repositories: `skills-lock.json` names each vendored skill and its source, and `THIRD_PARTY_NOTICES.md` records its version and license. A skill absent from `skills-lock.json` is written in this repository and needs neither entry.

To update a skill:

```bash
npx skills@latest update <name> -p -y
npx skills@latest remove <name> -a pi -y
```

The installer copies the skill directory only, and some upstream repositories keep the license at the repository root. The `update` command links every agent whose directory exists, so it creates a `.pi/skills/` symlink. The `remove -a pi` command deletes only that link. After an update, check that the `LICENSE` file is still in place, and record the new version and commit in `THIRD_PARTY_NOTICES.md`.
