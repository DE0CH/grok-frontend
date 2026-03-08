# Grok Image & Video

<p><strong style="color: #b31d28;">⚠ Note:</strong> Grok changed its API, so generation is broken at the moment. See <a href="https://github.com/DE0CH/grok-frontend/issues/4">issue #4</a> and <a href="https://github.com/DE0CH/grok-frontend/issues/5">issue #5</a> for more details.</p>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDE0CH%2Fgrok-frontend)

A small web app to generate and edit images and videos using the [xAI (Grok) API](https://x.ai/). Create images from text, edit images with a prompt, or turn an image into a short video.

## Features

- **Text to Image** — Enter a text prompt; get an image generated from your description.
- **Image to Image** — Upload an image and a text prompt; get a new image edited to match the prompt.
- **Image to Video** — Upload an image and a prompt, choose duration (1–15 seconds); get a video.
- **Login** — Your xAI API key is stored in a cookie in your browser. xAI asks the browser to block direct requests (CORS), so the key is sent to the app’s proxy (Vercel or the dev server), which forwards it to xAI; the proxy does not log or store your key. No account on this app; just your API key.

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
## How to use

1. **Log in**  
   Go to the app, enter your xAI API key on the login page, and submit. The key is stored in a cookie so you stay logged in until you log out or clear it.

2. **Text to Image**  
   - Open **Text to Image** from the nav.
   - Enter a prompt describing the image you want.
   - Submit. The generated image appears at the top; you can download it if needed.

3. **Image to Image**  
   - Open the **Image to Image** page (home).
   - Upload an image (drag-and-drop or click to choose).
   - Enter a prompt describing how you want the image edited.
   - Submit. The result image appears at the top; you can download it if needed.

4. **Image to Video**  
   - Open **Image to Video** from the nav.
   - Upload an image and enter a prompt.
   - Use the duration slider (1–15 seconds).
   - Submit. When the video is ready, it appears at the top and can be played or downloaded.

5. **Log out**  
   Use **Log out** in the nav to clear the stored API key and return to the login page.

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [React Router](https://reactrouter.com/)
- [xAI API](https://docs.x.ai/) for image and video generation (no SDK); xAI asks the browser to block direct requests (CORS), so requests go via the app’s proxy, which forwards your API key to xAI and does not log or store it

## Deploy (e.g. Vercel)

**[Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDE0CH%2Fgrok-frontend)** — click the button at the top to clone and deploy this repo in one step.

The app is a single-page app. For Vercel, `vercel.json` rewrites all routes to `index.html`. To deploy from the CLI:

```bash
npm run build
npx vercel
```

(or connect the repo to Vercel for automatic deploys). The API key is entered in the browser and stored in a cookie; xAI asks the browser to block direct requests (CORS), so the key is sent to the proxy, which forwards it to xAI and does not log or store it. No server-side secrets are required for basic use.

## License

MIT — see [LICENSE](LICENSE).
