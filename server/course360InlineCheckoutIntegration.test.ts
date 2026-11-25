// @vitest-environment jsdom
import React from "react";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ configuration: { data: { ready: true, publishableKey: "pk_live_mock" }, isLoading: false } as any, create: vi.fn(), confirm: vi.fn(), free: vi.fn(), card: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  billing: { getPaymentConfiguration: { useQuery: () => api.configuration } },
  embeddedCheckout: {
    createPaymentIntent: { useMutation: () => ({ mutateAsync: api.create }) },
    confirmPayment: { useMutation: () => ({ mutateAsync: api.confirm }) },
    processFreeOrder: { useMutation: () => ({ mutateAsync: api.free }) },
  },
} }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: api.load }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: any) => React.createElement("div", null, children),
  CardNumberElement: () => React.createElement("div", null, "Mock card number"),
  CardExpiryElement: () => null, CardCvcElement: () => null,
  useStripe: () => ({ confirmCardPayment: api.card }),
  useElements: () => ({ getElement: () => ({ mocked: true }) }),
}));
vi.mock("@/components/PromoCodeInput", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import InlineCheckoutBlock from "../client/src/components/InlineCheckoutBlock";
const data = { products: [{ name: "Saved course", description: "Saved copy", price: 49, type: "course", productId: 21, priceId: 31 }], checkoutBlockId: "saved-block", orgSlug: "school", sourceLandingPageId: 42, sourceType: "landing_page" };
beforeEach(() => {
  vi.clearAllMocks();
  api.configuration = { data: { ready: true, publishableKey: "pk_live_mock" }, isLoading: false };
  api.load.mockResolvedValue(null);
  api.create.mockResolvedValue({ publishableKey: "pk_live_mock", clientSecret: "mock_secret", paymentIntentId: "pi_mock", confirmationToken: "buyer-proof", successUrl: "/school/school/dashboard" });
  api.card.mockResolvedValue({ paymentIntent: { id: "pi_mock", status: "succeeded" } });
  api.confirm.mockResolvedValue({ success: true, status: "completed" });
  api.free.mockResolvedValue({ successUrl: "/school/school/dashboard" });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function pay(props = data) {
  const ui = render(React.createElement(InlineCheckoutBlock, { data: props }));
  fireEvent.change(ui.getByPlaceholderText("Email"), { target: { value: "buyer@example.test" } });
  fireEvent.submit(ui.container.querySelector("form")!);
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  return ui;
}
describe("actual inline checkout integration", () => {
  it("uses only the server key and sends saved selection plus guest buyer proof", async () => {
    const ui = await pay();
    await waitFor(() => expect(ui.getByText("Payment Successful!")).toBeTruthy());
    expect(api.load).toHaveBeenCalledWith("pk_live_mock");
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ checkoutBlockId: "saved-block", orgSlug: "school", sourceLandingPageId: 42, selectedProductIndex: 0, addedBumpIndexes: [], priceId: 31 }));
    expect(api.confirm).toHaveBeenCalledWith({ paymentIntentId: "pi_mock", confirmationToken: "buyer-proof", orgSlug: "school" });
  });
  it("does not confirm or show success for a still-processing payment", async () => {
    api.card.mockResolvedValue({ paymentIntent: { id: "pi_mock", status: "processing" } });
    const ui = await pay();
    await waitFor(() => expect(ui.getByText(/still processing/)).toBeTruthy());
    expect(api.confirm).not.toHaveBeenCalled(); expect(ui.queryByText("Payment Successful!")).toBeNull();
  });
  it("blocks confirmation when intent and Elements keys do not match", async () => {
    api.create.mockResolvedValue({ publishableKey: "pk_test_other", clientSecret: "mock_secret" });
    const ui = await pay();
    await waitFor(() => expect(ui.getByText(/configuration changed/)).toBeTruthy());
    expect(api.card).not.toHaveBeenCalled(); expect(api.confirm).not.toHaveBeenCalled();
  });
  it("requires completed server fulfillment rather than trusting the success redirect", async () => {
    api.confirm.mockResolvedValue({ success: true, status: "pending" });
    const ui = await pay();
    await waitFor(() => expect(ui.getByText(/not been confirmed/)).toBeTruthy());
    expect(ui.queryByText("Payment Successful!")).toBeNull();
  });
  it("renders missing configuration without loading an environment fallback key", () => {
    api.configuration = { data: { ready: false, publishableKey: null }, isLoading: false };
    const ui = render(React.createElement(InlineCheckoutBlock, { data }));
    expect(ui.getByText(/temporarily unavailable/)).toBeTruthy();
    expect(api.load).not.toHaveBeenCalled();
  });
});
