/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
    user: {
      name: "Course360 Admin",
      email: "admin@example.test",
      role: "admin",
      isPremium: true,
      appRoles: ["platform_admin", "instructor", "affiliate", "diy_admin", "accreditation_manager"],
    },
  }),
}));

vi.mock("@/hooks/useSubdomain", () => ({
  isLearnDomain: () => false,
  isMembersDomain: () => false,
  isAccreditationDomain: () => false,
}));

vi.mock("@/hooks/useSiteNavMenu", () => ({
  useSiteNavMenu: () => ({ items: [] }),
}));

vi.mock("@/lib/trpc", () => {
  const useQuery = () => ({ data: null });
  return {
    trpc: {
      caseLibrary: { getPendingCount: { useQuery } },
      platformAdmin: { countPending: { useQuery } },
      menuLinks: { getLearnLinks: { useQuery } },
    },
  };
});

vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/GetAppBanner", () => ({ default: () => null }));
vi.mock("@/components/NameCollectionModal", () => ({ default: () => null }));
vi.mock("@/components/SiteNavLinks", () => ({ SiteNavProfileLinks: () => null }));

import Layout from "@/components/Layout";

describe("Course360 shared Layout navigation", () => {
  it("renders Course360 platform navigation and supported account routes without legacy clinical, accreditation, or educator entries", () => {
    render(createElement(Layout, null, createElement("p", null, "Course360 page content")));

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Courses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quizzes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Products").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Community").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Course360 Admin"));

    expect(screen.getByText("My Subscriptions")).toBeTruthy();
    expect(screen.getByText("My Dashboard")).toBeTruthy();
    expect(screen.getByText("Platform Management")).toBeTruthy();
    expect(screen.getByText("Instructor Portal")).toBeTruthy();
    expect(screen.getByText("Affiliate Dashboard")).toBeTruthy();
    expect(screen.queryByText("Submit Clinical Case")).toBeNull();
    expect(screen.queryByText("Educator Tools")).toBeNull();
    expect(screen.queryByText("Lab Admin Portal")).toBeNull();
    expect(screen.queryByText("Accreditation Manager")).toBeNull();
    expect(screen.queryByText("SonoShop")).toBeNull();
  });
});
