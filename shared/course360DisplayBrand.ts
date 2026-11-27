/** Format trusted platform/catalog display labels only. Never use on tenant names,
 * user-authored content, URLs, product IDs, or persisted Stripe catalog records. */
export function formatCourse360BrandName(value: string): string {
  return value.replace(/\bCourse360(?![™\w-]|\.app|\.net)/g, "Course360™");
}
