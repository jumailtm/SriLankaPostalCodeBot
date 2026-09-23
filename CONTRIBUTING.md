# Contributing

Focused issues and pull requests are welcome after the repository is published.

## Before making changes

1. Read the project README and `SECURITY.md`.
2. Create a focused branch.
3. Keep credentials in your ignored local `.env` only.
4. Do not add invented postal records or silently alter official-source data.

## Development checks

Run the complete local gate before opening a pull request:

```bash
npm install
npm run typecheck
npm test
npm run test:security
npm run build
npm run security:scan
```

Tests must use mocks or an isolated test strategy and must never connect to the production Neon database.

## Pull requests

- Keep each change small and explain its purpose.
- Add or update tests for behavior changes.
- Preserve strict TypeScript settings.
- Avoid unnecessary dependencies and frameworks.
- Do not include raw Telegram updates, user details, database exports, or credentials.
- Keep source attribution intact when changing the postal dataset pipeline.

## Postal data changes

Postal information must come from the official Department of Posts, Sri Lanka sources documented in the README. Run collection validation and review its report before importing or committing a regenerated dataset. Do not fill missing fields by guessing.

## License status

No open-source license has been selected yet. The repository owner must add one before granting general reuse rights. Contributions should not assume a license that has not been recorded in a `LICENSE` file.
