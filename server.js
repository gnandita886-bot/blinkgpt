
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
].filter(Boolean);

const SYSTEM_PROMPT = `
You are BlinkGPT,an intelligent AI assistant created by
Neeraj Production.

Your personality:
- Be helpful, intelligent, respectful and friendly.
- Understand English and Hinglish.
- Reply naturally in the language the user uses.
- Explain difficult topics in simple language.
- Use Markdown formatting when helpful, including **bold**,
  headings, numbered lists and bullet points.
- Never expose API keys or private server information.
- Do not claim to have performed actions you cannot perform.
- Answer directly and avoid unnecessary repetition.
`;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (url.pathname === "/api/health" && req.method === "GET") {
    return sendJSON(res, 200, {
      ok: true,
      service: "BlinkGPT",
      apiKeyConfigured: Boolean(GEMINI_API_KEY),
      modelsConfigured: MODELS
    });
  }

  if (url.pathname === "/api/chat" && req.method === "POST") {
    if (!GEMINI_API_KEY) {
      return sendJSON(res, 500, {
        error: "GEMINI_API_KEY is missing in Render settings."
      });
    }

    try {
      const body = await readJSON(req);

      const messages = Array.isArray(body.messages)
        ? body.messages
        : [];

      const prompt =
        body.message ||
        body.prompt ||
        body.text ||
        "";

      const contents = [];

      for (const message of messages) {
        if (!message) continue;

        const role =
          message.role === "assistant" ||
          message.role === "model"
            ? "model"
            : "user";

        const content =
          typeof message.content === "string"
            ? message.content
            : typeof message.text === "string"
            ? message.text
            : "";

        if (content.trim()) {
          contents.push({
            role,
            parts: [{ text: content }]
          });
        }
      }

      if (typeof prompt === "string" && prompt.trim()) {
        contents.push({
          role: "user",
          parts: [{ text: prompt }]
        });
      }

      if (!contents.length) {
        return sendJSON(res, 400, {
          error: "Please enter a message."
        });
      }

      let lastError = "No Gemini model responded.";
      let reply = "";

      for (const model of [...new Set(MODELS)]) {
        try {
          const response = await fetch(
            `${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: SYSTEM_PROMPT }]
                },
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 4096
                }
              })
            }
          );

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            lastError =
              data?.error?.message ||
              `Gemini returned HTTP ${response.status}.`;

            console.error(`${model}: ${lastError}`);
            continue;
          }

          reply = (
            data?.candidates?.[0]?.content?.parts || []
          )
            .map(part => part.text || "")
            .join("")
            .trim();

          if (reply) break;

          lastError = "Gemini returned an empty response.";
        } catch (error) {
          lastError = error.message;
          console.error(`${model}: ${lastError}`);
        }
      }

      if (!reply) {
        return sendJSON(res, 502, {
          error: lastError
        });
      }

      return sendJSON(res, 200, {
        reply,
        response: reply,
        text: reply
      });
    } catch (error) {
      console.error("Chat error:", error);

      return sendJSON(res, 500, {
        error: error.message || "Internal server error."
      });
    }
  }

  // Serve the existing frontend.
  const requestedPath =
    url.pathname === "/"
      ? "index.html"
      : decodeURIComponent(url.pathname).replace(/^\/+/, "");

  const publicRoot = path.resolve(__dirname);
  const filePath = path.resolve(publicRoot, requestedPath);

  if (
    filePath !== publicRoot &&
    !filePath.startsWith(publicRoot + path.sep)
  ) {
    return sendJSON(res, 403, {
      error: "Access denied."
    });
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      return sendJSON(res, 404, {
        error: "File not found."
      });
    }

    const ext = path.extname(filePath).toLowerCase();

    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".webp": "image/webp"
    };

    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream"
    });

    res.end(file);
  });
});

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    const limit = 2 * 1024 * 1024;

    req.on("data", chunk => {
      size += chunk.length;

      if (size > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }

      raw += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON request."));
      }
    });

    req.on("error", reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Xolox server running on port ${PORT}`);
  console.log(`Port: ${PORT}`);
  console.log(`API key configured: ${Boolean(GEMINI_API_KEY)}`);
});
    
