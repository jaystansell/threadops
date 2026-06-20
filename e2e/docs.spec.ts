import { test, expect } from "@playwright/test";

test.describe("API Docs page", () => {
  test("loads without auth", async ({ page }) => {
    await page.goto("/docs/api");
    await expect(page.locator("text=API Documentation")).toBeVisible();
  });

  test("renders endpoint sections", async ({ page }) => {
    await page.goto("/docs/api");

    // The docs page has sections for Threads, Messages, API Keys, Webhooks, Themes
    await expect(page.getByText("Threads", { exact: true })).toBeVisible();
    await expect(page.getByText("Messages", { exact: true })).toBeVisible();
    await expect(page.getByText("API Keys", { exact: true })).toBeVisible();
    await expect(page.getByText("Webhooks", { exact: true })).toBeVisible();
    await expect(page.getByText("Themes", { exact: true })).toBeVisible();
  });

  test("clicking an endpoint expands details", async ({ page }) => {
    await page.goto("/docs/api");

    // Click on the first endpoint button to expand it
    const endpointButton = page.locator("button").filter({ hasText: "/api/threads" }).first();
    await endpointButton.click();

    // Verify details are expanded: description, auth info, curl example
    await expect(page.getByText("Auth:")).toBeVisible();
    await expect(page.locator("pre").first()).toBeVisible();
  });
});
