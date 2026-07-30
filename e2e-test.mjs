import { chromium } from "playwright";

const BASE = "http://localhost:3005";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page1 = await ctx.newPage(); // Creator
  const page2 = await ctx.newPage(); // Viewer

  const errs1 = [], errs2 = [];
  page1.on("pageerror", (e) => errs1.push(e.message));
  page2.on("pageerror", (e) => errs2.push(e.message));
  page1.on("console", (msg) => { if (msg.type() === "error") errs1.push("[CONSOLE] " + msg.text()); });
  page2.on("console", (msg) => { if (msg.type() === "error") errs2.push("[CONSOLE] " + msg.text()); });

  // Valid JWT token for testing
  const jwt = require('jsonwebtoken');
  const secret = "lol-tabtap-secret-koki-mill-2026";
  const tokenA = jwt.sign({ userId: 101, summonerName: "PlayerOne", tag: "P1" }, secret, { expiresIn: "1h" });
  const tokenB = jwt.sign({ userId: 102, summonerName: "PlayerTwo", tag: "P2" }, secret, { expiresIn: "1h" });

  // Inject tokens
  await page1.goto(BASE, { waitUntil: "domcontentloaded" });
  await page1.evaluate((t) => {
    localStorage.setItem("lolteam_token", t);
    localStorage.setItem("lolteam_user", JSON.stringify({ id: 101, summonerName: "PlayerOne", tag: "P1" }));
  }, tokenA);

  await page2.goto(BASE, { waitUntil: "domcontentloaded" });
  await page2.evaluate((t) => {
    localStorage.setItem("lolteam_token", t);
    localStorage.setItem("lolteam_user", JSON.stringify({ id: 102, summonerName: "PlayerTwo", tag: "P2" }));
  }, tokenB);

  // Page1: Go to simulator, select side
  console.log("=== Page1: Create simulation ===");
  await page1.goto(BASE + "/simulador", { waitUntil: "networkidle" });
  await page1.waitForTimeout(4000); // Wait for WS connect + auth

  const c1 = await page1.content();
  console.log("Page1 has AZUL:", c1.includes("LADO AZUL"));
  
  if (c1.includes("LADO AZUL")) {
    await page1.locator("button:has-text('LADO AZUL')").first().click();
    await page1.waitForTimeout(2000);
    
    const c1b = await page1.content();
    console.log("Page1 has 'Compartir simulación':", c1b.includes("Compartir simulación"));
    console.log("Page1 errors:", errs1.length);
    errs1.forEach(e => console.log("  ", e.substring(0, 120)));
  }

  // Page2: Check for active sessions
  console.log("\n=== Page2: Check active sessions ===");
  await page2.goto(BASE + "/simulador", { waitUntil: "networkidle" });
  await page2.waitForTimeout(5000); // Wait for WS + session list
  
  const c2 = await page2.content();
  console.log("Page2 has AZUL:", c2.includes("LADO AZUL"));
  console.log("Page2 has 'Simulaciones activas':", c2.includes("Simulaciones activas"));
  console.log("Page2 has 'PlayerOne':", c2.includes("PlayerOne"));
  console.log("Page2 errors:", errs2.length);
  errs2.forEach(e => console.log("  ", e.substring(0, 120)));

  const ok = c2.includes("Simulaciones activas") && c2.includes("PlayerOne");
  console.log(`\n${ok ? "✅" : "❌"} Active sessions: ${ok ? "WORKING" : "FAILED"}`);

  await browser.close();
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
