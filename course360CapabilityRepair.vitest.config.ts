import { defineConfig } from "vitest/config";
import path from "node:path";
const root = import.meta.dirname;
/** Focused capability repair coverage. Existing vitest.config.ts remains unchanged. */
export default defineConfig({
  root,
  envFile: false,
  cacheDir: path.join(root, "node_modules/.cache/course360-capability-repair"),
  resolve: { alias: {
    "@": path.join(root, "client/src"),
    "@shared": path.join(root, "shared"),
    "@assets": path.join(root, "attached_assets"),
  } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node", minWorkers: 1, maxWorkers: 1, fileParallelism: false,
    include: [
      "server/lib/course360Studio*.test.ts", "server/lib/course360AppCapabilities.test.ts",
      "server/lib/course360PaymentBootstrap.test.ts", "server/course360AppRouteMount.test.ts",
      "server/course360AppAccessUi.test.tsx", "server/course360AppBillingRoutes.test.ts", "server/course360AppRootAuthorization.test.ts",
      "server/course360CreatorRuntime.test.ts", "server/course360CreatorRouter.test.ts", "server/course360CreatorEditor.test.tsx",
      "server/quizNativeRuntimeRepair.test.ts", "server/quizNativeUiRepair.test.tsx",
      "server/quizScoring.test.ts", "server/quizMakerServerScoring.test.ts", "server/publicQuizPlayerMockExam.test.ts", "server/quizFileQuestionBankImport.test.ts",
      "server/course360MainAccountMediaServer.test.ts", "server/legacyMediaLibraryScope.test.ts",
      "server/course360ApprovedPricing.test.ts", "server/course360ApprovedPriceUiRepair.test.ts", "server/course360MediaLibraryPickerCompatibility.test.ts",
      "server/course360StudioCaptureContracts.test.ts", "server/course360StudioCaptureUi.test.tsx",
      "server/course360CreatorSettingsSave.test.tsx", "server/course360AppLoginReturn.test.ts",
      "server/course360MainAccountMediaToolExports.test.ts", "server/course360MainAccountMediaUi.test.ts",
      "server/course360NativeCourseQuiz*.test.ts", "server/course360NativeCourseQuiz*.test.tsx",
      "server/course360NativeCompletionGate.test.ts", "server/course360NativePlayerPreview.test.tsx",
      "server/course360CreatorAiPptx*.test.ts", "server/course360CreatorAiPptx*.test.tsx", "server/course360CreatorAiProviderBounded.test.ts",
      "server/lmsInlineCmeSurveyRouter.test.ts", "server/courseBoundQuizResults.test.ts",
      "server/inlineLessonRequiredQuizCompletion.test.ts", "server/lessonProgressConcurrency.test.ts",
    ],
  },
});
