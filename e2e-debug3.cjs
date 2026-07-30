const { chromium } = require("playwright");
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:3005";
const secret = "lol-tabtap-secret-koki-mill-2026";
const token = jwt.sign({userId:101,summonerName:"PlayerOne",tag:"P1"},secret,{expiresIn:"1h"});

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("pageerror", e => console.log("[PAGE_ERROR]", e.message));
  page.on("console", msg => {
    if (msg.type() === "error") console.log("[CONSOLE]", msg.text().substring(0, 300));
    if (msg.text().includes("WebSocket") || msg.text().includes("auth")) console.log("[WS]", msg.text().substring(0, 300));
  });

  // Set auth
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("lolteam_token", t);
    localStorage.setItem("lolteam_user", JSON.stringify({ id: 101, summonerName: "PlayerOne", tag: "P1" }));
  }, token);

  // Go to simulator
  console.log("=== Navigating to /simulador ===");
  await page.goto(BASE + "/simulador", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(8000);

  const html = await page.content();
  console.log("\n=== URL:", page.url());
  console.log("Has spinner:", html.includes("animate-pulse"));
  console.log("Has 'LADO AZUL':", html.includes("LADO AZUL"));
  console.log("Has 'Simulador de Draft':", html.includes("Simulador de Draft"));
  console.log("Has error UI:", html.includes("next-error-text") || html.includes("This page could not be loaded"));
  console.log("Has WS error:", html.includes("Token inválido") || html.includes("auth_error"));

  // Check for WS-related text
  console.log("Has 'conectando':", html.includes("Conectando"));
  console.log("Has 'auth_ok':", html.includes("auth_ok"));
  console.log("Has 'readyState':", html.includes("readyState"));

  // Get page text
  const text = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
  console.log("\n=== Body text ===");
  console.log(text.substring(0, 800));

  await browser.close();
}
main().catch(e => { console.error("FAIL:", e); process.exit(1); });
