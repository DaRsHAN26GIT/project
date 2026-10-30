/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser/API evidence check. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1512, height: 1100 },
    reducedMotion: "reduce",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_BASE_URL || "http://localhost:3000";
  try {
    await page.goto(base + "/evaluation");
    await page.getByRole("heading", { name: /A small classroom/ }).waitFor();
    assert.equal(await page.getByRole("tab").count(), 6);
    await page.screenshot({
      path: "/tmp/ruralclass-evaluation-desktop.png",
      fullPage: true,
    });
    await page.screenshot({
      path: "/tmp/ruralclass-evaluation-hero.png",
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "Run interruption challenge", exact: true })
      .click();
    await page.getByText("180 → 135 minutes", { exact: true }).waitFor();
    assert.ok(
      (await page.locator(".judge-metric-number").nth(2).innerText()).includes(
        "15",
      ),
    );
    assert.equal(await page.locator(".judge-audit li").count(), 7);
    await page.getByLabel("Teaching time lost").fill("60");
    await page.getByLabel("Grade needing more support").selectOption("4");
    await page
      .getByRole("button", { name: "Recalculate scenario", exact: true })
      .click();
    await page.getByText("180 → 120 minutes", { exact: true }).waitFor();
    assert.ok(
      (await page.locator(".judge-metric-number").nth(2).innerText()).includes(
        "30",
      ),
    );
    console.log(
      "PASS customizable judge interruption, real unmet requirements and independent audits",
    );
    for (const criterion of [
      "Innovation",
      "Impact",
      "Execution",
      "UI/UX",
      "Demo",
      "Feasibility",
    ]) {
      await page.getByRole("tab", { name: criterion, exact: true }).click();
      await page
        .getByRole("heading", { name: criterion, exact: true })
        .waitFor();
    }
    await page.getByRole("tab", { name: "Innovation", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("heading", { name: "Impact", exact: true }).waitFor();
    console.log("PASS all six rubric panels and keyboard tab navigation");
    await page.getByRole("tab", { name: "Execution", exact: true }).click();
    await page
      .getByRole("button", { name: "Run live system check", exact: true })
      .click();
    await page
      .getByText("Frontend/backend parity verified for this scenario.", {
        exact: true,
      })
      .waitFor();
    assert.ok(
      (await page.locator(".service-grid").innerText()).includes(
        "Not configured",
      ),
    );
    console.log(
      "PASS real health endpoint and scheduling API match the local calculation",
    );
    await page.locator(".system-check").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "/tmp/ruralclass-evaluation-api.png",
      fullPage: false,
    });
    await context.setOffline(true);
    await page
      .locator(".app-header .status")
      .filter({ hasText: "Offline" })
      .waitFor();
    await page
      .getByRole("button", { name: "Run live system check", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Server APIs need connectivity" })
      .waitFor();
    await page
      .locator(".service-tile")
      .first()
      .getByText("Not checked", { exact: true })
      .waitFor();
    await context.setOffline(false);
    await page
      .locator(".app-header .status")
      .filter({ hasText: "Online" })
      .waitFor();
    await page
      .getByRole("button", { name: "Run live system check", exact: true })
      .click();
    await page
      .getByText("Frontend/backend parity verified for this scenario.", {
        exact: true,
      })
      .waitFor();
    console.log(
      "PASS failed connectivity clears stale service status, and the check recovers online",
    );
    const response = await page.request.get(base + "/api/health");
    const health = await response.json();
    assert.equal(response.status(), 200);
    assert.equal(health.scheduler.status, "passed");
    assert.equal(health.authentication.configured, false);
    assert.equal(health.database.status, "not_configured");
    assert.equal(response.headers()["cache-control"], "no-store");
    assert.ok(
      !/apiKey|HF_TOKEN|OPENAI_API_KEY|Bearer/.test(JSON.stringify(health)),
    );
    const malformed = await page.request.post(base + "/api/schedule", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    assert.equal(malformed.status(), 400);
    const oversized = await page.request.post(base + "/api/schedule", {
      headers: { "Content-Type": "application/json" },
      data: "x".repeat(50000),
    });
    assert.equal(oversized.status(), 413);
    console.log(
      "PASS secret-free live health and scheduling API payload validation",
    );
    await page
      .getByLabel("Optional evaluator observations")
      .fill(
        "Judge chose 60 lost minutes. <script>window.injected=true</script>",
      );
    const exportEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export judge evidence", exact: true })
      .click();
    const download = await exportEvent;
    const report = JSON.parse(readFileSync(await download.path(), "utf8"));
    assert.equal(report.after.plan.input.minutes, 120);
    assert.equal(report.after.audit.unmetMinutes, 30);
    assert.equal(report.criteria.length, 6);
    assert.equal(report.backendObservation.scheduleParity.matches, true);
    assert.equal(report.observations.fieldTesting, "Not conducted");
    const popupEvent = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Print judge brief", exact: true })
      .click();
    const popup = await popupEvent;
    await popup.waitForLoadState("domcontentloaded");
    assert.ok((await popup.locator("pre").innerText()).includes("180 → 120"));
    assert.equal(await popup.evaluate(() => window.injected), undefined);
    await popup.close();
    console.log(
      "PASS downloadable reproducible evidence and safe printable judge brief",
    );
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((r) =>
          navigator.serviceWorker.addEventListener("controllerchange", r, {
            once: true,
          }),
        );
    });
    await context.setOffline(true);
    await page.reload();
    await page
      .getByRole("button", { name: "Run interruption challenge", exact: true })
      .click();
    await page.getByText("180 → 135 minutes", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Execution", exact: true }).click();
    await page
      .getByRole("button", { name: "Run live system check", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Server APIs need connectivity" })
      .waitFor();
    console.log(
      "PASS cached judge page and local challenge offline; server unavailability is reported honestly",
    );
    await context.setOffline(false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/evaluation");
    await page
      .getByRole("button", { name: "Run interruption challenge", exact: true })
      .waitFor();
    await page.getByRole("tab", { name: "Feasibility", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "/tmp/ruralclass-evaluation-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS mobile evaluation layout, scrollable rubric controls and no browser runtime errors",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
