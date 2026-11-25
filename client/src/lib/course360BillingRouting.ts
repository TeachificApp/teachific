export function canChangeCourse360Subscription(
  subscription:
    | {
        stripeSubscriptionId?: string | null;
        status?: string | null;
        canChangeExistingSubscription?: boolean;
      }
    | null
    | undefined
): boolean {
  if (!subscription?.stripeSubscriptionId) return false;
  if (typeof subscription.canChangeExistingSubscription === "boolean")
    return subscription.canChangeExistingSubscription;
  return !["cancelled", "canceled", "incomplete_expired"].includes(
    subscription.status ?? ""
  );
}

export function safeCourse360PostCheckoutPath(
  path: string | null
): string | null {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\\r\n]/.test(path)
  )
    return null;
  try {
    const base = "https://course360.app";
    const url = new URL(path, base);
    return url.origin === base
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}
