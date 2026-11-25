// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
vi.mock("../client/src/components/creator/CreatorMediaPicker", () => ({ CreatorMediaPicker: () => null }));
import { CreatorProjectSettings } from "../client/src/components/creator/CreatorProjectSettings";
afterEach(cleanup);
describe("Creator settings acknowledged-draft preservation", () => {
  it("retains acknowledged values while the server query is stale, then accepts genuinely refreshed values", async () => {
    const raw = JSON.stringify({ passingScore: 80, original: { keep: true } });
    const save = vi.fn(async (_raw: string) => ({ success: true }));
    const view = render(<CreatorProjectSettings raw={raw} save={save} />);
    fireEvent.change(view.getByLabelText("Project passing score"), { target: { value: "70" } });
    fireEvent.click(view.getByRole("button", { name: "Save project settings" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Save project settings" }).hasAttribute("disabled")).toBe(true));
    expect((view.getByLabelText("Project passing score") as HTMLInputElement).value).toBe("70");
    expect(JSON.parse(save.mock.calls[0][0])).toMatchObject({ passingScore: 70, original: { keep: true } });
    view.rerender(<CreatorProjectSettings raw={raw} save={save} />);
    expect((view.getByLabelText("Project passing score") as HTMLInputElement).value).toBe("70");
    view.rerender(<CreatorProjectSettings raw={JSON.stringify({ passingScore: 75, original: { keep: true } })} save={save} />);
    await waitFor(() => expect((view.getByLabelText("Project passing score") as HTMLInputElement).value).toBe("75"));
  });
  it("does not overwrite unsaved settings on an external refresh or failed save", async () => {
    const save = vi.fn(async (_raw: string) => { throw new Error("Save conflict; draft retained"); });
    const view = render(<CreatorProjectSettings raw='{"passingScore":80,"original":"kept"}' save={save} />);
    fireEvent.change(view.getByLabelText("Project passing score"), { target: { value: "86" } });
    view.rerender(<CreatorProjectSettings raw='{"passingScore":90,"original":"external"}' save={save} />);
    expect((view.getByLabelText("Project passing score") as HTMLInputElement).value).toBe("86");
    fireEvent.click(view.getByRole("button", { name: "Save project settings" }));
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("draft retained"));
    expect((view.getByLabelText("Project passing score") as HTMLInputElement).value).toBe("86");
    expect(JSON.parse(save.mock.calls[0][0])).toMatchObject({ passingScore: 86, original: "kept" });
  });
});
