import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers/auth";

test.describe("Webhook & API Key management", () => {
  const testEmail = uniqueEmail();

  test.beforeEach(async ({ page }) => {
    await signUp(page, testEmail);
  });

  test("webhook deliveries page loads", async ({ page }) => {
    await page.goto("/webhooks");
    await expect(page.locator("h2")).toContainText("Webhook Deliveries");

    // Should show deliveries list or empty state
    const hasDeliveries = await page.locator("ul li").count();
    if (hasDeliveries === 0) {
      await expect(page.getByText("No webhook deliveries yet")).toBeVisible();
    }
  });

  test("webhook endpoints CRUD", async ({ page }) => {
    await page.goto("/webhooks/endpoints");
    await expect(page.locator("h2")).toContainText("Webhook Endpoints");

    // Create a new endpoint
    await page.getByTestId("new-endpoint-button").click();
    await expect(page.getByTestId("new-endpoint-form")).toBeVisible();

    const testUrl = `https://example.com/hooks/${Date.now()}`;
    await page.getByTestId("endpoint-url-input").fill(testUrl);

    // Select the first event type checkbox
    const eventCheckbox = page.getByTestId("new-endpoint-form").locator("input[type='checkbox']").first();
    await eventCheckbox.check();

    await page.getByTestId("endpoint-submit").click();

    // Wait for the page to refresh and show the new endpoint
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_000);

    // The page refreshes via router.refresh(), so wait for the endpoint to appear
    await expect(page.getByTestId("endpoint-item").first()).toBeVisible({ timeout: 10_000 });

    // Verify the endpoint URL is visible
    await expect(page.getByText(testUrl.slice(0, 30))).toBeVisible();

    // Verify Active status
    const statusBadge = page.getByTestId("endpoint-item").first().getByTestId("endpoint-status");
    await expect(statusBadge).toContainText("Active");

    // Toggle to inactive
    await page.getByTestId("endpoint-toggle").first().click();
    await expect(statusBadge).toContainText("Inactive", { timeout: 5_000 });

    // Delete the endpoint
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("endpoint-delete").first().click();

    // After delete, either empty state or the endpoint is removed
    await expect(page.getByText(testUrl.slice(0, 30))).toBeHidden({ timeout: 5_000 });
  });

  test("API keys page loads and CRUD", async ({ page }) => {
    await page.goto("/api-keys");
    await expect(page.locator("h2")).toContainText("API Keys");

    // Create a new key
    await page.getByTestId("create-api-key-button").click();
    await expect(page.getByTestId("create-api-key-form")).toBeVisible();

    const keyLabel = `E2E Test Bot ${Date.now()}`;
    await page.getByTestId("api-key-label-input").fill(keyLabel);

    // Select first scope
    const scopeCheckbox = page.getByTestId("create-api-key-form").locator("input[type='checkbox']").first();
    await scopeCheckbox.check();

    await page.getByTestId("api-key-submit").click();

    // Verify plaintext key is displayed
    await expect(page.getByTestId("api-key-created")).toBeVisible({ timeout: 10_000 });
    const plaintextKey = await page.getByTestId("api-key-plaintext").textContent();
    expect(plaintextKey).toBeTruthy();
    expect(plaintextKey!.startsWith("to_")).toBe(true);

    // Dismiss the created key dialog
    await page.getByText("Done").click();

    // Verify key appears in list (page reloads)
    await expect(page.getByText(keyLabel)).toBeVisible({ timeout: 10_000 });

    // Revoke the key
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("revoke-api-key").first().click();

    // After revoke, page reloads; verify "Revoked" badge
    await expect(page.getByText("Revoked")).toBeVisible({ timeout: 10_000 });
  });
});
