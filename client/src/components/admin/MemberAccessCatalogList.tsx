import { Badge } from "@/components/ui/badge";

export type MemberAccessCatalogFilter = "all" | "courses" | "downloads" | "bundles" | "memberships";
export type MemberAccessProduct = { id: number; type: "download" | "bundle"; title: string };

function CatalogSection({ title, count, emptyMessage, children }: { title: string; count: number; emptyMessage: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">{count} available</span>
      </div>
      {count > 0 ? children : <p className="px-4 py-3 text-sm text-muted-foreground">{emptyMessage}</p>}
    </section>
  );
}

const matchesSearch = (search: string, ...values: Array<string | null | undefined>) => {
  const term = search.trim().toLowerCase();
  return !term || values.filter(Boolean).join(" ").toLowerCase().includes(term);
};

export function MemberAccessCatalogList({
  catalog,
  search,
  filter = "all",
  selectedCourseIds,
  selectedProducts,
  selectedPlanIds,
  onToggleCourse,
  onToggleProduct,
  onTogglePlan,
}: {
  catalog: { courses: Array<{ id: number; title: string | null; type: string | null }>; products: MemberAccessProduct[]; memberships: Array<{ id: number; name: string; billingInterval: string }> } | undefined;
  search: string;
  filter?: MemberAccessCatalogFilter;
  selectedCourseIds: number[];
  selectedProducts: MemberAccessProduct[];
  selectedPlanIds: number[];
  onToggleCourse: (id: number) => void;
  onToggleProduct: (product: MemberAccessProduct) => void;
  onTogglePlan: (id: number) => void;
}) {
  const courses = (catalog?.courses ?? []).filter((course) => matchesSearch(search, course.title, course.type));
  const products = (catalog?.products ?? []).filter((product) => matchesSearch(search, product.title, product.type));
  const memberships = (catalog?.memberships ?? []).filter((plan) => matchesSearch(search, plan.name, plan.billingInterval));
  const filteredProducts = filter === "downloads" ? products.filter((product) => product.type === "download") : filter === "bundles" ? products.filter((product) => product.type === "bundle") : products;
  const showCourses = filter === "all" || filter === "courses";
  const showProducts = filter === "all" || filter === "downloads" || filter === "bundles";
  const showMemberships = filter === "all" || filter === "memberships";
  const checkboxClass = "mt-1 h-4 w-4 accent-[var(--org-primary)]";

  return (
    <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-border bg-card">
      {showCourses && <CatalogSection title="Courses and content" count={courses.length} emptyMessage="No courses match this search.">
        {courses.map((course) => <label key={course.id} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]">
          <input type="checkbox" checked={selectedCourseIds.includes(course.id)} onChange={() => onToggleCourse(course.id)} className={checkboxClass} />
          <span className="min-w-0 flex-1"><span className="block break-words font-medium text-foreground">{course.title || "Untitled Course"}</span><span className="mt-0.5 block text-xs text-muted-foreground">{course.type || "Course"}</span></span>
          <Badge variant="outline" className="shrink-0 border-[color:color-mix(in_srgb,var(--org-primary)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] text-[var(--org-primary)]">Course</Badge>
        </label>)}
      </CatalogSection>}
      {showProducts && <CatalogSection title={filter === "downloads" ? "Downloads" : filter === "bundles" ? "Bundles" : "Downloads and bundles"} count={filteredProducts.length} emptyMessage="No matching downloads or bundles were found.">
        {filteredProducts.map((product) => {
          const checked = selectedProducts.some((item) => item.id === product.id && item.type === product.type);
          return <label key={`${product.type}-${product.id}`} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]">
            <input type="checkbox" checked={checked} onChange={() => onToggleProduct(product)} className={checkboxClass} />
            <span className="min-w-0 flex-1"><span className="block break-words font-medium text-foreground">{product.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">Grant complimentary access</span></span>
            <Badge variant="outline" className="shrink-0 capitalize">{product.type}</Badge>
          </label>;
        })}
      </CatalogSection>}
      {showMemberships && <CatalogSection title="Memberships" count={memberships.length} emptyMessage="No memberships match this search.">
        {memberships.map((plan) => <label key={plan.id} className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]">
          <input type="checkbox" checked={selectedPlanIds.includes(plan.id)} onChange={() => onTogglePlan(plan.id)} className={checkboxClass} />
          <span className="min-w-0 flex-1"><span className="block break-words font-medium text-foreground">{plan.name || "Untitled Membership"}</span><span className="mt-0.5 block text-xs capitalize text-muted-foreground">{plan.billingInterval} · complimentary active access</span></span>
          <Badge variant="outline" className="shrink-0">Membership</Badge>
        </label>)}
      </CatalogSection>}
    </div>
  );
}
