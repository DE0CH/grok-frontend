import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Proxy for imgen.x.ai and vidgen.x.ai when using `npm run dev` (vite).
const PROXY_ALLOWED = ['https://imgen.x.ai/', 'https://vidgen.x.ai/'];
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
          next()
        })
      },
    },
  ],
})
