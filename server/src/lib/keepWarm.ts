import { prisma } from "./prisma";

/**
 * Neon (serverless Postgres) suspends compute after ~5 minutes with no queries, and the next query
 * then pays a 2.5-9s cold-start. While the server process is up, a trivial query every 4 minutes
 * keeps that compute awake so interactive actions - PDF downloads especially - don't randomly stall.
 *
 * This does NOT (and shouldn't) keep the Render host itself awake - that's driven by inbound HTTP,
 * and letting the host sleep when nobody's using it is the free-tier tradeoff we're keeping.
 */
const KEEP_WARM_INTERVAL_MS = 4 * 60 * 1000;

export function startDbKeepWarm(): void {
  if (process.env.NODE_ENV === "test") return;

  const ping = async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      // A failed keep-warm ping is not actionable on its own - the next real request will surface
      // any genuine DB problem with proper error handling. Just note it and carry on.
      console.warn("DB keep-warm ping failed:", err instanceof Error ? err.message : err);
    }
  };

  // Timer only - don't ping immediately on boot: `prisma migrate deploy` and the first requests
  // already warm the connection, and .unref() lets the process exit normally if nothing else holds it.
  setInterval(ping, KEEP_WARM_INTERVAL_MS).unref();
}
