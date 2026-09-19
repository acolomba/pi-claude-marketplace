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

## Third-party skills

Every skill lives under `.agents/skills/`, `.claude/skills/` holds symlinks to them, and Pi reads `.agents/skills/` directly. Skills written in this repository are tracked. Skills from other repositories are not: `skills-lock.json` names each one and its source, `.gitignore` excludes its directory, and `./scripts/init.sh` restores it from the lock.

To add a skill:

```bash
npx skills@latest add <owner/repo> -y
npx skills@latest remove <name> -a pi -y
```

The first command copies the skill to `.agents/skills/<name>/`, links it from `.claude/skills/<name>`, and records it in `skills-lock.json`. It also links it from `.pi/skills/`, which would register it twice in Pi, so the second command deletes that link. Then add `/.agents/skills/<name>/` to `.gitignore` and commit the link and the lock.

To update a skill:

```bash
npx skills@latest update <name> -p -y
npx skills@latest remove <name> -a pi -y
```

Commit the refreshed `skills-lock.json`.
