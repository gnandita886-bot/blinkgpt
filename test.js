"use strict";
const assert = require("assert");
const http = require("http");

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODEL = "retired-model";
process.env.RATE_LIMIT_PER_MIN = "1000";

const calls = [];
const fake = http.createServer((req, res) => {
  let b = "";
  req.on("data", c => (b += c));
  req.on("end", () => {
    calls.push({ url: req.url, key: req.headers["x-goog-api-key"], body: JSON.parse(b) });
    res.setHeader("Content-Type", "application/json");
    if (req.url.includes("retired-model")) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: { message: "no longer available" } }));
    }
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello from fake Gemini" }] } }] }));
  });
});

async function main() {
  await new Promise(r => fake.listen(0, r));
  process.env.GEMINI_API_BASE = "http://127.0.0.1:" + fake.address().port;
  const server = require("./server.js");
  await new Promise(r => server.listen(0, r));
  const base = "http://127.0.0.1:" + server.address().port;

  let r = await fetch(base + "/api/health");
  let j = await r.json();
  assert.strictEqual(j.keyConfigured, true);

  r = await fetch(base + "/");
  assert.strictEqual(r.status, 200);
  assert.ok((await r.text()).includes("Blink GPT"));

  r = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "Hindi",
      messages: [{ role: "user", content: "hi" }, { role: "user", content: "again" }]
    })
  });
  j = await r.json();
  assert.strictEqual(r.status, 200);
  assert.strictEqual(j.reply, "Hello from fake Gemini");
  assert.ok(calls.length >= 2, "should fall back after 404");
  const last = calls[calls.length - 1];
  assert.strictEqual(last.key, "test-key");
  assert.strictEqual(last.body.contents.length, 1, "consecutive user turns merged");
  assert.ok(last.body.systemInstruction.parts[0].text.includes("Hindi"));

  r = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] })
  });
  assert.strictEqual(r.status, 400);

  console.log("All tests passed.");
  server.close();
  fake.close();
}
main().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
