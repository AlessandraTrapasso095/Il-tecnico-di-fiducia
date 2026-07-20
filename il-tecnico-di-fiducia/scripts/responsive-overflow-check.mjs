import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const routes = (process.env.RESPONSIVE_ROUTES ?? "/,/auth/login,/auth/register,/admin/login,/customer,/professionista,/professionista/messaggi,/admin")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

const viewports = [
  { width: 320, height: 568, name: "iPhone SE" },
  { width: 360, height: 800, name: "Android small" },
  { width: 375, height: 667, name: "iPhone standard" },
  { width: 390, height: 844, name: "iPhone Pro" },
  { width: 430, height: 932, name: "Phone large" },
  { width: 768, height: 1024, name: "iPad vertical" },
  { width: 820, height: 1180, name: "iPad Air vertical" },
  { width: 1024, height: 768, name: "Tablet landscape" },
  { width: 1280, height: 800, name: "Desktop" },
  { width: 1440, height: 900, name: "Desktop large" },
];

function urlFor(route) {
  return new URL(route, baseUrl).toString();
}

const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];

for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  for (const route of routes) {
    const targetUrl = urlFor(route);
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    }).catch((error) => {
      failures.push({
        route,
        viewport,
        reason: `navigation failed: ${error.message}`,
      });
      return null;
    });

    if (!response) continue;
    await page.waitForTimeout(500);

    const status = response.status();
    if (status >= 500) {
      failures.push({
        route,
        viewport,
        reason: `server error ${status}`,
      });
      continue;
    }

    const result = await page.evaluate(() => {
      const documentElement = document.documentElement;
      const viewportWidth = documentElement.clientWidth;
      const overflowAmount = documentElement.scrollWidth - viewportWidth;
      const offenders = Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className:
              typeof element.className === "string"
                ? element.className
                : element.getAttribute("class"),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
        .slice(0, 8);

      return {
        clientWidth: viewportWidth,
        scrollWidth: documentElement.scrollWidth,
        overflowAmount,
        offenders,
      };
    });

    if (result.overflowAmount > 1) {
      failures.push({
        route,
        viewport,
        reason: `horizontal overflow ${result.overflowAmount}px`,
        details: result,
      });
    }
  }
}

await browser.close();

if (failures.length > 0) {
  console.error("[responsive-overflow] Failures detected:");
  for (const failure of failures) {
    console.error(
      `- ${failure.viewport.width}x${failure.viewport.height} ${failure.viewport.name} ${failure.route}: ${failure.reason}`,
    );
    if (failure.details?.offenders?.length) {
      console.error(JSON.stringify(failure.details.offenders, null, 2));
    }
  }
  process.exit(1);
}

console.log(
  `[responsive-overflow] OK: ${routes.length} route(s) checked across ${viewports.length} viewport(s).`,
);
