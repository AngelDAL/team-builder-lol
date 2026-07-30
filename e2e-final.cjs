const { chromium } = require("playwright");
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:3005";
const secret = "lol-tabtap-secret-koki-mill-2026";
const token = jwt.sign({userId:101,summonerName:"Test",tag:"T1"},secret,{expiresIn:"1h"});

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(t => {
    localStorage.setItem("lolteam_token", t);
    localStorage.setItem("lolteam_user", JSON.stringify({ id: 101, summonerName: "Test", tag: "T1" }));
  }, token);

  await page.goto(BASE + "/simulador", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(5000);

  const html = await page.content();
  const url = page.url();
  console.log("URL:", url);
  console.log("Has error UI:", html.includes("next-error") || html.includes("This page couldn"));
  console.log("Has LADO AZUL:", html.includes("LADO AZUL"));
  console.log("Has Simulador de Draft:", html.includes("Simulador de Draft"));
  console.log("Page errors:", errs.length);
  errs.forEach(e => console.log("  ", e.substring(0, 150)));

  if (html.includes("LADO AZUL")) {
    console.log("\n✅ SIMULADOR FUNCIONA!");
  } else {
    console.log("\n❌ Simulador no carga");
    const text = await page.evaluate(() => document.body?.innerText || "");
    console.log("Body:", text.substring(0, 300));
  }
  await browser.close();
}
main().catch(e => { console.error("FAIL:", e); process.exit(1); });
