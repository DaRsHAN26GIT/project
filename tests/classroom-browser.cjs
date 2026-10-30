/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser regression check. */
const { chromium } = require("playwright");
const { existsSync } = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (
      /synchronously unmount a root|React cannot finish unmounting|race condition/i.test(
        message.text(),
      )
    )
      failures.push(message.text());
  });
  try {
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:3000");
    const enter = page.getByRole("button", {
      name: "Explore in 3D",
      exact: true,
    });
    await page.waitForFunction(
      () => !document.querySelector(".room-toolbar button")?.disabled,
    );
    for (let cycle = 0; cycle < 3; cycle++) {
      await enter.click();
      await page.locator(".canvas canvas").waitFor();
      await page
        .getByRole("button", { name: "Class 4 Independent", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Class 2 Independent", exact: true })
        .click();
      await page.waitForTimeout(250);
      await page
        .getByRole("button", { name: "Use 2D view", exact: true })
        .click();
      await page.locator(".flat-room").waitFor();
      assert.equal(await page.locator(".canvas canvas").count(), 0);
    }
    await page.waitForTimeout(250);
    assert.deepEqual(failures, []);
    console.log(
      "PASS repeated 3D mounts, grade changes and 2D unmounts without React root warnings",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
