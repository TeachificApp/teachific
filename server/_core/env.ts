export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  // Printful integration
  printfulApiKey: process.env.PRINTFUL_API_KEY ?? "",
  printfulDefaultStoreId: process.env.PRINTFUL_DEFAULT_STORE_ID ?? "",
  // Printify integration
  printifyApiToken: process.env.PRINTIFY_API_TOKEN ?? "",
  printifyDefaultShopId: process.env.PRINTIFY_DEFAULT_SHOP_ID ?? "",
  // Bookvault integration
  bookvaultApiKey: process.env.BOOKVAULT_API_KEY ?? "",
  bookvaultDispatchService: process.env.BOOKVAULT_DISPATCH_SERVICE ?? "BookvaultUK",
  bookvaultProductionLevel: process.env.BOOKVAULT_PRODUCTION_LEVEL ?? "Standard",
};
