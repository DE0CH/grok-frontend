# Grok Image & Video

A small web app to edit images and generate videos using the [xAI (Grok) API](https://x.ai/). You upload an image, add a prompt, and get either an edited image or a short video.

## Features

- **Image to Image** — Upload an image and a text prompt; get a new image edited to match the prompt.
- **Image to Video** — Upload an image and a prompt, choose duration (1–15 seconds); get a video.
- **Login** — Your xAI API key is stored in a cookie in your browser (not sent to any server except xAI via the app). No account on this app; just your API key.

## Prerequisites

- [Node.js](https://nodejs.org/) (developed and tested with v24)
- An [xAI API key](https://console.x.ai/) (the API is paid; see xAI for pricing).

## Setup and run

```bash
# Install dependencies
npm install

# Run the app locally
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). You’ll be asked to log in with your xAI API key.

### Other commands

- `npm run build` — Build for production (output in `dist/`).
- `npm run preview` — Serve the production build locally.
- `npm run dev:vercel` — Run with [Vercel CLI](https://vercel.com/docs/cli) (uses Vercel’s proxy if configured).

## How to use

1. **Log in**  
   Go to the app, enter your xAI API key on the login page, and submit. The key is stored in a cookie so you stay logged in until you log out or clear it.

2. **Image to Image**  
   - Open the **Image to Image** page (home).
   - Upload an image (drag-and-drop or click to choose).
   - Enter a prompt describing how you want the image edited.
   - Submit. The result image appears at the top; you can download it if needed.

3. **Image to Video**  
   - Open **Image to Video** from the nav.
   - Upload an image and enter a prompt.
   - Use the duration slider (1–15 seconds).
   - Submit. When the video is ready, it appears at the top and can be played or downloaded.

4. **Log out**  
   Use **Log out** in the nav to clear the stored API key and return to the login page.

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [React Router](https://reactrouter.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/) with [@ai-sdk/xai](https://www.npmjs.com/package/@ai-sdk/xai) for Grok image and video APIs

## Deploy (e.g. Vercel)

The app is a single-page app. For Vercel, `vercel.json` rewrites all routes to `index.html`. Deploy with:

```bash
npm run build
vercel
```

(or connect the repo to Vercel for automatic deploys). The API key is always entered in the browser and stored in a cookie; no server-side secrets are required for basic use.

## License

MIT — see [LICENSE](LICENSE).
