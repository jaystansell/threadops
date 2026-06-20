import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers/auth";

test.describe("Thread flows", () => {
  const threadTitle = `Test Thread ${Date.now()}`;
  const threadMessage = "This is the first message in the test thread.";
  const replyMessage = "This is a reply to the test thread.";

  test.beforeEach(async ({ page }) => {
    const testEmail = uniqueEmail();
    await signUp(page, testEmail);
  });

  test("create a new thread", async ({ page }) => {
    await page.getByRole("link", { name: "New Thread" }).click();
    await page.waitForURL("/threads/new");

    await page.getByTestId("thread-title-input").fill(threadTitle);
    await page.getByTestId("thread-message-input").fill(threadMessage);

    // Select a theme if available
    const themeSelect = page.getByTestId("thread-theme-select");
    const options = themeSelect.locator("option");
    const optionCount = await options.count();
    if (optionCount > 1) {
      await themeSelect.selectOption({ index: 1 });
    }

    await page.getByTestId("thread-submit").click();

    // Should redirect to thread detail page
    await page.waitForURL(/\/threads\/[a-f0-9-]+/);
    await expect(page.locator("h2")).toContainText(threadTitle);
    await expect(page.getByTestId("timeline-message")).toHaveCount(1);
  });

  test("post a message in a thread", async ({ page }) => {
    // Create a thread first
    await page.getByRole("link", { name: "New Thread" }).click();
    await page.waitForURL("/threads/new");
    const title = `Reply Test ${Date.now()}`;
    await page.getByTestId("thread-title-input").fill(title);
    await page.getByTestId("thread-message-input").fill("Initial message");
    await page.getByTestId("thread-submit").click();
    await page.waitForURL(/\/threads\/[a-f0-9-]+/);

    // Post a reply
    await page.getByTestId("message-input").fill(replyMessage);
    await page.getByTestId("message-send").click();

    // Wait for message to appear
    await expect(page.getByText(replyMessage)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("timeline-message")).toHaveCount(2);
  });

  test("change thread status (close and reopen)", async ({ page }) => {
    // Create a thread
    await page.getByRole("link", { name: "New Thread" }).click();
    await page.waitForURL("/threads/new");
    const title = `Status Test ${Date.now()}`;
    await page.getByTestId("thread-title-input").fill(title);
    await page.getByTestId("thread-message-input").fill("Testing status changes");
    await page.getByTestId("thread-submit").click();
    await page.waitForURL(/\/threads\/[a-f0-9-]+/);

    // Close the thread
    await page.getByTestId("status-action-closed").click();
    await expect(page.getByText("closed")).toBeVisible({ timeout: 5_000 });

    // Reopen the thread
    await page.getByTestId("status-action-open").click();
    await expect(page.getByText("open")).toBeVisible({ timeout: 5_000 });
  });

  test("search threads", async ({ page }) => {
    // Create a thread with a unique title for search
    const searchTitle = `Searchable ${Date.now()}`;
    await page.getByRole("link", { name: "New Thread" }).click();
    await page.waitForURL("/threads/new");
    await page.getByTestId("thread-title-input").fill(searchTitle);
    await page.getByTestId("thread-message-input").fill("Search test body");
    await page.getByTestId("thread-submit").click();
    await page.waitForURL(/\/threads\/[a-f0-9-]+/);

    // Go back to thread list
    await page.getByRole("link", { name: "Threads" }).first().click();
    await page.waitForURL("/threads");

    // Search for the thread
    await page.getByTestId("search-input").fill(searchTitle);
    await page.getByTestId("search-submit").click();

    // Verify filtered results
    await expect(page.getByText(searchTitle)).toBeVisible();
  });

  test("theme filter", async ({ page }) => {
    // Navigate to threads page
    await page.goto("/threads");

    const themeFilter = page.getByTestId("theme-filter");
    const options = themeFilter.locator("option");
    const optionCount = await options.count();

    // If there are themes available (beyond "All themes")
    if (optionCount > 1) {
      // Get the name of the first theme option
      const themeName = await options.nth(1).textContent();
      await themeFilter.selectOption({ index: 1 });

      // URL should contain theme parameter
      await expect(page).toHaveURL(/theme=/);

      // Reset to all themes
      await themeFilter.selectOption({ index: 0 });
      await expect(page).toHaveURL(/\/threads/);

      expect(themeName).toBeTruthy();
    }
  });
});
