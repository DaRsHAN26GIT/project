/* eslint-disable @typescript-eslint/no-require-imports -- Standalone browser runner uses the managed runtime CommonJS Playwright installation. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
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
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.TEST_BASE_URL || "http://localhost:3000";
  try {
    await page.goto(base);
    await page.getByRole("heading", { name: /One teacher/ }).waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: "/tmp/ruralclass-landing.png",
      fullPage: true,
    });
    assert.ok(
      await page.getByRole("button", { name: "Explore in 3D" }).isDisabled(),
    );
    console.log("PASS landing and reduced-motion 2D fallback");
    await page.goto(base + "/timetable");
    await page.getByRole("button", { name: "Generate timetable" }).click();
    await page.getByLabel("Available minutes").fill("120");
    await page.getByRole("button", { name: "Generate timetable" }).click();
    await page.getByText(/Unmet requirements:/).waitFor();
    await page
      .getByRole("button", { name: "Approve & save current plan" })
      .click();
    await page.getByText("Saved on this device.").waitFor();
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector("input")?.value === "120",
    );
    console.log(
      "PASS timetable generation, infeasibility, approval and IndexedDB reload",
    );
    await page.goto(base + "/replanning");
    await page.getByRole("button", { name: "Challenge RuralClass" }).click();
    await page
      .getByRole("heading", { name: "Every change, explained." })
      .waitFor();
    assert.ok(
      (
        await page.locator(".compare-grid .panel").allTextContents()
      )[1].includes("90"),
    );
    await page
      .getByRole("button", { name: "Approve revised timetable" })
      .click();
    await page.getByText("Saved on this device.").waitFor();
    console.log("PASS live replanning and approval");
    for (const route of [
      "dashboard",
      "activities",
      "assistant",
      "analytics",
      "simulation",
      "portal",
      "offline",
      "impact",
      "presentation",
    ]) {
      await page.goto(base + "/" + route);
      await page.locator("h1").waitFor();
      assert.ok(await page.locator("h1").textContent());
    }
    console.log("PASS all application routes");
    await page.goto(base + "/activities");
    await page.getByRole("button", { name: "Mark complete" }).first().click();
    await page.getByText("Saved on this device.").waitFor();
    await page.reload();
    await page.getByRole("button", { name: "Completed" }).first().waitFor();
    console.log("PASS activity completion persistence");
    await page.goto(base + "/offline");
    await page
      .getByLabel("Today’s observation")
      .fill("Fictional group practiced counting seeds.");
    await page.getByRole("button", { name: "Save note locally" }).click();
    await page.getByText("Saved on this device.").waitFor();
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("ruralclass", 1);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("records", "readwrite");
        tx.objectStore("records").put({
          id: "other-owner:note",
          owner: "other-owner",
          kind: "observation",
          value: { note: "Private note from another account" },
          revision: 1,
          updatedAt: new Date().toISOString(),
          synced: false,
        });
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
      db.close();
    });
    await page.reload();
    assert.equal(
      await page.getByText("Private note from another account").count(),
      0,
    );
    const api = await page.request.post(base + "/api/assistant", {
      data: { message: "hello" },
    });
    assert.equal(api.status(), 503);
    console.log(
      "PASS local account isolation and unconfigured cloud API fallback",
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
      .getByText("Fictional group practiced counting seeds.", { exact: true })
      .waitFor();
    await page.getByRole("link", { name: "Timetable studio" }).click();
    await page.getByRole("button", { name: "Generate timetable" }).click();
    await page.getByText(/Timetable calculated/).waitFor();
    console.log("PASS network-disabled reload, saved records and scheduling");
    await page.goto(base + "/assistant");
    await page
      .getByLabel("Teacher request")
      .fill("Reduce time to 60 minutes and prioritize Class 3");
    await page.getByRole("button", { name: "Send message" }).click();
    await page
      .getByText(
        "Calculated locally using a deterministic scheduling heuristic.",
        { exact: false },
      )
      .waitFor();
    console.log("PASS offline command assistant");
    await context.setOffline(false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/dashboard");
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("link", { name: "Learning continuity", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Keep every learner moving." })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => document.activeElement !== document.body),
    );
    await page.screenshot({
      path: "/tmp/ruralclass-mobile.png",
      fullPage: true,
    });
    console.log("PASS mobile navigation, overflow and keyboard focus");
    assert.deepEqual(errors, []);
    console.log("PASS no browser runtime errors");
    const visualContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "no-preference",
    });
    const visualPage = await visualContext.newPage();
    visualPage.on("pageerror", (e) => errors.push(e.message));
    await visualPage.goto(base);
    const toggle = visualPage.getByRole("button", { name: "Explore in 3D" });
    await visualPage.waitForTimeout(500);
    if (await toggle.isEnabled()) {
      await toggle.click();
      await visualPage.locator(".canvas canvas").waitFor();
      await visualPage
        .getByRole("button", { name: "Class 4 Independent" })
        .click();
      await visualPage.waitForTimeout(1200);
      await visualPage.screenshot({
        path: "/tmp/ruralclass-3d.png",
        fullPage: false,
      });
      assert.deepEqual(errors, []);
      console.log(
        "PASS lazy-loaded interactive 3D classroom without runtime errors",
      );
    } else
      console.log(
        "SKIP actual 3D rendering: WebGL unavailable; 2D fallback passed",
      );
    await visualContext.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
