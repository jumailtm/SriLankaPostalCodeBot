# Vercel deployment

The production bot uses Telegram webhooks through the Vercel Function at `/api/telegram`. It does not start the local long-polling process on Vercel.

The committed `vercel.json` contains only the `dist` output-directory override required by this framework-free project. It contains no environment values or deployment domains.

## Prerequisites

- A GitHub repository owned by the project owner
- A Vercel account connected to that GitHub account
- A Telegram bot created through BotFather
- A Neon PostgreSQL database containing the verified postal records
- A private webhook secret containing only letters, numbers, underscores, or hyphens

Never place a credential in Git, a command committed to the repository, an issue, a screenshot, or a deployment log.

## Deploy

1. Push the repository to GitHub.
2. Import the repository in the Vercel dashboard.
3. Add these Production environment variables in Vercel:

   - `BOT_TOKEN`
   - `DATABASE_URL`
   - `NODE_ENV` with the value `production`
   - `TELEGRAM_WEBHOOK_SECRET`

4. Deploy the project.
5. Copy the deployment's HTTPS URL. The Telegram endpoint is the deployment URL followed by `/api/telegram`.
6. Call Telegram's `setWebhook` method from a secure local terminal. Pass the endpoint as `url` and the webhook secret as `secret_token`, using environment-variable references rather than literal credentials.

## Verification

After deployment:

1. Confirm the deployment URL uses HTTPS.
2. Confirm a request without the Telegram secret header receives HTTP 401.
3. Send `/start` to the bot.
4. Search by a five-digit postal code and a post-office name.
5. Review Vercel logs and confirm that no token, database URL, webhook secret, update body, user ID, or chat ID is printed.

An HTTP 405 response to a normal browser `GET` request is expected because Telegram delivers updates with `POST`.

## Local development

Use the ignored `.env` file and run:

```bash
npm run dev
```

This starts grammY long polling for local testing only. Telegram cannot use long polling and an active webhook for the same bot simultaneously. If a production webhook is already configured, use a separate development bot or deliberately disable the webhook before local testing.

## Rollback

Use the Vercel dashboard to promote a previously verified deployment. Rotating or removing a deployment does not rotate Telegram or Neon credentials; rotate those separately if compromise is suspected.
