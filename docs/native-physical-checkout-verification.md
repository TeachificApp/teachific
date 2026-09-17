# Native Physical Checkout Verification

**Verification date:** 2026-09-17

The native physical-product checkout now resolves success and cancellation URLs from the product organization through the trusted `getOrgBaseUrl` helper. It validates any supplied discount code against that organization and the selected physical-product target before Stripe coupon creation. A valid 100% organization coupon remains in Stripe Checkout with shipping-address collection enabled; it does not take a free-product shortcut.

On `checkout.session.completed`, the Stripe webhook now records an idempotent physical-product order from Stripe-confirmed buyer and shipping details, resolves an anonymous buyer to a Course360 account only after successful checkout, and hands the order to the single configured Bookvault, Printful, or Printify integration. The existing organization-admin fulfillment controls remain available for retryable provider work.

Focused regression coverage passed: 12 tests across `nativePhysicalCheckoutScope.test.ts`, `nativePhysicalCheckoutFulfillment.test.ts`, `physicalCheckoutOrgUrl.test.ts`, and `lmsCheckoutCouponScope.test.ts`. Targeted products-router and Stripe-webhook bundles passed. After restart, local and public preview roots both returned HTTP 200 with the Vite document. A prior browser-gateway unavailable screen was transient; it was superseded by the successful public HTTP verification. Dev-server logs show the restarted service listening on `0.0.0.0:3000` with no new application exceptions.

Repository-wide TypeScript diagnostics remain known pre-existing drift and were not used as a release gate for this focused correction.
