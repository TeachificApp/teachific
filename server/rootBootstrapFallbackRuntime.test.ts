/** @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountCourse360Bootstrap } from "../client/src/BootstrapShell";

describe("Course360 root bootstrap runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("mounts loading immediately and a retryable fallback when application bootstrap rejects", async () => {
    const root = document.getElementById("root")!;

    act(() => {
      mountCourse360Bootstrap(root, () => Promise.reject(new Error("module unavailable")), 50);
    });
    expect(root.textContent).toContain("Loading Course360");

    await act(async () => {
      await Promise.resolve();
    });
    expect(root.textContent).toContain("We could not load this page.");
    expect(root.textContent).toContain("Retry loading Course360");
  });

  it("mounts the retryable fallback when application bootstrap exceeds its timeout", () => {
    const root = document.getElementById("root")!;

    act(() => {
      mountCourse360Bootstrap(root, () => new Promise(() => undefined), 50);
    });
    expect(root.textContent).toContain("Loading Course360");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(root.textContent).toContain("We could not load this page.");
  });

  it("replaces loading with the resolved Course360 application", async () => {
    const root = document.getElementById("root")!;
    const AppBootstrap = () => React.createElement("div", null, "Course360 application loaded");

    act(() => {
      mountCourse360Bootstrap(root, () => Promise.resolve({ AppBootstrap }), 50);
    });
    expect(root.textContent).toContain("Loading Course360");

    await act(async () => {
      await Promise.resolve();
    });
    expect(root.textContent).toContain("Course360 application loaded");
  });
});
