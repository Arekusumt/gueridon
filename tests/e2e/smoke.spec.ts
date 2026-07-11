import { expect, test } from "@playwright/test";

const BASE = process.env.E2E_BASE ?? "http://localhost:3111";

test("editorial page: cover, essay, receipts, footer", async ({ page }) => {
  await page.goto(`${BASE}/en`);
  await expect(page.getByRole("heading", { name: "GUERIDON" })).toBeVisible();
  await expect(page.locator("#receipts li")).toHaveCount(28);

  // Deep-scroll paint check (guards against invisible-content regressions).
  await page.locator("#receipts").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const shot = await page.screenshot({ type: "png" });
  // A blank ivory viewport compresses tiny; painted text pushes size well up.
  expect(shot.byteLength).toBeGreaterThan(30_000);
  await page.screenshot({ path: "test-results/receipts-real.png" });

  await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible();
});

test("spanish locale renders", async ({ page }) => {
  await page.goto(`${BASE}/es`);
  await expect(page.getByText("La ciencia de la carta, servida como es debido.")).toBeVisible();
});

test("analyzer demo flow end to end", async ({ page }) => {
  await page.goto(`${BASE}/en/analyze`);
  await page.getByRole("button", { name: "Taste the demo instead" }).click();
  await expect(page.getByText("The Waterfront Irish Pub").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Menu score", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "Price moves" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/dashboard-real.png" });
  // The redesigned carta rendered with sections and leader lines.
  await expect(page.locator(".print-carta section").first()).toBeAttached();
  await page.locator(".print-carta").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/carta-real.png" });
});

test("dropzone is evident and info dots explain", async ({ page }) => {
  await page.goto(`${BASE}/en/analyze`);
  await expect(
    page.getByRole("button", { name: "Add photos, a PDF or a text file of your menu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add competitor menus — photos, PDFs or text files" }),
  ).toBeVisible();

  await page.goto(`${BASE}/en`);
  const dot = page.locator(".info-dot").first();
  await dot.scrollIntoViewIfNeeded();
  await dot.click();
  await expect(page.locator(".info-pop").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".info-pop")).toHaveCount(0);
});

test("sales CSV with seasons → measured mode → refine table re-fire", async ({ page }) => {
  await page.goto(`${BASE}/en/analyze`);
  await page
    .getByLabel("Menu text")
    .fill(
      "MAINS\nFish & Chips ..... 13.50\nCheese Burger ..... 12.90\n\nDRINKS\nGuinness Pint ..... 5.50",
    );

  const csv = [
    "dish,units,cost,period",
    "Fish & Chips,210,4.20,summer",
    "Fish & Chips,120,4.50,winter",
    "Cheese Burger,150,3.90,summer",
    "Guinness Pint,900,1.10,summer",
  ].join("\n");
  await page
    .getByRole("button", { name: /Add sales data/ })
    .locator("input[type=file]")
    .setInputFiles({ name: "sales.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  // Periods parsed into toggleable chips; winter off → summer-only analysis.
  await expect(page.getByRole("button", { name: "summer", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "winter", exact: true }).click();
  await expect(page.getByText("4 rows · 3 dishes with data")).toBeVisible();

  await page.getByRole("button", { name: "Fire the analysis" }).click();
  // Full real units+costs → the header says measured, not estimated.
  await expect(page.getByText("real data").first()).toBeVisible({ timeout: 20_000 });

  // The refine table re-fires with edited numbers and stays measured.
  await expect(page.getByRole("heading", { name: "Your numbers" })).toBeVisible();
  await page.getByLabel("Units sold — Fish & Chips").fill("500");
  await page.getByRole("button", { name: "Re-fire with real numbers" }).click();
  await expect(page.getByText("real data").first()).toBeVisible({ timeout: 20_000 });
});

test("mobile 360px: no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${BASE}/en`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/cover-mobile.png" });
});
