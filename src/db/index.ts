import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { parseAppEnvironment } from "../config/env.js";
import * as schema from "./schema.js";

const env = parseAppEnvironment();
const client = neon(env.DATABASE_URL);

export const db = drizzle({ client, schema });
