import { z } from "zod";
import { env } from "cloudflare:workers";

const envSchema = z.object({
  TOKENS: z.custom<KVNamespace>(
    (val) => {
      if (val === undefined || val === null) {
        return false;
      }
      return typeof val === "object" && "get" in val && "put" in val;
    },
    {
      message: "TOKENS KV namespace is required",
    }
  ),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url("GOOGLE_REDIRECT_URI must be a valid URL"),
});

export type Env = z.infer<typeof envSchema>;

export const ENV: Env = envSchema.parse(env);
