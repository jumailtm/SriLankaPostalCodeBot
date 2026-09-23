import "dotenv/config";

import { createPostalCodeBot } from "./bot/index.js";
import { parsePollingEnvironment } from "./config/env.js";

const environment = parsePollingEnvironment();
const bot = createPostalCodeBot(environment.BOT_TOKEN);

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

await bot.start({
  onStart() {
    console.log(`Sri Lanka postal-code bot started in ${environment.NODE_ENV} polling mode.`);
  },
});
