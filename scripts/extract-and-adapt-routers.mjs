#!/usr/bin/env node

/**
 * Router Extraction & Adaptation Script
 * Extracts routers from imported modules and adapts them for org-level scoping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const modulesRoot = '/home/ubuntu/upload/teachific-modules';
const serverDir = path.join(projectRoot, 'server');

// Router extraction configuration
const routersToExtract = [
  // Priority 1: LMS Core
  { module: 'lms', file: 'lmsCourseBuilderRouter.ts', name: 'lmsCourseBuilderRouter', replace: false },
  { module: 'lms', file: 'lmsEnrollmentAdminRouter.ts', name: 'lmsEnrollmentAdminRouter', replace: false },
  { module: 'lms', file: 'lmsCohortAdminRouter.ts', name: 'lmsCohortAdminRouter', replace: false },
  
  // Priority 2: Forms & Media
  { module: 'form-builder', file: 'formBuilderRouter.ts', name: 'formBuilderRouter', replace: true },
  { module: 'form-builder', file: 'generalFormRouter.ts', name: 'generalFormRouter', replace: false },
  { module: 'media-repository', file: 'mediaRepoRouter.ts', name: 'mediaRepoRouter', replace: true },
  
  // Priority 3: Funnels & Membership
  { module: 'funnel-management', file: 'funnelRouter.ts', name: 'funnelRouter', replace: true },
  { module: 'funnel-management', file: 'downloadsRouter.ts', name: 'downloadsRouter', replace: true },
  { module: 'member-management', file: 'brandMembershipRouter.ts', name: 'membershipRouter', replace: true },
  
  // Priority 4: Admin
  { module: 'member-management', file: 'adminUserRouter.ts', name: 'adminUserRouter', replace: false },
];

// Adaptation rules: find/replace patterns for org-level scoping
const adaptationRules = [
  // Remove brand-specific imports and references
  { find: /import.*from.*thinkific.*\n/g, replace: '' },
  { find: /import.*ssoRouter.*\n/g, replace: '' },
  { find: /\.brandId/g, replace: '.orgId' },
  { find: /brandId:/g, replace: 'orgId:' },
  { find: /brandId\s*=/g, replace: 'orgId =' },
  
  // Ensure orgId filtering on all queries
  { find: /where\(eq\(([a-zA-Z]+)\.brandId/g, replace: 'where(eq($1.orgId' },
  
  // Update context checks
  { find: /ctx\.brand/g, replace: 'ctx.org' },
  { find: /ctx\.user\.brandId/g, replace: 'ctx.org.id' },
  
  // Remove Thinkific imports
  { find: /import.*getThinkificCourse.*\n/g, replace: '' },
  { find: /import.*getEnrollmentsForCourse.*\n/g, replace: '' },
  
  // Fix import paths
  { find: /from ["']\.\.\/\.\.\/drizzle\/schema["']/g, replace: 'from "../drizzle/schema"' },
  { find: /from ["']\.\.\/\._core\/trpc["']/g, replace: 'from "./_core/trpc"' },
  { find: /from ["']\.\.\/db["']/g, replace: 'from "./db"' },
  { find: /from ["']\.\.\/storage["']/g, replace: 'from "./storage"' },
  { find: /from ["']\.\.\/\._core\/llm["']/g, replace: 'from "./_core/llm"' },
];

async function extractRouter(config) {
  const sourceFile = path.join(modulesRoot, config.module, 'server', 'routers', config.file);
  const destFile = path.join(serverDir, config.file);
  
  if (!fs.existsSync(sourceFile)) {
    console.warn(`⚠️  Source file not found: ${sourceFile}`);
    return false;
  }
  
  try {
    let content = fs.readFileSync(sourceFile, 'utf-8');
    
    // Apply adaptation rules
    for (const rule of adaptationRules) {
      content = content.replace(rule.find, rule.replace);
    }
    
    // Remove Thinkific-specific procedures if present
    if (config.module === 'lms') {
      content = content.replace(/export const lmsThinkificRouter[\s\S]*?(?=export const|\Z)/g, '');
    }
    
    fs.writeFileSync(destFile, content, 'utf-8');
    console.log(`✅ Extracted & adapted: ${config.file}`);
    return true;
  } catch (error) {
    console.error(`❌ Error extracting ${config.file}:`, error.message);
    return false;
  }
}

async function updateAppRouter() {
  const routersFile = path.join(serverDir, 'routers.ts');
  let content = fs.readFileSync(routersFile, 'utf-8');
  
  // Build import statements for new routers
  const imports = routersToExtract
    .filter(r => !['lmsRouter', 'emailCampaignsRouter', 'funnelsRouter', 'mediaRouter', 'membershipRouter', 'formsRouter'].includes(r.name))
    .map(r => `import { ${r.name} } from "./${r.file.replace('.ts', '')}";`)
    .join('\n');
  
  // Add imports after existing router imports
  const importInsertPoint = content.indexOf('import { protectedProcedure, publicProcedure, router }');
  if (importInsertPoint > 0) {
    content = content.slice(0, importInsertPoint) + imports + '\n' + content.slice(importInsertPoint);
  }
  
  // Update appRouter to include new routers
  const appRouterStart = content.indexOf('export const appRouter = router({');
  const appRouterEnd = content.indexOf('// ── Embed Token', appRouterStart);
  
  if (appRouterStart > 0 && appRouterEnd > 0) {
    const appRouterContent = content.slice(appRouterStart, appRouterEnd);
    
    // Add new routers to appRouter
    const newRouterEntries = routersToExtract
      .filter(r => !['lmsRouter', 'emailCampaignsRouter', 'funnelsRouter', 'mediaRouter', 'membershipRouter', 'formsRouter'].includes(r.name))
      .map(r => `  ${r.name.replace('Router', '')}: ${r.name},`)
      .join('\n');
    
    const updatedAppRouter = appRouterContent.replace(
      'teachificPay: teachificPayRouter,',
      `teachificPay: teachificPayRouter,\n${newRouterEntries}`
    );
    
    content = content.slice(0, appRouterStart) + updatedAppRouter + content.slice(appRouterEnd);
  }
  
  fs.writeFileSync(routersFile, content, 'utf-8');
  console.log('✅ Updated appRouter with new routers');
}

async function main() {
  console.log('🚀 Starting router extraction and adaptation...\n');
  
  let successCount = 0;
  for (const config of routersToExtract) {
    const success = await extractRouter(config);
    if (success) successCount++;
  }
  
  console.log(`\n📊 Extracted ${successCount}/${routersToExtract.length} routers`);
  
  if (successCount > 0) {
    console.log('\n🔄 Updating appRouter...');
    await updateAppRouter();
    console.log('\n✅ Router extraction and adaptation complete!');
    console.log('📝 Next: Run `pnpm tsc --noEmit` to check for TypeScript errors');
  }
}

main().catch(console.error);
