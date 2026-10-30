/* eslint-disable @typescript-eslint/no-require-imports -- Standalone managed-runtime browser checks. */
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
    await page.goto(base + "/assistant");
    await page.getByText("What would make", { exact: false }).waitFor();
    assert.equal(await page.locator(".starter-grid button").count(), 4);
    await page.screenshot({
      path: "/tmp/ruralclass-assistant-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Assistant settings" }).click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        document
          .querySelector("[role=dialog]")
          .contains(document.activeElement),
      ),
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Assistant settings" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    console.log(
      "PASS shadcn settings dialog, keyboard focus and cloud configuration status",
    );
    await page.locator(".starter-grid button").first().click();
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.locator(".proposal-card").waitFor();
    assert.ok(
      (await page.locator(".proposal-card").innerText()).includes(
        "150 minutes available",
      ),
    );
    assert.ok(
      (await page.locator(".context-totals").innerText()).includes("180"),
    );
    await page.locator(".proposal-details summary").click();
    await page.locator(".proposal-details .schedule").waitFor();
    console.log(
      "PASS lost-time proposal and preview do not change approved classroom",
    );
    await page
      .getByRole("button", { name: "Approve proposed timetable", exact: true })
      .click();
    await page
      .getByText("Timetable approved and saved.", { exact: false })
      .waitFor();
    assert.ok(
      (await page.locator(".context-totals").innerText()).includes("150"),
    );
    await page.getByLabel("Teacher request").fill("I lost 20 minutes.");
    await page.getByLabel("Teacher request").press("Control+Enter");
    await page.getByText("130 minutes available", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Dismiss draft", exact: true })
      .click();
    await page.getByText("Draft dismissed.", { exact: false }).waitFor();
    assert.ok(
      (await page.locator(".context-totals").innerText()).includes("150"),
    );
    console.log(
      "PASS approval updates classroom; follow-up uses current time; dismiss preserves saved plan",
    );
    await page.reload();
    await page.locator(".chat-message").first().waitFor();
    assert.ok(
      (await page.locator(".context-totals").innerText()).includes("150"),
    );
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await page.locator(".companion-welcome").waitFor();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.locator(".history-item").first().click();
    await page.locator(".chat-message").first().waitFor();
    console.log(
      "PASS conversation persistence, new chat and saved history restore",
    );
    await page.getByRole("tab", { name: "Worksheet studio" }).click();
    await page.getByLabel("Worksheet grade", { exact: true }).selectOption("3");
    await page.getByLabel("Worksheet topic").selectOption("subtraction");
    await page.getByLabel("Worksheet difficulty").selectOption("supported");
    await page
      .getByRole("button", { name: "Prepare worksheet", exact: true })
      .click();
    const sheet = page.locator(".worksheet-card");
    await sheet.waitFor();
    assert.equal(await sheet.locator("li").count(), 4);
    await page
      .getByRole("button", { name: "Show answer key", exact: true })
      .click();
    assert.equal(await sheet.locator(".worksheet-answer").count(), 4);
    await page
      .getByRole("button", { name: "Hide answer key", exact: true })
      .click();
    const downloadEvent = page.waitForEvent("download");
    await sheet.getByRole("button", { name: "Download", exact: true }).click();
    const download = await downloadEvent;
    const text = readFileSync(await download.path(), "utf8");
    assert.ok(text.includes("Class 3"));
    assert.ok(!text.includes("Answer:"));
    const popupEvent = page.waitForEvent("popup");
    await sheet
      .getByRole("button", { name: "Print worksheet", exact: true })
      .click();
    const popup = await popupEvent;
    await popup.waitForLoadState("domcontentloaded");
    assert.ok((await popup.locator("pre").innerText()).includes("Class 3"));
    assert.ok(!(await popup.locator("pre").innerText()).includes("Answer:"));
    await popup.close();
    await page.screenshot({
      path: "/tmp/ruralclass-worksheet.png",
      fullPage: true,
    });
    console.log(
      "PASS worksheet builder, correct-length activity, answer-key toggle and learner download",
    );
    await page.getByRole("tab", { name: "Assistant", exact: true }).click();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    await context.setOffline(true);
    await page.reload();
    await page.locator(".chat-message").first().waitFor();
    await page
      .getByLabel("Teacher request")
      .fill("Generate a timetable for 90 minutes.");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page.getByText("90 minutes available", { exact: true }).waitFor();
    await page
      .getByLabel("Teacher request")
      .fill("Create a reading worksheet for Class 2");
    await page
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await page
      .getByText("The little seed experiment", { exact: true })
      .waitFor();
    console.log(
      "PASS network-disabled conversation reload, schedule proposal and reading worksheet",
    );
    await context.setOffline(false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/assistant");
    await page.locator(".chat-message").first().waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "Assistant settings" }).click();
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.getBoundingClientRect().right > innerWidth),
      false,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: "/tmp/ruralclass-assistant-mobile.png",
      fullPage: true,
    });
    console.log(
      "PASS mobile chat, accessible dialog and no horizontal page overflow",
    );
    const status = await page.request.get(base + "/api/assistant");
    const data = await status.json();
    assert.equal(data.configured, false);
    assert.equal("apiKey" in data, false);
    assert.equal("token" in data, false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS secret-free status response and no browser runtime errors",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
