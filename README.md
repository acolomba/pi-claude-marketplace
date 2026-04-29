# Pi Claude Marketplace

Access Claude plugin marketplaces from Pi.

This package will provide a Pi extension for discovering Claude plugin marketplaces and adapting marketplace plugin resources for Pi where possible.

## Development

```bash
npm install
npm run check
```

Install pre-commit hooks:

```bash
pre-commit install
pre-commit install --hook-type commit-msg
```

## Package layout

- `extensions/claude-marketplace.ts` -- Pi extension entry point
- `docs/plans/` -- design and implementation plans
