# Starter Trial Eligibility Migration

The `org_subscriptions.starterTrialClaimed` field was added on **2026-09-24** to make Course360's 14-day Starter trial a one-time offer per organization. The application marks the field only after Stripe confirms the Starter Checkout session has completed and a subscription exists. An abandoned Checkout session does not consume the offer; a later subscription cancellation does not restore it.

The migration is recorded in `drizzle/0005_chemical_shape.sql` and was applied to the active Course360 database. Existing organizations retain `false` as the safe default; organizations with an existing Stripe subscription remain ineligible because checkout also requires the absence of a Stripe subscription ID.

This field is an eligibility marker only. The legacy `free` plan remains in the schema and limits table solely for already-entitled organizations and future product decisions; it is not offered in the public pricing, registration, login, or selectable billing interfaces.
