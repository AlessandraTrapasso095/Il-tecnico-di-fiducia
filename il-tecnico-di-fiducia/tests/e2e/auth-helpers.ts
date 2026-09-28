import { expect, type Page } from "@playwright/test";

export type E2ECredentials = {
  email: string;
  password: string;
};

export function e2eConfig() {
  return {
    customer: {
      email: process.env.E2E_CUSTOMER_EMAIL?.trim() ?? "",
      password: process.env.E2E_CUSTOMER_PASSWORD ?? "",
    },
    professional: {
      email: process.env.E2E_PROFESSIONAL_EMAIL?.trim() ?? "",
      password: process.env.E2E_PROFESSIONAL_PASSWORD ?? "",
    },
    admin: {
      email: process.env.E2E_ADMIN_EMAIL?.trim() ?? "",
      password: process.env.E2E_ADMIN_PASSWORD ?? "",
    },
    professionalId: process.env.E2E_PROFESSIONAL_ID?.trim() ?? "",
  };
}

export function hasAuthenticatedE2EConfig() {
  const config = e2eConfig();

  return Boolean(
    config.customer.email &&
    config.customer.password &&
    config.professional.email &&
    config.professional.password &&
    config.professionalId,
  );
}

export async function login(
  page: Page,
  credentials: E2ECredentials,
  role: "customer" | "professional",
) {
  await page.goto(`/auth/login?role=${role}`);

  await page.getByLabel("Indirizzo Email").fill(credentials.email);
  await page.getByPlaceholder("••••••••").fill(credentials.password);

  await page.getByRole("button", { name: "Accedi" }).click();

  if (role === "customer") {
    await expect(page).toHaveURL(/\/customer(?:[/?#]|$)/, { timeout: 15000 });
  } else {
    await expect(page).toHaveURL(/\/professionista(?:[/?#]|$)/, {
      timeout: 15000,
    });
  }
}

export async function logout(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/sign-out") &&
      response.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Logout" }).first().click();

  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/$/);
}

export async function loginAdmin(page: Page, credentials: E2ECredentials) {
  await page.goto("/admin/login");

  await page.getByLabel("Email admin").fill(credentials.email);
  await page.getByPlaceholder("••••••••").fill(credentials.password);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/auth/sign-in") &&
      response.request().method() === "POST",
  );

  await page
    .getByRole("button", {
      name: "Accedi come admin",
      exact: true,
    })
    .click();

  const response = await responsePromise;

  expect(response.ok()).toBeTruthy();

  await expect(page).toHaveURL(/\/admin(?:[?#].*)?$/, {
    timeout: 15000,
  });
}
