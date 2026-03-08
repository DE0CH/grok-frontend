import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Dev middleware emulates Vercel api/proxy (media + xAI API).
const PROXY_PREFIX = '/api/proxy'
const CDN_ORIGINS = ['https://imgen.x.ai/', 'https://vidgen.x.ai/']
const XAI_ORIGIN = 'https://api.x.ai'
const API_ALLOWED_PATHS = [
  '/v1/images/generations',
  '/v1/images/edits',
  '/v1/videos/generations',
]
function isAllowedApiPath(pathname: string): boolean {
  if (API_ALLOWED_PATHS.some(p => pathname === p)) return true
  if (pathname.startsWith('/v1/videos/') && /^\/v1\/videos\/[^/]+$/.test(pathname)) return true
  return false
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith(PROXY_PREFIX)) {
            next()
            return
          }
          const url = new URL(req.url, 'http://localhost')
          const pathAfterPrefix = url.pathname.slice(PROXY_PREFIX.length) || ''

          // 1) Media: GET /api/proxy?url=...
          if (req.method === 'GET' && url.searchParams.has('url')) {
            const targetUrl = url.searchParams.get('url')!
            if (!CDN_ORIGINS.some(origin => targetUrl.startsWith(origin))) {
              res.statusCode = 400
              res.end()
              return
            }
            try {
              const proxyRes = await fetch(targetUrl)
              res.statusCode = proxyRes.status
              const ct = proxyRes.headers.get('content-type')
              if (ct) res.setHeader('Content-Type', ct)
              res.end(Buffer.from(await proxyRes.arrayBuffer()))
            } catch {
              res.statusCode = 502
              res.end()
            }
            return
          }

          // 2) API: /api/proxy/v1/...
          const apiPath = pathAfterPrefix.startsWith('/') ? pathAfterPrefix : `/${pathAfterPrefix}`
          if (isAllowedApiPath(apiPath)) {
            const targetUrl = `${XAI_ORIGIN}${apiPath}${url.search}`
            const headers: Record<string, string> = {}
            for (const k of ['authorization', 'content-type']) {
              const v = req.headers[k]
              if (typeof v === 'string') headers[k] = v
            }
            let rawBody: Buffer | undefined
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
              const chunks: Buffer[] = []
              for await (const chunk of req) chunks.push(chunk)
              rawBody = Buffer.concat(chunks)
            }
            const body: ArrayBuffer | undefined = rawBody
              ? (rawBody.buffer.slice(rawBody.byteOffset, rawBody.byteOffset + rawBody.byteLength) as ArrayBuffer)
              : undefined
            try {
              const proxyRes = await fetch(targetUrl, {
                method: req.method || 'GET',
                headers,
                body,
              })
              res.statusCode = proxyRes.status
              const ct = proxyRes.headers.get('content-type')
              if (ct) res.setHeader('Content-Type', ct)
              res.end(Buffer.from(await proxyRes.arrayBuffer()))
            } catch {
              res.statusCode = 502
              res.end()
            }
            return
          }

          res.statusCode = 404
          res.end()
        })
      },
    },
  ],
})
