import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

const client = neon(env.DATABASE_URL);

export const db = drizzle({ client, schema });
