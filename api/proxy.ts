/** Vercel serverless: /api/proxy — delegates to shared handler. */
import { proxyFetch } from "./proxy/handler";

export default { fetch: proxyFetch };
