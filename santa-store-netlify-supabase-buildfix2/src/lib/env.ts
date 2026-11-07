import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PAYMENTS_ENABLED: z.enum(["true","false"]).default("false"),
  FENAR_ENABLED: z.enum(["true","false"]).default("false"),
});
export const env = schema.parse(process.env);
