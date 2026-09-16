import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});

test("login page loads", async ({ page }) => {
  const response = await page.goto("/auth/login");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});

test("register page loads", async ({ page }) => {
  const response = await page.goto("/auth/register");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});
