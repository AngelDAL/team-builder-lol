const { chromium } = require("playwright");
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:3005";
const secret = "lol-tabtap-secret-koki-mill-2026";
const token = jwt.sign({userId:101,summonerName:"PlayerOne",tag:"P1"},secret,{expiresIn:"1h"});

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", e => errors.push("[PAGE_ERROR] " + e.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push("[CONSOLE] " + msg.text().substring(0, 200));
  });

  // Step 1: Go to a page and set localStorage
  console.log("=== Setting auth ===");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    localStorage.setItem("lolteam_token", t);
    localStorage.setItem("lolteam_user", JSON.stringify({ id: 101, summonerName: "PlayerOne", tag: "P1" }));
  }, token);
  
  // Verify token was set
  const check1 = await page.evaluate(() => localStorage.getItem("lolteam_token"));
  console.log("Token set:", check1 ? check1.substring(0, 30) + "..." : "NO");

  // Step 2: Navigate to simulator (full page load)
  console.log("\n=== Navigating to /simulador ===");
  await page.goto(BASE + "/simulador", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(5000);

  // Check if token persists after navigation
  const check2 = await page.evaluate(() => localStorage.getItem("lolteam_token"));
  console.log("Token after nav:", check2 ? check2.substring(0, 30) + "..." : "NO");

  // Check what page we're on
  const url = page.url();
  console.log("Current URL:", url);
  
  const html = await page.content();
  console.log("Has spinner:", html.includes("animate-pulse"));
  console.log("Has 'LADO AZUL':", html.includes("LADO AZUL"));
  console.log("Has 'Entrar al equipo':", html.includes("Entrar al equipo"));
  console.log("Has 'Simulador de Draft':", html.includes("Simulador de Draft"));
  console.log("Has 'Simulaciones activas':", html.includes("Simulaciones activas"));
  console.log("Has error boundary:", html.includes("next-error"));

  // Log actual page text
  const text = await page.innerText("body").catch(() => "CANT GET TEXT");
  console.log("\n=== Body text (first 500) ===");
  console.log(text.substring(0, 500));

  if (errors.length > 0) {
    console.log("\n=== Errors ===");
    errors.forEach(e => console.log("  ", e.substring(0, 200)));
  }
  
  await browser.close();
}
main().catch(e => { console.error("FAIL:", e); process.exit(1); });
