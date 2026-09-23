# Security policy

## Supported version

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Do not open a public issue containing a token, database URL, webhook secret, private Telegram update, database export, or other sensitive detail.

Use GitHub private vulnerability reporting if it is enabled for the repository. Otherwise, contact the repository owner privately and share only the minimum information required to reproduce the issue.

## Credential handling

- Store local credentials only in the ignored `.env` file.
- Store production credentials only in Vercel Environment Variables.
- Keep `.env.example` limited to empty placeholders.
- Never include real credentials in tests, fixtures, documentation, screenshots, logs, or commits.
- Rotate a credential immediately if it appears outside its intended secret store.
- If a credential enters Git history, revoke it first and rewrite the history before publishing.

## Pre-push checks

Run:

```bash
npm run typecheck
npm test
npm run test:security
npm run build
npm run security:scan
git status
git diff
git diff --cached
git ls-files .env
git remote -v
```

`git ls-files .env` must produce no output.

## Application safeguards

- Webhook requests require Telegram's secret-token header.
- Secret comparison is constant-time when lengths match.
- Telegram output is plain text.
- User input is length-limited and never executed.
- Database queries use Drizzle parameters rather than string concatenation.
- User-facing errors do not contain exception text or configuration values.
- Telegram identity data is not stored in Neon.
- Flood-control state is temporary and process-local.

The in-memory limiter is best-effort protection for the initial serverless deployment. It is not a distributed quota across Vercel instances.
