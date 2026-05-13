import { chromium } from "playwright";

const SCREENSHOTS = [
  { url: "http://localhost:8081/", name: "01-app-home" },
  { url: "http://localhost:8081/settings", name: "02-settings" },
  { url: "http://localhost:8081/settings/subscriptions", name: "03-subscriptions" },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 430, height: 932 }, // iPhone 16 Pro logical viewport
  deviceScaleFactor: 2,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
page.on("pageerror", (err) => console.error("PAGE ERROR:", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("CONSOLE ERROR:", msg.text());
});

for (const { url, name } of SCREENSHOTS) {
  console.log(`-> ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  } catch (err) {
    console.error(`navigation failed: ${err.message}`);
  }
  // Give React a moment to mount after networkidle
  await page.waitForTimeout(2_000);
  await page.screenshot({
    path: `/tmp/kikoro-qa-out/web-${name}.png`,
    fullPage: false,
  });
  console.log(`   saved web-${name}.png`);
}

await browser.close();
console.log("done");
