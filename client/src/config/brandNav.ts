/**
 * Course360 platform navigation configuration.
 * Navigation uses platform-owned routes only; organizations supply their own
 * branding and menus through their scoped site settings.
 */
import type { Brand } from "@/hooks/useBrand";
import { BookOpen, ClipboardCheck, Heart, Layers, MessageCircle } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon?: any;
  external?: boolean;
  pinLast?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface BrandNavConfig {
  navGroups: NavGroup[];
  hiddenNavItems: NavItem[];
  logoUrl: string;
  logoAlt: string;
  title: string;
  subtitle: string;
  bgColor: string;
  accentColor: string;
}

const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ path: "/", label: "Dashboard", icon: Heart }],
  },
  {
    label: "Learning",
    items: [
      { path: "/courses", label: "Courses", icon: BookOpen },
      { path: "/quizzes", label: "Quizzes", icon: ClipboardCheck },
      { path: "/products/bundles", label: "Products", icon: Layers },
    ],
  },
  {
    label: "Community",
    items: [{ path: "/products/community", label: "Community", icon: MessageCircle }],
  },
];

const PLATFORM_HIDDEN_NAV: NavItem[] = [
  { path: "/profile", label: "My Profile" },
  { path: "/media", label: "Media Library" },
];

export function getBrandNavConfig(_brand?: Brand): BrandNavConfig {
  return {
    navGroups: PLATFORM_NAV_GROUPS,
    hiddenNavItems: PLATFORM_HIDDEN_NAV,
    logoUrl: import.meta.env.VITE_APP_LOGO || "/manus-storage/course360-logo_3d94d0e3.png",
    logoAlt: "Course360™",
    title: "Course360™",
    subtitle: "SCORM & LMS Hosting Platform",
    bgColor: "#0e1e2e",
    accentColor: "#4ad9e0",
  };
}
