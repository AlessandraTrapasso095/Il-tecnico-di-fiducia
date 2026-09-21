// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchJsonMock = vi.fn();
const navigateAfterLoginMock = vi.fn();

vi.mock("@/lib/api/fetch-json", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

vi.mock("@/lib/auth/post-login-navigation", () => ({
  navigateAfterLogin: (destination: string) =>
    navigateAfterLoginMock(destination),
}));

import LoginClient from "@/app/auth/login/login-client";

describe("LoginClient", () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    navigateAfterLoginMock.mockReset();
  });

  it("effettua una sola richiesta e una sola navigazione con un singolo submit", async () => {
    fetchJsonMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "cliente@example.it",
      },
      profile: {
        id: "user-1",
        role: "customer",
        must_change_password: false,
        is_banned: false,
      },
    });

    const user = userEvent.setup();

    render(
      <LoginClient
        initialRole="customer"
        infoMessage={null}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /indirizzo email/i }),
      "Cliente@Example.it ",
    );

    const password = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement | null;

    expect(password).not.toBeNull();

    await user.type(password!, "Password123!");

    await user.click(
      screen.getByRole("button", { name: /^accedi$/i }),
    );

    await waitFor(() => {
      expect(fetchJsonMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/auth/sign-in",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "cliente@example.it",
          password: "Password123!",
        }),
      }),
    );

    await waitFor(() => {
      expect(navigateAfterLoginMock).toHaveBeenCalledTimes(1);
    });

    expect(navigateAfterLoginMock).toHaveBeenCalledWith("/customer");

    const loadingButton = screen.getByRole("button", {
      name: /accesso in corso/i,
    });

    expect(loadingButton).toBeDisabled();
  });

  it("impedisce un secondo submit mentre il login è ancora in corso", async () => {
    let resolveLogin:
      | ((value: {
          user: { id: string; email: string };
          profile: {
            id: string;
            role: "customer";
            must_change_password: boolean;
            is_banned: boolean;
          };
        }) => void)
      | undefined;

    fetchJsonMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const user = userEvent.setup();

    render(
      <LoginClient
        initialRole="customer"
        infoMessage={null}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /indirizzo email/i }),
      "cliente@example.it",
    );

    const password = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;

    await user.type(password, "Password123!");

    const button = screen.getByRole("button", {
      name: /^accedi$/i,
    });

    await user.click(button);

    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await user.click(button);

    expect(fetchJsonMock).toHaveBeenCalledTimes(1);

    resolveLogin?.({
      user: {
        id: "user-1",
        email: "cliente@example.it",
      },
      profile: {
        id: "user-1",
        role: "customer",
        must_change_password: false,
        is_banned: false,
      },
    });

    await waitFor(() => {
      expect(navigateAfterLoginMock).toHaveBeenCalledTimes(1);
    });
  });

  it("ignora percorsi precedenti e porta sempre alla dashboard del ruolo", async () => {
    fetchJsonMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "cliente@example.it",
      },
      profile: {
        id: "user-1",
        role: "customer",
        must_change_password: false,
        is_banned: false,
      },
    });

    const user = userEvent.setup();

    render(
      <LoginClient
        initialRole="customer"
        infoMessage={null}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /indirizzo email/i }),
      "cliente@example.it",
    );

    const password = document.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;

    await user.type(password, "Password123!");

    await user.click(
      screen.getByRole("button", { name: /^accedi$/i }),
    );

    await waitFor(() => {
      expect(navigateAfterLoginMock).toHaveBeenCalledWith("/customer");
    });
  });
});
