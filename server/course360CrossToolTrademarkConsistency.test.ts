import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { formatCourse360BrandName } from "../shared/course360DisplayBrand";
import { COURSE360_PRICES } from "../shared/course360Pricing";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";

// Fixed expectations from git show ea3c7f10917444a27b2b7b129a57b8a89d0766fb:<path>.
// The suite has no git, provider, database, environment-file, or network dependency.
// Normalize this exact display token only, in BOTH baseline and working source.
const normalizeTrademark = (value: string): string => value.replaceAll("Course360™", "Course360");
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const source = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

const NORMALIZED_TRADEMARK_SOURCE_HASHES: Readonly<Record<string, string>> = {
  "client/src/App.tsx": "0e97ba9df72015f8084f006c419b5baf17ee2d0741ad24d1ef0803df834c6141",
  "client/src/AppBootstrap.tsx": "6f5d729ea11a7109f779305b33c879fe5258ef77086654fbf9743b8fd4173de9",
  "client/src/BootstrapShell.tsx": "376418eb4515ec75a36cc3666107f52d4631e8ee8530a42b945c47c892dca550",
  "client/src/components/Course360AppAccessNotice.tsx": "7021606ae1896c5eaa6def9a83f29e7c543862f2d6e1d39773bdecdd899fb0ed",
  "client/src/components/Course360MarketingTracks.tsx": "3ef32bbf42fdbe64df8dc46b09ffb623a1a59f499bcc5f86aacf543a3c804b15",
  "client/src/components/DashboardLayout.tsx": "f83ff821ef0682b59889b9e7882600da543bbe216919991d17a43a31a181a15f",
  "client/src/components/DownloadPage.tsx": "8e71ed094e8ca09e6bc16af2520bc37675c5760e23c06c41f7189ba200607e4a",
  "client/src/components/FunnelAiCreateDialog.tsx": "291d30389352868b5b0c849db9e7144282ea04da8731f2225dd8c24b47c3520c",
  "client/src/components/ProductSwitcher.tsx": "f1e2e6df5fc4223eec1a31e09a572f280be38e3f1f09228554e226ec664c2863",
  "client/src/components/creator/CreatorMediaPicker.tsx": "b08f9f247ca611ce40e8d96844b33ef66cc070b7396121d8a57ba15e5984fa08",
  "client/src/hooks/useBrand.ts": "15b76c54e8fd5eb0e91f6b3b5e47348404af63cb6e55f618958b326aab904d81",
  "client/src/main.tsx": "ff5140d6f5cd17b3c355cc933e12bbb4cf9e03449bef6d7f27fe72525f905310",
  "client/src/pages/Course360AppBillingPage.tsx": "d975ea625f20809018be658acf5eeec15ac25df227e603fbf8415a02f35c879e",
  "client/src/pages/CreatorDashboardPage.tsx": "9671196807867e226811a4e830074507fec2d0e08998e0058411b3b0f70f7c78",
  "client/src/pages/CreatorEditorPage.tsx": "7bacaf7b12f7a6c132dfbb2cda79561cd3564e7e347abe7b96fe961af9fdbae8",
  "client/src/pages/CreatorLandingPage.tsx": "a15ecca15bf7b393c3ea29adf79431cc581f6cc9694669565bf4941318e1f260",
  "client/src/pages/DesktopDownloadPage.tsx": "57faac2066fd9a3618c76305f2ce1d83bd256f31326b6154fdc44e7198de732c",
  "client/src/pages/FileDetailPage.tsx": "cddda1dd892784ad00f26c3f78067314ff53978074d0b30633a8f9559860c268",
  "client/src/pages/HelpPage.tsx": "1cb589b966ae25311dfc75961e61df5b29513c4e9141cba709fea93360ef8f50",
  "client/src/pages/LandingPage.tsx": "3de860dd52b7a3028a1a6d00854b13a179e978b003142afb6345b77b32d22f5f",
  "client/src/pages/MediaLibraryPage.tsx": "461bf4685666197abbd20b06581a8549e47af262044e50c9a7c13d1de01cb7f2",
  "client/src/pages/OrgSettingsPage.tsx": "3a75c68ad7846bd1740c522de9d3e67d87395c9ca2efcb2d2cfded83217cc361",
  "client/src/pages/PlatformPoliciesPage.tsx": "75bef5c831ec3cdad1504099108a15e9153377b46a24a1fee84fba6638deea49",
  "client/src/pages/PublicQuizPlayerPage.tsx": "22e6fd3e27f2f3e0d22f36c093f850c560f4b1283d56a73225c30f982dfa6863",
  "client/src/pages/QuestionBankImportPage.tsx": "7618edb3d3af589b60b1d114220a8b4e73a0ca88d8bf544adac6ca03c2671fd4",
  "client/src/pages/QuizBuilderPage.tsx": "ec04a5ec1b868705a9d43dd0f93cc60d5e08063933cfc1353fc86e1edbf5032b",
  "client/src/pages/QuizCreatorGate.tsx": "fedeff7190cedbc4acc5f1913bfc15df180091919e5456cead0cfa997290237d",
  "client/src/pages/QuizCreatorLandingPage.tsx": "edfc1b4b42a1d3cfae7012b086f54addc60416eee3b94e6b78dd1a369443e9a4",
  "client/src/pages/QuizCreatorPage.tsx": "0a60c76e3ce594ab986a340873599b9a9472da47837dce70793dd538a38bb318",
  "client/src/pages/QuizVisualBuilderPage.tsx": "4af45e22a73275d4e8770a4aa27a0af1a3dbdc8a6473bf17e8f1f58abec64962",
  "client/src/pages/RecordEditPage.tsx": "7346088f40bcfdf7dcaed173505addc541c3a733c55be17a61a39497e2e7373c",
  "client/src/pages/StudioDashboard.tsx": "0d655fe2e733e2f9c08688cba28ea4c0856b92d4c5881d56ec236126b648b94a",
  "client/src/pages/StudioLandingPage.tsx": "0e70eaa3498f94a62647dda019d26d40c2051dc62b18a1d6759124e3d26b851c",
  "client/src/pages/SupportPage.tsx": "b4bfbf454366a91ebbff47cc2190e78fdc440ac2108ab0379249c7f0ec75afbb",
  "client/src/pages/admin/CertificateTemplatesAdmin.tsx": "88c5d21a7616f8774ca0b9097c8956bd9e205caf2d1857ce13bfc4535ea5a73c",
  "client/src/pages/admin/LMSAdmin.tsx": "71145b0957ff3c4d22d215be9940ee3bde24502eaa4dfad2aad28b7f3ecc728f",
  "client/src/pages/admin/LandingPageBuilder.tsx": "4039dde0647e21e81454a7a2af9fd6cc2d571968351f2d220e324dd28e86c793",
  "client/src/pages/admin/PlatformAdminPage.tsx": "33f6f7083c42112b9dc52a4760644a01f704cb106f09f432075dd14fdc368d38",
  "client/src/pages/admin/SitePagesAdmin.tsx": "c3e4f7c776c512e7e0f71b6c9660b106301b5e13cc503c4f0213984632ba70e8",
  "client/src/pages/blueprints/BlueprintLandingPage.tsx": "9babccbebbc14a128a227a41724581e9011322a0c0c0440bfdb949078f0a139a",
  "client/src/pages/integrations/KajabiImportPage.tsx": "a62ddadc4672532624a0acdfc30e9a0bf66a752dffae365e7676781bc99264c0",
  "client/src/pages/integrations/TeachableImportPage.tsx": "78051317216a00eb65e59e5551096fa892a770c4bcfff30cc98d2fe834c433ac",
  "client/src/pages/integrations/ThinkificImportPage.tsx": "edde948b661d651811a57f3c236cab74f28150f8619afa0d7583ca9cddee4323",
  "client/src/pages/lms/CertificateSettingsTab.tsx": "fb0a110518a53bf0fd17c70174452bbc49caeef370dec08bff042247d08ea237",
  "client/src/pages/lms/MembersPage.tsx": "8590cb6df41f2332e7c6a0ec4fd40f967a8bbceba97f6d0c8d8dd4f6b752c85d",
  "client/src/pages/lms/PublicPhysicalProductSalesPage.tsx": "54c95742e00399fd93735ecc46f1f018757dd809e7138eb2f922908dfaa3aa2e",
  "client/src/pages/lms/SchoolProfilePage.tsx": "1d84ad8099bf3f9cf45b17192fff40b7dde0134c3ffbf8d5971d477b338530fd",
  "client/src/pages/marketing/EmailWorkflowPage.tsx": "01315e87f295757d9bc6a018ba3c8c3f8d47e91edefbded7bd6d3d49ce23f01a",
  "client/src/pages/marketing/SocialContentGeneratorPage.tsx": "28c9ddc63ec1dfc597463852e9371a1eb2e3e8ac2b531caea672572fd93fd040",
  "client/src/pages/members/OrganizationAccountsPage.tsx": "0105f9d516c02295a573ab33701a6b72e5aa121a068c19214760b3e411c0289a",
  "client/src/pages/profile/BillingPage.tsx": "6176467dbe7b9a9dd103a1890a9210e68fc567d98d2f77727db80da185840c26",
  "client/src/quiz-creator/components/LicenseManager.tsx": "e34a5dad85559168bf0c52dede0417d99e70fd954b25be65651f31bfcc657156",
  "client/src/quiz-creator/components/QuestionList.tsx": "946c5eef2723770d211561b9fad0bb7bf349645404728d7663f4ed6e4fcbf0c8",
  "client/src/quiz-creator/components/ShareDialog.tsx": "3148cb2a2fe7641a98af9320f515ea0890946543e83b3fe1f3b66883228409e4",
  "server/_core/email.ts": "4f6cc6431aefa00b8d76b886125073702d6e33a4e9fbde6818d0259e58298961",
  "server/course360CreatorMedia.ts": "de7e10afc76f81a216449e5029050a874412566d66ba41d04993e86aa0300df8",
  "server/customAuthRouter.ts": "a68e2696819046db4fddd1313d047cd14f8e9093d8702e991d0c78b2434c844f",
  "server/emailTemplates.ts": "98b5c6e97420df3353d3f94d262330fafda9c59b856b20ce3f0a31903ae25320",
  "server/lib/certificateGenerator.ts": "f2c904aa9f4d8996c9cc20db7c2bf73954ab9751979d6fe1d2f57cef7ce97e7b",
  "server/lib/course360CrossToolFulfillment.ts": "d46036eeb0485388badba16dd794d4d4c124f8c0606da65ac87276e031dfc819",
  "server/lib/scormHealthAlerts.ts": "994a04d9826ba6b97fa74c50f36650e1f4f045fe53a20a0b908076dd48b29d2c",
  "server/lmsRouter.ts": "d73d2bf39c7fdf4578cf78fc9f0d86cd068a652f570b6ac7a5f867341c652b75",
  "server/routers.ts": "a263f19f7b93721592bf6476c1ad564dba0c1477be4389586fe9988dbdfab3af",
  "server/routers/embeddedCheckoutRouter.ts": "a23ed0faa004b0be6c57082f522aa3652a06e9ccacfe7f1f93e7df96710450c1",
  "server/routers/lmsAdminRouter.ts": "9ec26a8a7627366d00c9d466d1fa9b0648f07489598a39b552055c0c0cbe404d",
  "server/routers/lmsCheckoutRouter.ts": "cef8011cd607e4b8afdcacfeb0ec85456c66442b369a816e478f2dd019ab9f15",
  "server/stripeRouter.ts": "343bb02ecfaeb60a7db55cf74dd166b4ae95939504a9854245452e9f227504f4",
  "server/stripeWebhookRoutes.ts": "965a901d9d6436982acee07b3afa6e117803e086b3e26727901d54f52e788e96",
  "shared/brands.ts": "6888b67b1ece2fe48778f264166d6f61bd5f4909b174171da2374fc8e322ffc7",
  "shared/sitePagesConstants.ts": "ec6888807400fcf3fb73689d14a13c52dc24666f073d1a333f568968b9f0a8bb",
};

const ADDITIONAL_SERVER_DISPLAY_HASHES: Readonly<Record<string, string>> = {
  "server/course360CreatorPptxExchange.ts": "f85eee7b4c744006f6d521ee83ec838b0b5f2eec4731bc8e2e1dc0168367acd0",
  "server/lib/course360StudioRender.ts": "c62b077e43f5ceb4cdd78b74dec5730ee3f092d0221d9328f92e10b08b3e44e0",
  "server/quizMakerRouter.ts": "1fa4f281cf3c6bb40a8dfc638621023cbaad512837c6dcb7331855d30bc610ff",
  "server/lib/quizWidgetLaunch.ts": "46b231371bf8aa6adf98d598873d75f5bc2537b434ae991b8950c13518e0aff7",
  "server/formsRouter.ts": "2860d46494b500719951d734b33dfaf259349795bed8e005d0b0e3df4e71679a",
  "server/jobs/sharingMonitor.ts": "25a25eedb0394dfbbb5ba50247eee930dbfbac72cc11b9d6f8d49ec60686e0d7",
  "server/quizImportRoutes.ts": "4eed693848bbca74982d9ec1752321a446e87d96ce72b6a28daee095dc3b6991",
};

const PROTECTED_BYTE_HASHES: Readonly<Record<string, string>> = {
  "shared/course360Pricing.ts": "102f39c2995ee5bd5af45366e725e3df418fb8002d647809b62ed102202201dd",
  "shared/course360CrossToolOffers.ts": "94c18185810e4dac8185f8376a1af846558ead0ba8532363f00fc3b62cb3ff18",
  "server/stripePlans.ts": "2a362ad0a23feff4de1e8473134c4890b13d67d8db30f2fb2d54700ffd871834",
  "client/src/config/platformBrand.ts": "521a40a69f6b278ae7f18f91ddea89037704ee1312987db68bf22686383f1eda",
  "client/src/config/brandNav.ts": "5cc40c576824c093394e55cceae85b851646745abb405ee1e559e456de0cb291",
  "drizzle/schema.ts": "cffbd5f604fd5c3c469c9fd94fed118540feb731c978e3b5c70c92f5589de56f",
  "drizzle/lms-schema-adapted.ts": "b2819e2df46ad79a8e3edd8cf49291006d8421eb5712e8135a209a5296e88549",
  "drizzle/lms-schema-raw.ts": "a03929dde70d1071c2df996f518d89b743adf0471837eec321c010710073c32e",
  "package.json": "4cdf0ebc45da30351f45ef2d2217f9b718876d0aa1c9097384d65d5700760c95",
  "pnpm-lock.yaml": "7146bad0c07e71edc18a792441c41a907b128b03d92c342426bb0edd5c10e100",
  "tsconfig.json": "8d9aeff734342b46e4300b58ced6cd435d9a538a7fabe1647098bf00822d925f",
  "vite.config.ts": "0f5305794be1e7fb38d5d3465a6025817126d440265c49db41ca87096dd702de",
  "vitest.config.ts": "a0de83b3967226a98302bbb34aa2e1321890dba9ac1d1c8ce8a6b7989af87e44",
  "course360CapabilityRepair.vitest.config.ts": "837d552c9c20956ef662606c1dfb80a9e205697662f8eec385acfc2b6dd07878",
  "drizzle.config.ts": "9610673b3fe7b6b950a8e7e54cb1e91f9dd25f87d7ae6a41d2f6ada957065d01",
  "replication-config.example.json": "a204fca134db1cf263e166f739f92fb2a538a0bc382ed8501c928c55337e1ed7",
  "shared/tierLimits.ts": "024127c5371f5f53f074e4d1c9e9fce8fa9791265e31700751c285d509e0eb04",
  "server/lib/course360CrossToolVerifiedCatalog.ts": "787168229dec59ad6087d8d39d5991f3ec0e6791b5bf86e490ae8aa1d5780fca",
  "server/lib/canonicalCourse360Domain.ts": "eaa0ee30fca9e605223a4292b9c4676aeb4b729f713d9297ac3ef8f30c6896e2",
  "client/src/styles/course360PlatformPalette.css": "459430a3f3b6990183fd375e2b384c889ef7ebcb322f945a0138a110f210919c",
};

interface UnmarkedLiteral { file: string; line: number; text: string }

function clientSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return clientSourceFiles(path);
    return /\.(?:[cm]?[jt]s|[jt]sx)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name) ? [path] : [];
  }).sort();
}

function staticJsxText(node: ts.Node): string | undefined {
  if (ts.isJsxText(node)) return node.text;
  if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
    const text = node.children.map(staticJsxText);
    return text.every(value => value !== undefined) ? text.join("") : undefined;
  }
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "span") return "";
  if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression)) return node.expression.text;
  return undefined;
}

function adjacentTrademark(node: ts.JsxText): boolean {
  if (node.text.trim() !== "Course360") return false;
  const followsTrademark = (parent: ts.JsxElement | ts.JsxFragment, current: ts.Node): boolean => {
    let pastCurrent = false;
    for (const sibling of parent.children) {
      if (sibling === current) { pastCurrent = true; continue; }
      if (!pastCurrent) continue;
      if (ts.isJsxText(sibling) && !sibling.text.trim()) continue;
      const text = staticJsxText(sibling)?.trim();
      // The approved mobile logo retains an empty styling span before its mark.
      const emptySpan = (ts.isJsxElement(sibling) && sibling.openingElement.tagName.getText() === "span") ||
        (ts.isJsxSelfClosingElement(sibling) && sibling.tagName.getText() === "span");
      if (text === "" && emptySpan) continue;
      return text === "™";
    }
    return false;
  };
  const parent = node.parent;
  if ((ts.isJsxElement(parent) || ts.isJsxFragment(parent)) && followsTrademark(parent, node)) return true;
  const container = parent?.parent;
  return ts.isJsxElement(parent) && (ts.isJsxElement(container) || ts.isJsxFragment(container)) && followsTrademark(container, parent);
}

function findUnmarkedClientLiterals(file: string, text: string): UnmarkedLiteral[] {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: UnmarkedLiteral[] = [];
  const visit = (node: ts.Node): void => {
    const candidate = ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ||
      node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail;
    if (candidate) {
      const parent = node.parent;
      const moduleSpecifier = parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent));
      const propertyKey = parent && ts.isPropertyAssignment(parent) && parent.name === node;
      const raw = text.slice(node.getStart(ast), node.end);
      const stringValue = ts.isStringLiteralLike(node) ? node.text : undefined;
      const filename = stringValue !== undefined && /^(?:\.{0,2}\/)?[\w./@-]*Course360[\w./@-]*\.(?:[cm]?[jt]sx?|png|jpe?g|webp|svg|gif|zip|quiz|pdf|exe|dmg)$/i.test(stringValue);
      // Syntax-node traversal omits comments and identifiers by construction.
      // Use raw tokens so an existing escaped Unicode mark is recognized too.
      const unmarked = /\bCourse360(?![™\w-]|\\u2122|\.(?:app|net)\b)/g;
      if (!moduleSpecifier && !propertyKey && !filename && !(ts.isJsxText(node) && adjacentTrademark(node))) {
        for (const match of raw.matchAll(unmarked)) {
          findings.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast) + (match.index ?? 0)).line + 1, text: raw.trim() });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}

const DISPLAY_NAME_CASES: ReadonlyArray<readonly [string, string]> = [
  ["Course360", "Course360™"],
  ["Course360 Builder + Creator Web", "Course360™ Builder + Creator Web"],
  ["Course360 Pro + Creator Web", "Course360™ Pro + Creator Web"],
  ["Course360 Studio™ Web", "Course360™ Studio™ Web"],
  ["Course360 Creator™ Desktop", "Course360™ Creator™ Desktop"],
  ["Course360 Quiz Creator™ Bundle", "Course360™ Quiz Creator™ Bundle"],
  ["Course360™", "Course360™"],
  ["Course360™ Studio™ Web", "Course360™ Studio™ Web"],
  ["Course360\u2122 Creator\u2122", "Course360™ Creator™"],
  ["Course360™ Builder + Course360 Pro", "Course360™ Builder + Course360™ Pro"],
  ["Your Course360 account's library", "Your Course360™ account's library"],
  ["", ""],
];

describe("Course360 display-only trademark formatter", () => {
  it.each(DISPLAY_NAME_CASES)("formats and is idempotent for %s", (input: string, expected: string) => {
    const formatted = formatCourse360BrandName(input);
    expect(formatted).toBe(expected);
    expect(formatCourse360BrandName(formatted)).toBe(expected);
  });
  it.each([
    "https://course360.app/login", "https://Course360.app/login", "Course360.app", "Course360.net",
    "hello@course360.app", "https://school.course360.app", "Course360CrossToolOffers", "Course360_price",
    "Course360-creator-web", "MyCourse360", "course360_builder_creator_web_monthly", "Course360123",
  ])("does not rewrite supported domains or identifiers: %s", (input: string) => {
    expect(formatCourse360BrandName(input)).toBe(input);
  });
  it("formats every unchanged legacy catalog label without mutating any catalog value", () => {
    const catalogs = [COURSE360_PRICES, COURSE360_CROSS_TOOL_OFFERS];
    const before = catalogs.map(catalog => JSON.stringify(catalog));
    for (const catalog of catalogs) {
      for (const item of Object.values(catalog)) {
        expect(item.name.startsWith("Course360 ")).toBe(true);
        expect(formatCourse360BrandName(item.name)).toBe(item.name.replace("Course360", "Course360™"));
        expect(formatCourse360BrandName(formatCourse360BrandName(item.name))).toBe(formatCourse360BrandName(item.name));
      }
    }
    expect(catalogs.map(catalog => JSON.stringify(catalog))).toEqual(before);
  });
});

describe("Course360 literal-only source preservation", () => {
  it("retains all 70 independently guarded manifest source files", () => {
    expect(Object.keys(NORMALIZED_TRADEMARK_SOURCE_HASHES)).toHaveLength(70);
  });
  it.each(Object.entries(NORMALIZED_TRADEMARK_SOURCE_HASHES))("only changes the exact display token in %s", (file: string, baselineHash: string) => {
    const text = file === "client/src/pages/HelpPage.tsx"
      ? source(file).replace('Course360<span className="text-[#4ad9e0]"></span>', 'Course360<span className="text-[#4ad9e0]">™</span>')
      : source(file);
    expect(sha256(normalizeTrademark(text))).toBe(baselineHash);
  });
  it("keeps exactly one Help Center logo trademark without changing its two styling spans", () => {
    const help = source("client/src/pages/HelpPage.tsx");
    expect(help).toContain('Course360<span className="text-[#4ad9e0]"></span>');
    expect(help).toContain('<span className="text-xs align-super text-[#4ad9e0] ml-0.5">™</span>');
    expect(help).not.toContain('Course360™<span');
  });
  it.each(Object.entries(ADDITIONAL_SERVER_DISPLAY_HASHES))("preserves every server display source byte except approved trademark tokens in %s", (file: string, baselineHash: string) => {
    const text = normalizeTrademark(source(file));
    const restored = file === "server/lib/course360StudioRender.ts"
      ? text.replace("Course360 Studio™ • Trial", "Course360 Studio • Trial")
      : text;
    expect(sha256(restored)).toBe(baselineHash);
  });
  it.each(Object.entries(PROTECTED_BYTE_HASHES))("preserves protected baseline bytes for %s", (file: string, baselineHash: string) => {
    expect(sha256(readFileSync(resolve(process.cwd(), file)))).toBe(baselineHash);
  });
  it("keeps formatter calls confined to the four offer display sites and one checkout description", () => {
    const offers = source("client/src/components/Course360CrossToolOffers.tsx");
    const checkout = source("client/src/components/Course360CrossToolCheckout.tsx");
    expect(offers.match(/formatCourse360BrandName\(/g)).toHaveLength(4);
    expect(checkout.match(/formatCourse360BrandName\(/g)).toHaveLength(1);
    expect(offers).toContain('aria-label={`Continue with ${formatCourse360BrandName(offer.name)}`}');
    expect(offers).toContain("{formatCourse360BrandName(COURSE360_CROSS_TOOL_OFFERS[pendingOffer].name)}");
    expect(checkout).toContain("{offer ? formatCourse360BrandName(offer.name) : null}");
    expect(offers).toContain("onClick={() => void startCheckout(offerKey)}");
  });
  it("preserves every other offer and checkout byte after reversing only the approved display wrappers", () => {
    const unwrapImport = (value: string): string => value.replace('import { formatCourse360BrandName } from "@shared/course360DisplayBrand";\n', "");
    const offers = unwrapImport(source("client/src/components/Course360CrossToolOffers.tsx"))
      .replaceAll("formatCourse360BrandName(offer.name)", "offer.name")
      .replace("formatCourse360BrandName(COURSE360_CROSS_TOOL_OFFERS[pendingOffer].name)", "COURSE360_CROSS_TOOL_OFFERS[pendingOffer].name");
    const checkout = unwrapImport(source("client/src/components/Course360CrossToolCheckout.tsx"))
      .replace("offer ? formatCourse360BrandName(offer.name) : null", "offer?.name");
    expect(sha256(offers)).toBe("7a14f4898a2d3021bfdd7cbb2af01e2d83f6fc55f89e6f3ce058c7a8bd313691");
    expect(sha256(checkout)).toBe("a9c12a2323e24b00ba393ea7887a0dbaef2ef656442bb70cc37c87e898f46187");
  });
  it("preserves every other login byte after reversing only the approved copy and same-three-span mobile logo", () => {
    const login = normalizeTrademark(source("client/src/pages/auth/LoginPage.tsx"))
      .replace("Manage students as your school grows", "Manage unlimited students")
      .replace("Turn your knowledge into courses, connect with your learners, and grow your school with Course360.", "Build and deliver learning experiences with Course360 while retaining organization-specific branding.")
      .replace('style={{ color: NAVY, fontFamily: "\'Plus Jakarta Sans\', sans-serif" }}>Course360</span>', 'style={{ color: NAVY, fontFamily: "\'Plus Jakarta Sans\', sans-serif" }}>teach</span>')
      .replace('style={{ color: TEAL, fontFamily: "\'Plus Jakarta Sans\', sans-serif" }}></span>', 'style={{ color: TEAL, fontFamily: "\'Plus Jakarta Sans\', sans-serif" }}>ific</span>');
    expect(sha256(login)).toBe("ca64376de4307663933ded8bf4d5de43014df0080ca66a73f20a9e54b4269edc");
  });
  it("preserves every metadata byte other than the exact trademark token", () => {
    expect(sha256(normalizeTrademark(source("client/index.html")))).toBe("3d570753eb2349b6b1ea1bca3fed465e8bac9e7faba3a483a7f79ab36b75d464");
  });
  it("changes only the root fallback and leaves supplied school-name resolution intact", () => {
    const branding = source("client/src/hooks/useOrgAuthBranding.ts");
    expect(branding).toContain('displayName: branding?.orgName ?? "Course360™"');
    expect(sha256(branding.replace('branding?.orgName ?? "Course360™"', 'branding?.orgName ?? "Teachific"'))).toBe("fea8a37f56c5656fafd142967c22c097097aac4a9ba75a48010fdafbf33dc006");
    const login = source("client/src/pages/auth/LoginPage.tsx");
    expect(login).toContain('{isOrgSubdomain ? `Sign in to ${displayName}` : "Sign in to your Course360™ account"}');
  });
});

describe("Course360 built-in client string and JSX literal scan", () => {
  it("finds all plain-name JSX, string and interpolated-template occurrences", () => {
    const fixture = 'const name = "Course360 Studio™"; const prompt = `Open ${name} in Course360`; const view = <p>Course360</p>;';
    expect(findUnmarkedClientLiterals("fixture.tsx", fixture)).toHaveLength(3);
  });
  it("excludes comments, filenames, identifiers, domains, escaped marks and adjacent logo trademark spans", () => {
    const fixture = String.raw`
      // Course360 is a source comment, not visible copy.
      /* Course360 documentation only. */
      import Course360Page from "./Course360Page";
      const file = "Course360.png", id = "Course360App", key = "Course360-plan";
      const domains = ["Course360.app", "hello@course360.app", "Course360.net"];
      const marked = "Course360\u2122 Studio\u2122";
      const visible = <><p>Course360™</p><p>Course360<span>™</span></p>
        <div><span>Course360</span><span>™</span></div>
        <div><span>Course360</span><span></span><span>™</span></div></>;
    `;
    expect(findUnmarkedClientLiterals("fixture.tsx", fixture)).toEqual([]);
  });
  it("does not mistake a different sibling product label or unrelated trademark for an already-marked platform name", () => {
    const fixture = '<div><span>Course360</span><span>Creator</span><sup>™</sup></div>;<div><span>Course360</span><span>other</span><span>™</span></div>;';
    expect(findUnmarkedClientLiterals("fixture.tsx", fixture)).toHaveLength(2);
  });
  it("contains no remaining unmarked built-in client literal platform names", () => {
    const findings = clientSourceFiles(resolve(process.cwd(), "client/src")).flatMap(path => {
      const file = relative(process.cwd(), path).split("\\").join("/");
      const text = readFileSync(path, "utf8");
      return text.includes("Course360") ? findUnmarkedClientLiterals(file, text) : [];
    });
    expect(findings).toEqual([]);
  });
});
