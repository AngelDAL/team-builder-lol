const { chromium } = require("playwright");
const jwt = require("jsonwebtoken");

const BASE = "http://localhost:3005";
const secret = "lol-tabtap-secret-koki-mill-2026";
const tokenA = jwt.sign({userId:101,summonerName:"PlayerOne",tag:"P1"},secret,{expiresIn:"1h"});
const tokenB = jwt.sign({userId:102,summonerName:"PlayerTwo",tag:"P2"},secret,{expiresIn:"1h"});

async function main() {
  console.log("Token A:", tokenA.substring(0,30)+"...");
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext();
  const p1 = await ctx.newPage();
  const p2 = await ctx.newPage();
  const e1=[], e2=[];
  p1.on("pageerror",e=>e1.push(e.message));
  p2.on("pageerror",e=>e2.push(e.message));

  // Set auth on both pages
  console.log("=== Setting auth ===");
  await p1.goto(BASE, {waitUntil:"domcontentloaded"});
  await p1.evaluate(t=>{localStorage.setItem("lolteam_token",t);localStorage.setItem("lolteam_user",JSON.stringify({id:101,summonerName:"PlayerOne",tag:"P1"}));}, tokenA);
  let check = await p1.evaluate(()=>localStorage.getItem("lolteam_token"));
  console.log("P1 token:", check ? check.substring(0,20)+"..." : "NONE");

  await p2.goto(BASE, {waitUntil:"domcontentloaded"});
  await p2.evaluate(t=>{localStorage.setItem("lolteam_token",t);localStorage.setItem("lolteam_user",JSON.stringify({id:102,summonerName:"PlayerTwo",tag:"P2"}));}, tokenB);
  check = await p2.evaluate(()=>localStorage.getItem("lolteam_token"));
  console.log("P2 token:", check ? check.substring(0,20)+"..." : "NONE");

  // P1: Create simulation
  console.log("\n=== P1: Create sim ===");
  await p1.goto(BASE+"/simulador", {waitUntil:"networkidle"});
  await p1.waitForTimeout(5000);
  let html = await p1.content();
  console.log("P1 has AZUL:", html.includes("LADO AZUL"));
  console.log("P1 has spinner:", html.includes("animate-pulse"));
  console.log("P1 errors:", e1.length);
  e1.forEach(x=>console.log("  ",x.substring(0,150)));

  if (html.includes("LADO AZUL")) {
    await p1.locator("button:has-text('LADO AZUL')").first().click();
    await p1.waitForTimeout(2000);
    html = await p1.content();
    console.log("P1 has Compartir:", html.includes("Compartir simulaci\u00f3n"));
  }

  // P2: Check active sessions
  console.log("\n=== P2: Check actives ===");
  await p2.goto(BASE+"/simulador", {waitUntil:"networkidle"});
  await p2.waitForTimeout(5000);
  html = await p2.content();
  console.log("P2 has AZUL:", html.includes("LADO AZUL"));
  console.log("P2 has 'Simulaciones activas':", html.includes("Simulaciones activas"));
  console.log("P2 has 'PlayerOne':", html.includes("PlayerOne"));
  console.log("P2 errors:", e2.length);
  e2.forEach(x=>console.log("  ",x.substring(0,150)));

  const ok = html.includes("Simulaciones activas") && html.includes("PlayerOne");
  console.log("\n" + (ok ? "✅ SUCCESS" : "❌ FAILED"));
  await browser.close();
}
main().catch(e=>{console.error("FAIL:",e);process.exit(1);});
