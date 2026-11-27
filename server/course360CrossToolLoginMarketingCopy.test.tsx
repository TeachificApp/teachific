// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { UseOrgAuthBrandingResult } from "../client/src/hooks/useOrgAuthBranding";
import { CACHE_KEY } from "../client/src/lib/authCache";

const boundary = vi.hoisted(() => ({
  branding: null as UseOrgAuthBrandingResult | null,
  loginOptions: null as any,
  magicOptions: null as any,
  loginPending: false,
  magicPending: false,
  login: vi.fn(),
  magic: vi.fn(),
  setAuth: vi.fn(),
}));

// These are the only module mocks: the school branding hook and remote request
// hooks. LoginPage, its handlers, UI controls, React and wouter remain real.
vi.mock("@/hooks/useOrgAuthBranding", () => ({
  useOrgAuthBranding: () => boundary.branding ?? {
    branding: null, isLoading: false, primary: "#24abbc",
    buttonText: "#ffffff", pageBg: "#ffffff", displayName: "Course360",
  },
}));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ auth: { me: { setData: boundary.setAuth } } }),
  customAuth: {
    login: { useMutation: (options: unknown) => {
      boundary.loginOptions = options;
      return { mutate: boundary.login, isPending: boundary.loginPending };
    } },
    requestMagicLink: { useMutation: (options: unknown) => {
      boundary.magicOptions = options;
      return { mutate: boundary.magic, isPending: boundary.magicPending };
    } },
  },
} }));
import LoginPage from "../client/src/pages/auth/LoginPage";

const paragraph = "Turn your knowledge into courses, connect with your learners, and grow your school with Course360™.";
const featureLabels = [
  "Build & sell courses in minutes",
  "Manage students as your school grows",
  "Built-in analytics & revenue tracking",
  "Automated certificates & completions",
];
const originalUrl = window.location.href;
const setUrl = (url: string) => (globalThis as any).jsdom.reconfigure({ url });
const loginUrl = (returnTo: string, key = "returnTo") =>
  `https://course360.app/login?${key}=${encodeURIComponent(returnTo)}`;
const schoolBranding = (logoUrl: string | null): UseOrgAuthBrandingResult => ({
  branding: {
    orgId: 41, orgName: "Example Academy", orgSlug: "academy", logoUrl,
    primaryColor: "#185a69", accentColor: "#4ad9e0", buttonColor: null,
    buttonTextColor: "#f1f5f9", pageBgColor: "#ffffff", headingFont: null, bodyFont: null,
  },
  isLoading: false, primary: "#185a69", buttonText: "#f1f5f9",
  pageBg: "#ffffff", displayName: "Example Academy",
});

function expectApprovedPlatformCopy(container: HTMLElement) {
  // Logo lettering and its superscript are separate real DOM spans. Collapse
  // only that typographic whitespace, not source or route identifiers.
  const text = (container.textContent ?? "").replace(/Course360\s*™/g, "Course360™");
  expect(text).toContain("Course360™");
  expect(text).not.toMatch(/Course360(?!™)/);
  expect(text).not.toMatch(/™\s*™/);
  expect(text).not.toMatch(/unlimited students|organization-specific branding/i);
  expect(text).not.toMatch(/teachific|teach\s*ific/i);
}
function expectStandardRoutes(registrationLabel = "Start 14-day trial") {
  for (const [name, href] of [
    ["Forgot password?", "/forgot-password"],
    [registrationLabel, "/register"],
    ["Terms of Service", "/policies/teachific"],
    ["Privacy Policy", "/policies/teachific"],
  ]) {
    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
  }
}
function fillPassword(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.branding = null;
  boundary.loginOptions = null;
  boundary.magicOptions = null;
  boundary.loginPending = false;
  boundary.magicPending = false;
  // Synthetic example.test values never authenticate or send email: mutate is
  // an in-memory spy and does not invoke login success or browser navigation.
  boundary.login.mockReset();
  boundary.magic.mockReset();
  setUrl("https://course360.app/login");
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(CACHE_KEY, "unchanged-auth-marker");
  localStorage.setItem("activeOrgId", "23");
  sessionStorage.setItem("unchanged-session", "fixture");
  const deny = vi.fn(() => { throw new Error("Network forbidden in login marketing copy tests"); });
  vi.stubGlobal("fetch", deny);
  vi.stubGlobal("XMLHttpRequest", deny);
  vi.stubGlobal("WebSocket", deny);
});
afterEach(() => {
  cleanup();
  for (const network of [fetch, XMLHttpRequest, WebSocket]) expect(network).not.toHaveBeenCalled();
  expect(boundary.setAuth).not.toHaveBeenCalled();
  expect(localStorage.getItem(CACHE_KEY)).toBe("unchanged-auth-marker");
  expect(localStorage.getItem("activeOrgId")).toBe("23");
  expect(sessionStorage.getItem("unchanged-session")).toBe("fixture");
  vi.unstubAllGlobals();
  setUrl(originalUrl);
});

describe("actual root LoginPage marketing copy", () => {
  it("uses the requested plain-language paragraph and exactly four preserved features", () => {
    const { container } = render(<LoginPage />);
    expect(screen.getByText(paragraph).tagName).toBe("P");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your knowledge.Your school.Your revenue.");
    const list = screen.getByText(featureLabels[0]).parentElement!.parentElement!;
    expect(Array.from(list.children).map(item => item.textContent)).toEqual(featureLabels);
    expect(list.querySelectorAll("svg")).toHaveLength(4);
    expect(screen.getByText("Sign in to your Course360™ account")).toBeTruthy();
    expectApprovedPlatformCopy(container);
    expectStandardRoutes();
    expect(screen.getByRole("link", { name: "a SoundMedia, Inc. brand" }).getAttribute("href")).toBe("https://soundmedianow.com/");
    expect(boundary.login).not.toHaveBeenCalled();
    expect(boundary.magic).not.toHaveBeenCalled();
  });

  it("keeps responsive logo layout with navy Course360 lettering and exactly one trademark per logo", () => {
    const { container } = render(<LoginPage />);
    const mobileLogo = Array.from(container.querySelectorAll("div")).find(element =>
      element.classList.contains("lg:hidden") && element.classList.contains("items-baseline"));
    expect(mobileLogo).toBeDefined();
    const spans = mobileLogo!.querySelectorAll("span");
    expect(spans).toHaveLength(3);
    expect(spans[0].textContent).toMatch(/^Course360™?$/);
    expect(spans[0].style.color).toBe("rgb(11, 29, 53)");
    expect(spans[1].textContent).toBe("");
    expect(mobileLogo!.textContent?.replace(/\s/g, "")).toBe("Course360™");
    for (const logo of container.querySelectorAll("div.flex.items-baseline")) {
      expect(logo.textContent?.replace(/\s/g, "")).toBe("Course360™");
    }
    expectApprovedPlatformCopy(container);
  });

  it("preserves password controls and the exact in-memory login request without marketing fields", () => {
    render(<LoginPage />);
    const email = screen.getByLabelText("Email address") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect([email.type, email.required, email.autocomplete]).toEqual(["email", true, "email"]);
    expect([password.type, password.required, password.autocomplete]).toEqual(["password", true, "current-password"]);
    fillPassword("learner@example.test", "synthetic-test-password");
    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(password.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(password.type).toBe("password");
    const urlBefore = window.location.href;
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(boundary.login.mock.calls).toEqual([[{ email: "learner@example.test", password: "synthetic-test-password" }]]);
    expect(boundary.magic).not.toHaveBeenCalled();
    expect(window.location.href).toBe(urlBefore);
    act(() => boundary.loginOptions.onError({ message: "Isolated sign-in unavailable" }));
    expect(screen.getByRole("alert").textContent).toBe("Isolated sign-in unavailable");
  });

  it.each([
    ["", undefined],
    ["?returnTo=%2Flms%2Fcourses%3Fview%3Dmine", "/lms/courses?view=mine"],
    ["?returnPath=%2Flms%2Fcertificates", "/lms/certificates"],
    ["?returnTo=%2Flms%2Fpreferred&returnPath=%2Flms%2Fold", "/lms/preferred"],
  ])("retains magic-link exact payload and return intent for %s", (query, redirectTo) => {
    setUrl(`https://course360.app/login${query}`);
    const { container } = render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByText("We'll email you a one-click sign-in link — no password needed.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "magic-learner@example.test" } });
    const urlBefore = window.location.href;
    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
    expect(boundary.magic.mock.calls).toEqual([[{
      email: "magic-learner@example.test", redirectTo, origin: "https://course360.app",
    }]]);
    expect(boundary.login).not.toHaveBeenCalled();
    expect(window.location.href).toBe(urlBefore);
    // Exercise the real success state using only the captured local callback.
    act(() => boundary.magicOptions.onSuccess());
    expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeTruthy();
    expect(screen.getByText("magic-learner@example.test")).toBeTruthy();
    expect(container.textContent).toContain("It expires in 15 minutes.");
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    expect(screen.getByRole("button", { name: "Send magic link" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Password" }));
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expectStandardRoutes();
    expectApprovedPlatformCopy(container);
  });

  it("retains the password and magic-link pending guards", () => {
    boundary.loginPending = true;
    boundary.magicPending = true;
    render(<LoginPage />);
    const loginButton = screen.getByRole("button", { name: "Signing in..." }) as HTMLButtonElement;
    expect(loginButton.disabled).toBe(true);
    fireEvent.click(loginButton);
    expect(boundary.login).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
    const magicButton = screen.getByRole("button", { name: "Sending link..." }) as HTMLButtonElement;
    expect(magicButton.disabled).toBe(true);
    fireEvent.click(magicButton);
    expect(boundary.magic).not.toHaveBeenCalled();
  });
});

describe("actual desktop LoginPage Course360 trademarks and request preservation", () => {
  it.each([
    ["/studio", "returnTo", "Course360™ Studio™"],
    ["/studio-pro?purchaseApp=studio&accessTier=web&interval=annual", "returnTo", "Course360™ Studio™"],
    ["/creator", "returnTo", "Course360™ Creator™"],
    ["/creator-pro?purchaseApp=creator&accessTier=web&interval=annual", "returnPath", "Course360™ Creator™"],
    ["/quiz-creator", "returnTo", "Course360™ Quiz Creator™"],
    ["/quiz-creator-app/billing?selected=expired", "returnPath", "Course360™ Quiz Creator™"],
  ])("keeps the %s desktop route with marked visible app and account copy", (returnTo, key, appName) => {
    const url = loginUrl(returnTo, key);
    setUrl(url);
    const { container } = render(<LoginPage />);
    expect(screen.getByText(appName).tagName).toBe("P");
    expect(screen.getByText("Use your Course360™ account credentials")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.queryByRole("button", { name: "Magic Link" })).toBeNull();
    expect(screen.queryByText(paragraph)).toBeNull();
    expectApprovedPlatformCopy(container);
    fillPassword("desktop-learner@example.test", "synthetic-desktop-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(boundary.login.mock.calls).toEqual([[{ email: "desktop-learner@example.test", password: "synthetic-desktop-password" }]]);
    expect(boundary.magic).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
  });

  it("retains context=desktop without returnTo and avoids duplicated generic app trademarks", () => {
    setUrl("https://course360.app/login?context=desktop");
    const { container } = render(<LoginPage />);
    expect(screen.getByText("Course360™", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Use your Course360™ account credentials")).toBeTruthy();
    expect(screen.queryByText(paragraph)).toBeNull();
    expectApprovedPlatformCopy(container);
    expect(boundary.login).not.toHaveBeenCalled();
    expect(boundary.magic).not.toHaveBeenCalled();
  });
});

describe("actual school-domain LoginPage branch preservation", () => {
  it.each([null, "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"])(
    "retains school name/logo/theme and omits the platform panel (logo=%s)", logoUrl => {
      setUrl("https://academy.course360.app/login?returnTo=%2Flms%2Fcourses");
      boundary.branding = schoolBranding(logoUrl);
      const { container } = render(<LoginPage />);
      expect(screen.getByText("Sign in to Example Academy")).toBeTruthy();
      if (logoUrl) {
        expect(screen.getByRole("img", { name: "Example Academy" }).getAttribute("src")).toBe(logoUrl);
        expect(screen.queryByRole("heading", { name: "Example Academy" })).toBeNull();
      } else {
        const heading = screen.getByRole("heading", { name: "Example Academy" });
        expect(heading.style.color).toBe("rgb(24, 90, 105)");
        expect(screen.queryByRole("img")).toBeNull();
      }
      expect(screen.queryByText(paragraph)).toBeNull();
      for (const feature of featureLabels) expect(screen.queryByText(feature)).toBeNull();
      expect(container.textContent).not.toMatch(/Course360|Your knowledge\.|Learning Management Platform|unlimited students|organization-specific branding/i);
      expect(container.querySelector("div.lg\\:hidden")).toBeNull();
      expect(screen.queryByRole("link", { name: "a SoundMedia, Inc. brand" })).toBeNull();
      expectStandardRoutes("Create account");
      const registration = screen.getByRole("link", { name: "Create account" });
      expect(registration.style.color).toBe("rgb(24, 90, 105)");
      const passwordButton = screen.getByRole("button", { name: "Sign in" });
      expect(passwordButton.style.background).toBe("rgb(24, 90, 105)");
      expect(passwordButton.style.color).toBe("rgb(241, 245, 249)");
      fillPassword("school-learner@example.test", "synthetic-school-password");
      fireEvent.click(passwordButton);
      expect(boundary.login.mock.calls).toEqual([[{ email: "school-learner@example.test", password: "synthetic-school-password" }]]);
      fireEvent.click(screen.getByRole("button", { name: "Magic Link" }));
      const magicButton = screen.getByRole("button", { name: "Send magic link" });
      expect(magicButton.style.background).toBe("rgb(24, 90, 105)");
      expect(magicButton.style.color).toBe("rgb(241, 245, 249)");
      fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "school-magic@example.test" } });
      fireEvent.click(magicButton);
      expect(boundary.magic.mock.calls).toEqual([[{
        email: "school-magic@example.test", redirectTo: "/lms/courses", origin: "https://academy.course360.app",
      }]]);
      expect(within(container).queryByText(paragraph)).toBeNull();
      expect(window.location.href).toBe("https://academy.course360.app/login?returnTo=%2Flms%2Fcourses");
    },
  );
});
