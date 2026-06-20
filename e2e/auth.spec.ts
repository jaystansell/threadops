import { test, expect } from "@playwright/test";
import { signUp, logIn, signOut, uniqueEmail, TEST_PASSWORD } from "./helpers/auth";

test.describe("Auth flows", () => {
  let testEmail: string;

  test.beforeAll(() => {
    testEmail = uniqueEmail();
  });

  test("signup creates account and redirects to threads", async ({ page }) => {
    await signUp(page, testEmail);
    await expect(page).toHaveURL("/threads");
    await expect(page.locator("h2")).toContainText("Threads");
  });

  test("sign out redirects to login", async ({ page }) => {
    await logIn(page, testEmail);
    await signOut(page);
    await expect(page.getByTestId("login-form")).toBeVisible();
  });

  test("login with existing credentials redirects to threads", async ({ page }) => {
    await logIn(page, testEmail);
    await expect(page).toHaveURL("/threads");
    await expect(page.locator("h2")).toContainText("Threads");
  });

  test("protected route redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/threads");
    await expect(page).toHaveURL(/\/login/);
  });
});
