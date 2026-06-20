import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers/auth";

test.describe("API key auth for agent messages", () => {
  test("create API key and post a message via fetch with X-API-Key", async ({ page }) => {
    const testEmail = uniqueEmail();
    await signUp(page, testEmail);

    // First, create a thread so we have a threadId
    await page.getByRole("link", { name: "New Thread" }).click();
    await page.waitForURL("/threads/new");

    const threadTitle = `API Key Auth Test ${Date.now()}`;
    await page.getByTestId("thread-title-input").fill(threadTitle);
    await page.getByTestId("thread-message-input").fill("Initial message for API key test");
    await page.getByTestId("thread-submit").click();
    await page.waitForURL(/\/threads\/([a-f0-9-]+)/);

    // Extract threadId from the URL
    const threadId = page.url().split("/threads/")[1];

    // Now create an API key
    await page.goto("/api-keys");
    await page.getByTestId("create-api-key-button").click();
    await expect(page.getByTestId("create-api-key-form")).toBeVisible();

    const agentName = `E2E Agent ${Date.now()}`;
    await page.getByTestId("api-key-label-input").fill(agentName);

    // Select messages:write scope if available, otherwise select first scope
    const scopeCheckboxes = page.getByTestId("create-api-key-form").locator("input[type='checkbox']");
    const scopeCount = await scopeCheckboxes.count();
    for (let i = 0; i < scopeCount; i++) {
      await scopeCheckboxes.nth(i).check();
    }

    await page.getByTestId("api-key-submit").click();
    await expect(page.getByTestId("api-key-created")).toBeVisible({ timeout: 10_000 });

    // Grab the plaintext key
    const plaintextKey = await page.getByTestId("api-key-plaintext").textContent();
    expect(plaintextKey).toBeTruthy();

    // Use the API key to POST a message via fetch
    const agentMessage = `Hello from agent ${Date.now()}`;
    const response = await page.evaluate(
      async ({ threadId, apiKey, body }) => {
        const res = await fetch(`/api/threads/${threadId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ body }),
        });
        return { status: res.status, data: await res.json() };
      },
      { threadId, apiKey: plaintextKey!, body: agentMessage },
    );

    expect(response.status).toBe(201);
    expect(response.data.author_kind).toBe("agent");
    expect(response.data.author_name).toBe(agentName);

    // Navigate to the thread and verify the agent message shows with agent badge
    await page.goto(`/threads/${threadId}`);
    await expect(page.getByText(agentMessage)).toBeVisible({ timeout: 10_000 });

    // Verify agent badge is visible
    await expect(page.getByText(agentName)).toBeVisible();
  });
});
