const endpoint = process.env.DEPLOY_WEBHOOK_ENDPOINT;
const webhookSecret = process.env.DEPLOY_WEBHOOK_SECRET;
const botToken = process.env.DEPLOY_BOT_TOKEN;

if (!endpoint || !webhookSecret || !botToken) {
  console.error("Deployment verification environment is incomplete.");
  process.exit(1);
}

async function verifyDeployment() {
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "https:") {
    throw new Error("The deployment endpoint must use HTTPS.");
  }

  const getResponse = await fetch(endpoint);
  const missingSecretResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ update_id: 2_147_483_645 }),
  });
  const validSecretResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": webhookSecret,
    },
    body: JSON.stringify({ update_id: 2_147_483_646 }),
  });

  if (
    getResponse.status !== 405 ||
    missingSecretResponse.status !== 401 ||
    validSecretResponse.status !== 200
  ) {
    throw new Error("The live webhook returned an unexpected status.");
  }

  const telegramApi = `https://api.telegram.org/bot${botToken}`;
  const setWebhookBody = new URLSearchParams({
    url: endpoint,
    secret_token: webhookSecret,
    drop_pending_updates: "false",
  });
  const setWebhookResult = await fetch(`${telegramApi}/setWebhook`, {
    method: "POST",
    body: setWebhookBody,
  }).then((response) => response.json());
  const webhookInfo = await fetch(`${telegramApi}/getWebhookInfo`).then((response) =>
    response.json(),
  );

  if (
    setWebhookResult.ok !== true ||
    webhookInfo.ok !== true ||
    webhookInfo.result?.url !== endpoint
  ) {
    throw new Error("Telegram did not confirm the production webhook.");
  }

  console.log(
    `Live webhook checks passed: GET=${getResponse.status}, missing-secret=${missingSecretResponse.status}, valid-secret=${validSecretResponse.status}.`,
  );
  console.log("Telegram reports the expected production webhook URL.");
}

try {
  await verifyDeployment();
} catch {
  console.error("Live deployment verification failed without exposing request details.");
  process.exitCode = 1;
}
