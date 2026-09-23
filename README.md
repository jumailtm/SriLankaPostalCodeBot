# Lanka Postcode Bot

Lanka Postcode Bot is an independent Telegram bot for finding Sri Lankan postal-code information by:

- Five-digit postal code
- Exact post-office name
- Partial post-office name
- District
- Province

The bot reads verified records from Neon PostgreSQL. Its data is collected from the official Department of Posts, Sri Lanka Postcode Directory.

> This is an independent open-source project and is not an official Sri Lanka Post Telegram bot. It is not endorsed by or operated by the Department of Posts, Sri Lanka.

## Features

- `/start` and `/help` Telegram commands
- Plain-text postal search results with no empty fields
- Multiple-match and no-result responses
- Parameterized Drizzle queries; user text is never concatenated into SQL
- Input validation and a 100-character search limit
- Best-effort in-memory flood protection
- Generic user-facing error messages that do not expose internals
- Secret-token validation for Telegram webhook requests
- Vercel-compatible serverless webhook endpoint
- Database-free unit and security tests

## Technology

- Node.js 20 or newer
- TypeScript in strict mode
- grammY
- Neon PostgreSQL
- Drizzle ORM
- Zod
- dotenv for local environment variables
- Vercel Functions
- Node's built-in test runner

## Project structure

```text
.
|-- api/
|   `-- telegram.ts                 # Vercel Telegram webhook function
|-- data/                           # Reviewed normalized postal dataset and reports
|-- drizzle/                        # Generated PostgreSQL migrations
|-- scripts/
|   `-- check-secrets.mjs           # Tracked/candidate-file credential scan
|-- src/
|   |-- bot/
|   |   |-- handlers.ts             # Telegram commands and text-message flow
|   |   |-- index.ts                # grammY bot factory
|   |   |-- messages.ts             # Safe user-facing text and result formatting
|   |   `-- rate-limiter.ts         # Ephemeral in-memory flood protection
|   |-- config/env.ts               # Zod environment validation
|   |-- db/                          # Neon connection and Drizzle schema
|   |-- scripts/                     # Import and verification commands
|   `-- services/
|       |-- postcode/                # Collection, validation, and import pipeline
|       `-- search/                  # Reusable database search service
|-- .env.example
|-- drizzle.config.ts
|-- package.json
|-- vercel.json                      # Build-output override for Vercel
`-- tsconfig.json
```

Additional project guides:

- [Vercel deployment](docs/DEPLOYMENT.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Install

```bash
npm install
```

Copy `.env.example` to `.env`, then fill in your own local values:

```dotenv
BOT_TOKEN=
DATABASE_URL=
NODE_ENV=
TELEGRAM_WEBHOOK_SECRET=
```

- `BOT_TOKEN`: create a bot with [BotFather](https://t.me/BotFather) and use the token only in `.env` or a deployment secret store.
- `DATABASE_URL`: copy the pooled PostgreSQL connection string from the Neon dashboard.
- `NODE_ENV`: use `development` locally, `test` for test environments, or `production` in Vercel.
- `TELEGRAM_WEBHOOK_SECRET`: generate a private random value containing letters, numbers, `_`, or `-`; use at least 16 characters.

Never commit `.env`. The repository ignores `.env`, `.env.*`, and Vercel's local state while explicitly allowing the placeholder-only `.env.example`.

## Neon and database setup

1. Create a PostgreSQL project in the [Neon Console](https://console.neon.tech/).
2. Open the connection details and select a pooled connection string.
3. Put that value in `DATABASE_URL` inside the ignored local `.env` file.
4. Generate a migration after an intentional schema change:

   ```bash
   npm run db:generate
   ```

5. Apply committed migrations:

   ```bash
   npm run db:migrate
   ```

6. Verify connectivity without printing the connection string:

   ```bash
   npm run db:check
   ```

Optional database inspection is available with `npm run db:studio`.

## Postal data pipeline

The committed normalized dataset was built in earlier phases from the official Postcode Directory. Raw downloads are reproducible and ignored by Git.

```bash
npm run postcode:collect
npm run postcode:import -- --dry-run
npm run postcode:import
npm run postcode:verify
```

Review `data/postcodes.validation.json` before importing a newly collected dataset. The collector does not generate missing postal records or silently correct uncertain source values. Postal codes remain strings so leading zeroes are preserved.

The importer uses the logical combination of office name, postal code, and office type. Postal code alone is not treated as unique because the official source may associate one code with multiple valid offices.

## Local Telegram development

Local development uses grammY long polling. Vercel does not run this process.

1. Configure `BOT_TOKEN`, `DATABASE_URL`, and `NODE_ENV=development` in `.env`.
2. Apply the database migrations and import the reviewed postal records if needed.
3. Start the local bot:

   ```bash
   npm run dev
   ```

4. Send `/start`, a post-office name, or a five-digit postal code to your bot.

The startup log reports only the mode and never prints credentials.

## Tests and quality checks

Tests use mocks and in-memory repositories. They do not connect to Neon and do not require production credentials.

```bash
npm run typecheck
npm test
npm run test:security
npm run build
npm run security:scan
```

Coverage includes commands, exact and partial searches, Unicode, no/multiple results, validation, database and Telegram failures, rate limiting, malformed webhooks, missing configuration, webhook secrets, injection-like text, token/URL-shaped input, HTML-like input, and excessive message length.

`security:scan` checks Git-tracked and unignored candidate files for high-risk credential patterns and forbidden secret-file names. It does not inspect the ignored local `.env` or print secret values.

No separate lint tool is configured; strict TypeScript type checking is the project's static code-quality check.

## Vercel deployment

The production architecture uses `api/telegram.ts` as a Vercel Function. It processes one Telegram update per HTTPS request and does not start a long-running polling process. The minimal `vercel.json` points Vercel's static build check at the existing TypeScript `dist` output; it contains no domains or credentials.

1. Push the repository to the repository owner's GitHub account.
2. Import the GitHub repository into Vercel.
3. Add these Environment Variables in Vercel for the Production environment:

   - `BOT_TOKEN`
   - `DATABASE_URL`
   - `NODE_ENV` with value `production`
   - `TELEGRAM_WEBHOOK_SECRET`

4. Deploy the project.
5. Note the HTTPS deployment URL. The webhook endpoint is:

   ```text
   https://your-vercel-domain.example/api/telegram
   ```

6. Register that URL with Telegram's `setWebhook` method, sending the value from `TELEGRAM_WEBHOOK_SECRET` as Telegram's `secret_token`. Use environment-variable references in your terminal; never paste credentials into source files, documentation, shell history, or issue reports.
7. Test `/start`, a known postal code, an office name, and an invalid webhook secret.

Telegram sends the configured secret in the `X-Telegram-Bot-Api-Secret-Token` request header. The endpoint rejects a missing or incorrect value before parsing the update.

### Post-deployment checks

- Confirm the endpoint uses HTTPS.
- Confirm valid Telegram updates receive HTTP 200.
- Confirm a missing or invalid webhook secret receives HTTP 401.
- Test `/start` and postal-code searches.
- Check that error responses and Vercel logs contain no credentials.
- Confirm `.env` is not present in GitHub with `git ls-files .env`.

The in-memory limiter is intentionally small and simple for the initial deployment. Vercel instances do not share memory, so it is best-effort protection rather than a distributed quota system.

## Privacy and security

The application does not create a Telegram-user table and does not store usernames, names, user IDs, or chat IDs in Neon. The rate limiter temporarily holds an identifier only in a running process's memory and removes entries as windows expire or instances terminate.

Telegram output uses plain text. User input is never used as markup, a link, executable code, or concatenated SQL. Technical failures are logged with generic event descriptions rather than exception text, URLs, tokens, or request content.

Before every public push, run the quality commands above and inspect:

```bash
git status
git diff
git diff --cached
git ls-files .env
git remote -v
```

If a real credential ever enters a commit, revoke or rotate it immediately and remove it from Git history before publishing. Deleting it only from the latest file is not sufficient.

## Official data source and attribution

Data source: **Department of Posts, Sri Lanka / Sri Lanka Post**

- Official website: <https://slpost.gov.lk/>
- Official postcode search: <https://slpost.gov.lk/postcode_new/>
- Official Postcode Directory: <https://slpost.gov.lk/wp-content/uploads/2022/11/POST-CODE-BOOK-.pdf>

This project does not claim ownership of the official postal data. Dataset metadata retains the official source URLs and source hashes.

## Contributing

Issues and focused pull requests are welcome after the repository is published. Do not include credentials, private Telegram updates, production database exports, or personal user data in issues, commits, tests, or screenshots. Run the full test and security checklist before opening a pull request.

## License status

No license has been selected yet, so no `LICENSE` file has been added. The repository owner should choose and add an appropriate open-source license before presenting the repository as licensed open-source software. Contributors should not assume reuse rights until that decision is recorded.
