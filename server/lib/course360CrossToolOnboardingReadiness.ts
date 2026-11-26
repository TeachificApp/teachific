/** Configuration-only gate, not proof of provider delivery. The actual retained
 * SendGrid transport is used after the verified fulfillment transaction commits.
 * No secret values are returned, logged or copied into catalog responses. */
export function isCourse360CrossToolOnboardingConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const sender = env.SENDGRID_FROM_EMAIL ?? "noreply@course360.app";
  return !!env.SENDGRID_API_KEY?.trim() && sender === sender.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender);
}
