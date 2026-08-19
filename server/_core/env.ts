export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  appUrl: process.env.VITE_APP_URL ?? process.env.APP_URL ?? "https://teachific.app",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openAiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  openAiTtsModel: process.env.OPENAI_TTS_MODEL ?? "tts-1",
  openAiTranscriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
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
