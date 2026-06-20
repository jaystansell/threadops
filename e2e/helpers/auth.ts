import { type Page, expect } from "@playwright/test";

const TEST_PASSWORD = "testpass123!";

export function uniqueEmail(): string {
  return `test+${Date.now()}@example.com`;
}

export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(TEST_PASSWORD);
  await page.getByTestId("signup-submit").click();

  // After signup with email confirmation disabled, user lands on /threads or /onboarding
  await page.waitForURL(/\/(threads|onboarding)/);

  // If onboarding, join the demo company
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: "Join Demo Company" }).click();
    await page.waitForURL("/threads");
  }
}

export async function logIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(TEST_PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("/threads");
}

export async function signOut(page: Page): Promise<void> {
  await page.getByTestId("sign-out-button").click();
  await expect(page).toHaveURL(/\/login/);
}

export { TEST_PASSWORD };
