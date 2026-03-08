/** Vercel serverless entry: delegates to shared handler. */
import { proxyFetch } from "./handler";

export default { fetch: proxyFetch };
