const { chromium } = require("playwright");

const BASE = "http://localhost:3005";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push("[CONSOLE] " + msg.text().substring(0, 200));
  });

  // Go straight to simulator
  console.log("=== Loading simulator ===");
  await page.goto(BASE + "/simulador", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log("HTML length:", html.length);
  console.log("Has protected spinner:", html.includes("animate-pulse"));
  console.log("Has side selector:", html.includes("LADO AZUL"));
  console.log("Has error boundary:", html.includes("next-error-text") || html.includes("next-error"));
  console.log("Has 'no autorizado' or 'redirect':", html.includes("No autorizado") || html.includes("401"));
  
  console.log("\n=== Page text (first 1000 chars) ===");
  const text = await page.innerText("body");
  console.log(text.substring(0, 1000));

  console.log("\n=== Errors ===");
  errors.forEach(e => console.log(e.substring(0, 200)));
  
  await browser.close();
}
main().catch(e => { console.error("FAIL:", e); process.exit(1); });
