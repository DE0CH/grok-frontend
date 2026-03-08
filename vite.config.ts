import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Dev middleware below emulates Vercel api/proxy-image and api/proxy-xai.
const PROXY_ALLOWED = ['https://imgen.x.ai/', 'https://vidgen.x.ai/'];
// Emulates Vercel api/proxy-xai (t2i, i2i, i2v) so dev avoids CORS when xAI omits Allow-Origin.
const XAI_API_PROXY_PREFIX = '/api/proxy-xai';
const XAI_API_ORIGIN = 'https://api.x.ai';
const XAI_PROXY_ALLOWED_PATHS = [
  '/v1/images/generations',  // t2i
  '/v1/images/edits',        // i2i
  '/v1/videos/generations',  // i2v start
];
function isAllowedXaiProxyPath(pathname: string): boolean {
  if (XAI_PROXY_ALLOWED_PATHS.some(p => pathname === p)) return true;
  if (pathname.startsWith('/v1/videos/') && /^\/v1\/videos\/[^/]+$/.test(pathname)) return true; // i2v poll
  return false;
}
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'proxy-xai-media',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/proxy-image?')) {
            const url = new URL(req.url, 'http://localhost').searchParams.get('url')
            if (!url || !PROXY_ALLOWED.some(origin => url.startsWith(origin))) {
              res.statusCode = 400
              res.end()
              return
            }
            try {
              const proxyRes = await fetch(url)
              res.statusCode = proxyRes.status
              proxyRes.headers.get('content-type') && res.setHeader('Content-Type', proxyRes.headers.get('content-type')!)
              const buf = await proxyRes.arrayBuffer()
              res.end(Buffer.from(buf))
            } catch (e) {
              res.statusCode = 502
              res.end()
            }
            return
          }
          // Proxy xAI API (t2i, i2i, i2v) to avoid CORS
          if (req.url?.startsWith(XAI_API_PROXY_PREFIX)) {
            const pathname = req.url.slice(XAI_API_PROXY_PREFIX.length).replace(/\?.*/, '')
            if (!isAllowedXaiProxyPath(pathname)) {
              res.statusCode = 404
              res.end()
              return
            }
            const targetUrl = `${XAI_API_ORIGIN}${pathname}${(req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')}`
            const headers: Record<string, string> = {}
            const forwardHeaders = ['authorization', 'content-type']
            for (const k of forwardHeaders) {
              const v = req.headers[k]
              if (typeof v === 'string') headers[k] = v
            }
            let body: ArrayBuffer | undefined
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
              const chunks: Buffer[] = []
              for await (const chunk of req) chunks.push(chunk)
              body = Buffer.concat(chunks)
            }
            try {
              const proxyRes = await fetch(targetUrl, { method: req.method || 'GET', headers, body })
              res.statusCode = proxyRes.status
              const ct = proxyRes.headers.get('content-type')
              if (ct) res.setHeader('Content-Type', ct)
              const buf = await proxyRes.arrayBuffer()
              res.end(Buffer.from(buf))
            } catch (e) {
              res.statusCode = 502
              res.end()
            }
            return
          }
          next()
        })
      },
    },
  ],
})
