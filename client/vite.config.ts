import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Stamps two things into the built sw.js (public/sw.js is copied as-is otherwise):
 *
 *  - a build id, so the file's bytes change whenever the app does. A browser only picks up a new
 *    service worker when sw.js itself changes, and that is what makes the app show its "new
 *    version — Reload" bar. Without this, an app-code-only deploy went unnoticed.
 *  - the list of built files, which the worker saves at install so the app opens offline even if
 *    it has only ever been loaded once.
 *
 * The id is a hash of the built output, so a build with no real change doesn't prompt anyone.
 */
function swBuildStamp(): Plugin {
  return {
    name: 'technet-sw-build-stamp',
    apply: 'build',
    // Client build only — the Cloudflare plugin also builds the Worker as its own environment.
    applyToEnvironment: (environment) => environment.name === 'client',
    writeBundle(options, bundle) {
      if (!options.dir) throw new Error('sw-build-stamp: no output directory')
      const swPath = join(options.dir, 'sw.js')

      const assets = Object.keys(bundle)
        .filter((file) => file.startsWith('assets/') && !file.endsWith('.map'))
        .sort()
      const publicFiles = readdirSync(this.environment.config.publicDir).filter((file) => file !== 'sw.js')
      const html = bundle['index.html']
      const htmlSource = html?.type === 'asset' ? String(html.source) : ''
      const buildId = createHash('sha256').update(htmlSource).update(assets.join('\n')).digest('hex').slice(0, 12)
      const precache = [...assets, ...publicFiles].map((file) => `/${file}`)

      let sw = readFileSync(swPath, 'utf8')
      const replacements: [string, string][] = [
        ["const BUILD_ID = 'dev'", `const BUILD_ID = '${buildId}'`],
        ['const PRECACHE_URLS = []', `const PRECACHE_URLS = ${JSON.stringify(precache)}`],
      ]
      for (const [placeholder, value] of replacements) {
        if (!sw.includes(placeholder)) throw new Error(`sw-build-stamp: "${placeholder}" not found in sw.js`)
        sw = sw.replace(placeholder, value)
      }
      writeFileSync(swPath, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), swBuildStamp()],
})
