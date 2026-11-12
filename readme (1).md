# Blink GPT (Gemini)

Chat app with a small Node.js server that talks to Google Gemini.
The API key stays on the server (as the GEMINI_API_KEY environment variable)
and is never sent to the browser or put in public code.

## Files
- server.js          - the backend (serves the page + POST /api/chat)
- public/index.html  - the chat page (your design)
- package.json       - run commands
- .env.example       - template for local use
- .gitignore         - keeps .env private
- test.js            - offline test (no key, no internet)

## Run it on a computer
1. Install Node.js 18 or newer (nodejs.org).
2. Get a free key at https://aistudio.google.com/apikey
3. Copy `.env.example` to `.env` and put your key after `GEMINI_API_KEY=`.
4. Run: `npm start`
5. Open http://localhost:3000

## Test it
- `npm test` runs a fake-Gemini test (no key needed).
- Open /api/health - it should say `"keyConfigured": true`.

## Notes
- The model defaults to `gemini-3.5-flash`. If a model is retired the server
  automatically tries the next one. Force one with `GEMINI_MODEL`.
- The server limits each visitor to 20 messages per minute (RATE_LIMIT_PER_MIN).
- Free-tier Gemini prompts may be used by Google to improve its products.
- If the page is inside an APK or hosted elsewhere, set `API_URL_OVERRIDE` in
  public/index.html to your server's full address, e.g.
  https://your-app.onrender.com/api/chat
