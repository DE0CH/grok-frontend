import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyFetch } from './api/proxy'

// https://vite.dev/config/
// Dev middleware: shim that calls the same proxy handler as Vercel api/proxy.
const PROXY_PREFIX = '/api/proxy'

export default defineConfig({
  server: {
    proxy: {
      '/proxy': {
        target: 'https://api.x.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy/, '/v1')
      }
    }
  },
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
          let body: ArrayBuffer | undefined
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk)
            const raw = Buffer.concat(chunks)
            body = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
          }
          const requestUrl = 'http://localhost' + req.url
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (v !== undefined && typeof v === 'string') headers.set(k.toLowerCase(), v)
          }
          const request = new Request(requestUrl, { method: req.method ?? 'GET', headers, body })
          try {
            const response = await proxyFetch(request)
            res.statusCode = response.status
            response.headers.forEach((v, k) => res.setHeader(k, v))
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch {
            res.statusCode = 502
            res.end()
          }
        })
      },
    },
  ],
})
