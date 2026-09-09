/**
 * Cloudflare Worker that fronts the deployed app.
 *
 * Its one job: proxy `/api/*` to the Render API so the browser only ever talks to a single
 * origin. That makes the auth cookie first-party (`SameSite=Lax`, no `Partitioned`), which is
 * what lets an installed iOS home-screen app stay logged in after it's closed — see
 * server/src/lib/authCookie.ts. Everything else is served straight from the static build (the
 * ASSETS binding, which also applies the SPA fallback for client-side routes).
 *
 * Lives outside `src/` on purpose so it isn't pulled into the app's `tsc -b`; wrangler bundles it.
 */

const API_ORIGIN = 'https://technet-digital-api.onrender.com'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      // Passing the original Request as init forwards method, headers (incl. Cookie) and body;
      // the Set-Cookie coming back has no Domain attribute, so the browser scopes it to this
      // origin — exactly what makes it first-party.
      return fetch(API_ORIGIN + url.pathname + url.search, request as unknown as RequestInit)
    }
    return env.ASSETS.fetch(request)
  },
}
