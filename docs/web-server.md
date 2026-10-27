# Running LearnHarness as a web server

LearnHarness ships as a Next.js app. You can run the production build on a home machine (including Windows) and point it at a local OpenAI-compatible model server such as Ollama.

## Build and start

```bash
npm install
npm run build
```

When `NODE_ENV=production`, install build tooling as well (Tailwind/PostCSS are runtime build deps):

```bash
npm ci --include=dev
# or: npm install --include=dev
npm run build
```

Serve on the default port (3000):

```bash
npm start
```

Use another port (default hostname is `0.0.0.0`):

```bash
PORT=8080 npm start
# or
npx next start -p 8080
```

The standalone output used by the desktop app is built by `npm run build`; `npm start` runs `next start` against that build.

## Data directory and secrets

| Variable | Purpose |
|---|---|
| `LH_DATA_DIR` | Directory for chats, graph, and `settings.json` (default: `./data` under the repo) |
| `LH_AUTH_FILE` | Path to `auth.json` for API keys (default: `./auth.json` beside the app) |

Model provider API keys and the optional Ollama API key use the same `auth.json` / settings UI as the desktop app.

## Local models (Ollama and OpenAI-compatible)

Configure in **Settings → Keys → Local models**, or with environment variables:

| Variable | Purpose |
|---|---|
| `LH_OLLAMA_BASE_URL` | Base URL of the server (e.g. `http://127.0.0.1:11434` or `https://your-host:11434`). Normalised to the OpenAI API root (`…/v1`). **Environment wins** over the value saved in settings. |
| `LH_OLLAMA_API_KEY` | Optional bearer token for reverse proxies |

After the base URL is set, LearnHarness discovers models from `GET /v1/models`, then falls back to Ollama `GET /api/tags`. You can add model ids manually if discovery is blocked.

In the model picker these models appear under provider **ollama**. They use pi-ai's **`openai-completions`** API with Ollama-compatible flags (`supportsDeveloperRole: false`). The cost meter shows **$0**.

Pick models in **Settings → Models** (strong / cheap / vision slots) like any other provider.

## Security note

A network-exposed instance is a **trusted single-user server**, not multi-tenant hosting. Do not expose it to the public internet without an access gate. Subscription sign-in (ChatGPT, etc.) still expects a browser on the server's machine for OAuth callbacks; see [development.md](development.md).

## Tooling expectations

The teacher and background agents rely on **tool calling** and long context. Small local models may refuse work, loop, or fail tool schemas. Vision slots need a model that accepts images. Test with a model known to support OpenAI-style tools on your stack.
