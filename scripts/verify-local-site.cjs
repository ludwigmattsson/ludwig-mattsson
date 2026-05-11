const { chromium } = require("/Users/ludwigmattsson/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const baseUrl = new URL(process.argv[2] || "http://127.0.0.1:4175/ludwig-mattsson/");
const routesToVerify = [
  ["home", ""],
  ["traton-design-system", "traton-design-system/"],
  ["scaniaexperience", "scaniaexperience/"],
  ["interdependence", "interdependence/"],
  ["boxen", "boxen/"],
  ["keepy", "keepy/"],
  ["tequila-club", "tequila-club/"],
  ["info", "info/"],
  ["index", "index/"],
];

function routeUrl(route) {
  return new URL(route, baseUrl).href;
}

async function collectMetrics(page, label) {
  await page.waitForTimeout(1200);
  return page.evaluate((currentLabel) => ({
    label: currentLabel,
    url: location.href,
    title: document.title,
    heading: document.querySelector("h1,h2,h3,h4,h5,h6")?.textContent?.trim() || "",
    textStart: document.body.innerText.slice(0, 240),
    images: Array.from(document.images).length,
    completeImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0).length,
    iframes: Array.from(document.querySelectorAll("iframe")).map((frame) => frame.src),
    links: Array.from(document.querySelectorAll("a")).map((anchor) => anchor.getAttribute("href")).filter(Boolean).slice(0, 80),
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }), label);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 1,
  });

  const events = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      events.push({ type: "console", level: msg.type(), text: msg.text().slice(0, 500), page: page.url() });
    }
  });
  page.on("pageerror", (error) => {
    events.push({ type: "pageerror", text: String(error.stack || error).slice(0, 1000), page: page.url() });
  });
  page.on("requestfailed", (request) => {
    events.push({ type: "requestfailed", url: request.url(), failure: request.failure(), page: page.url() });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      events.push({ type: "response", status: response.status(), url: response.url(), page: page.url() });
    }
  });

  const results = [];
  for (const [label, route] of routesToVerify) {
    await page.goto(routeUrl(route), { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
    results.push(await collectMetrics(page, label));

    if (label === "home") {
      await page.screenshot({ path: "/private/tmp/ludwigmattsson-home.png", fullPage: false });
    }
  }

  await browser.close();

  const localIssues = events.filter((event) => {
    const haystack = `${event.url || ""} ${event.text || ""}`;
    return haystack.includes("127.0.0.1") || haystack.includes("localhost");
  });

  console.log(JSON.stringify({
    results,
    localIssueCount: localIssues.length,
    localIssues,
    eventCount: events.length,
    events: events.slice(0, 120),
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
