/**
 * Teachific platform navigation configuration.
 * Routes are retained for compatibility while labels remain product-neutral.
 */
import type { Brand } from "@/hooks/useBrand";
import {
  Heart, Calculator, ClipboardList, Activity,
  BookOpen, Stethoscope, Zap, ExternalLink, MessageCircle, Award, Shield, GraduationCap,
  BookMarked, Library, Crown, Layers, ClipboardCheck, Brain, Trophy, Volume2, FileText, BookCheck,
  Briefcase
} from "lucide-react";

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
  bgColor: string; // sidebar bg
  accentColor: string; // accent text color
}

// ─── Platform Navigation ────────────────────────────────────────────────────────
const PLATFORM_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: Heart },
    ],
  },
  {
    label: "Clinical Tools",
    items: [
      { path: "/ultrasound-assist", label: "Guided Tools", icon: Stethoscope },
      { path: "/calculators", label: "Clinical Calculators", icon: Calculator },
      { path: "/pediatric-navigator", label: "Pediatric Tools", icon: Stethoscope },
      { path: "/pediatric-calculators", label: "Pediatric Calculators", icon: Calculator },
      { path: "/clinical-intelligence", label: "Clinical Intelligence", icon: Brain },
    ],
  },
  {
    label: "Learning",
    items: [
      { path: "/quickfire-aaus", label: "Daily Challenge", icon: Zap },
      { path: "/flashcards", label: "Flashcards", icon: Layers },
      { path: "/case-library", label: "Case Library", icon: Library },
      { path: "/soundbytes-aaus", label: "SoundBytes\u2122", icon: BookMarked },
      { path: "/cme", label: "CME Hub", icon: GraduationCap },
      { path: "/registry-review", label: "Registry Review Hub", icon: ClipboardCheck },
      { path: "__LEARN_FETAL_ECHO_URL__", label: "Learn Fetal Echo", icon: BookOpen, external: true },
      { path: "__LEARN_ECHO_URL__", label: "Learn Echo", icon: BookOpen, external: true },
      { path: "__LEARN_VASCULAR_URL__", label: "Learn Vascular", icon: BookOpen, external: true },
      { path: "__LEARN_POCUS_URL__", label: "Learn POCUS", icon: BookOpen, external: true },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/community/all-about-ultrasound", label: "Community Hub", icon: MessageCircle },
    ],
  },
  {
    label: "Career",
    items: [
      { path: "/career-network", label: "Career Network", icon: Briefcase },
    ],
  },
  {
    label: "Premium",
    items: [
      { path: "/premium", label: "Premium Access", icon: Crown },
    ],
  },
];

const PLATFORM_HIDDEN_NAV: NavItem[] = [
  { path: "/image-quality-review", label: "Image Quality Review" },
  { path: "/profile", label: "My Profile" },
  { path: "/case-library/submit", label: "Submit a Case" },
  { path: "/admin/cases-aaus", label: "Case Management" },
  { path: "/admin/quickfire-aaus", label: "Daily Challenge Admin" },
  { path: "/admin/thinkific-webhook-aaus", label: "Thinkific Webhook" },
  { path: "/echo-assist-hub", label: "Echo Tools" },
  { path: "/scan-coach", label: "Scan Coach" },
  { path: "/pocus-assist-hub", label: "Point-of-Care Tools" },
  { path: "/pocus-efast-navigator", label: "eFAST Navigator" },
  { path: "/pocus-rush-navigator", label: "RUSH Navigator" },
  { path: "/pocus-cardiac-navigator", label: "Cardiac POCUS Navigator" },
  { path: "/pocus-lung-navigator", label: "Lung POCUS Navigator" },
  { path: "/pocus-efast-scan-coach", label: "eFAST Scan Coach" },
  { path: "/pocus-rush-scan-coach", label: "RUSH Scan Coach" },
  { path: "/pocus-cardiac-scan-coach", label: "Cardiac POCUS Scan Coach" },
  { path: "/pocus-lung-scan-coach", label: "Lung POCUS Scan Coach" },
  { path: "/ecg-navigator", label: "ECG Navigator" },
  { path: "/ecg-coach", label: "ECG Coach" },
  { path: "/ecg-assist", label: "ECG Tools" },
  { path: "/fetal-echo-assist", label: "Fetal Echo Tools" },
  { path: "/fetal-navigator", label: "Fetal Echo Navigator" },
  { path: "/fetal-scan-coach", label: "Fetal Echo Scan Coach" },
  { path: "/pediatric-echo-assist", label: "Pediatric Echo Tools" },
  { path: "/achd-echo-assist", label: "Congenital Echo Tools" },
  { path: "/diy-accreditation-plans", label: "DIY Accreditation\u2122 Plans" },
  { path: "/diy-accreditation-smart", label: "DIY Accreditation\u2122" },
  { path: "/diy-register", label: "Register Your Lab" },
  { path: "/lab-admin", label: "Lab Admin Portal" },
  { path: "/diy-member", label: "Member Portal" },
  { path: "/ultrasound-assist", label: "Guided Tools" },
  { path: "/calculators", label: "Clinical Calculators" },
  { path: "/abdominal-navigator", label: "Abdominal Navigator" },
  { path: "/abdominal-scan-coach", label: "Abdominal Scan Coach" },
  { path: "/pelvic-gyn-navigator", label: "Pelvic/Gyn Navigator" },
  { path: "/pelvic-gyn-scan-coach", label: "Pelvic/Gyn Scan Coach" },
  { path: "/ob1-navigator", label: "OB 1st Trimester Navigator" },
  { path: "/ob1-scan-coach", label: "OB 1st Trimester Scan Coach" },
  { path: "/ob23-navigator", label: "OB 2nd/3rd Trimester Navigator" },
  { path: "/ob23-scan-coach", label: "OB 2nd/3rd Trimester Scan Coach" },
  { path: "/thyroid-navigator", label: "Thyroid Navigator" },
  { path: "/thyroid-scan-coach", label: "Thyroid Scan Coach" },
  { path: "/scrotum-navigator", label: "Scrotal Navigator" },
  { path: "/scrotum-scan-coach", label: "Scrotal Scan Coach" },
  { path: "/breast-navigator", label: "Breast Navigator" },
  { path: "/breast-scan-coach", label: "Breast Scan Coach" },
  { path: "/venous-navigator", label: "Venous Navigator" },
  { path: "/venous-scan-coach", label: "Venous Scan Coach" },
  { path: "/arterial-navigator", label: "Arterial Navigator" },
  { path: "/arterial-scan-coach", label: "Arterial Scan Coach" },
  { path: "/abdominal-vascular-navigator", label: "Abdominal Vascular Navigator" },
  { path: "/abdominal-vascular-scan-coach", label: "Abdominal Vascular Scan Coach" },
  { path: "/aorta-navigator", label: "Abdominal Aorta Navigator" },
  { path: "/aorta-scan-coach", label: "Abdominal Aorta Scan Coach" },
  { path: "/carotid-navigator", label: "Carotid Navigator" },
  { path: "/carotid-scan-coach", label: "Carotid Scan Coach" },
  { path: "/tcd-navigator", label: "TCD Navigator" },
  { path: "/tcd-scan-coach", label: "TCD Scan Coach" },
  { path: "/msk-navigator", label: "MSK Navigator" },
  { path: "/msk-scan-coach", label: "MSK Scan Coach" },
  { path: "/pocus-assist", label: "Point-of-Care Tools" },
  { path: "/pediatric-navigator", label: "Pediatric Navigator" },
  { path: "/pediatric-scan-coach", label: "Pediatric Scan Coach" },
  { path: "/pediatric-calculators", label: "Pediatric Calculators" },
  { path: "/soundbytes-aaus", label: "Audio Learning Library" },
  { path: "/educator-assist", label: "Educator Tools" },
];

// ─── Alternate Platform Navigation ──────────────────────────────────────────────
const ALTERNATE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: Heart },
    ],
  },
  {
    label: "Clinical Tools",
    items: [
      { path: "/echo-assist-hub", label: "Echo Tools", icon: Stethoscope },
      { path: "/pocus-assist-hub", label: "Point-of-Care Tools", icon: Shield },
      { path: "/hemodynamics", label: "Hemodynamics Lab", icon: Activity },
      { path: "/echoassist", label: "Clinical Calculators", icon: Calculator },
      { path: "/guidelines-assist", label: "Guidelines Library", icon: BookCheck },
      { path: "/report", label: "Report Builder", icon: FileText },
    ],
  },
  {
    label: "Learning",
    items: [
      { path: "/quickfire-ihe", label: "Daily Challenge", icon: Zap },
      { path: "/flashcards", label: "Flashcards", icon: Layers },
      { path: "/case-library", label: "Case Library", icon: Library },
      { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { path: "/soundbytes-ihe", label: "Audio Learning Library", icon: Volume2 },
      { path: "/cme", label: "CME Hub", icon: GraduationCap },
      { path: "/registry-review", label: "Registry Review", icon: BookMarked },
      { path: "__LEARN_ACS_URL__", label: "ACS Mastery", icon: Award, external: true },
      { path: "__LEARN_ECHO_URL__", label: "Learn Echo", icon: GraduationCap, external: true },
      { path: "__LEARN_PEDS_ECHO_URL__", label: "Learn Pediatric Echo", icon: BookOpen, external: true },
      { path: "__LEARN_FETAL_ECHO_URL__", label: "Learn Fetal Echo", icon: BookOpen, external: true },
      { path: "__LEARN_VASCULAR_URL__", label: "Learn Vascular", icon: Activity, external: true },
      { path: "__LEARN_POCUS_URL__", label: "Learn POCUS", icon: Stethoscope, external: true },
    ],
  },
  {
    label: "Accreditation",
    items: [
      { path: "/accreditation-navigator", label: "Accreditation Navigator", icon: Award },
      { path: "/diy-accreditation-smart", label: "DIY Accreditation\u2122", icon: ClipboardList },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/community/all-about-ultrasound", label: "Teachific™ Community", icon: MessageCircle },
    ],
  },
  {
    label: "Career",
    items: [
      { path: "/career-network", label: "Career Network", icon: Briefcase },
    ],
  },
  {
    label: "Premium",
    items: [
      { path: "/premium", label: "Premium Access", icon: Crown },
    ],
  },
];

const ALTERNATE_HIDDEN_NAV: NavItem[] = [
  { path: "/image-quality-review", label: "Image Quality Review" },
  { path: "/profile", label: "My Profile" },
  { path: "/case-library/submit", label: "Submit a Case" },
  { path: "/admin/cases-ihe", label: "Case Management" },
  { path: "/admin/quickfire-ihe", label: "Daily Challenge Admin" },
  { path: "/admin/thinkific-webhook-ihe", label: "Thinkific Webhook" },
  { path: "/echo-assist-hub", label: "Echo Tools" },
  { path: "/guidelines-assist", label: "Guidelines Library" },
  { path: "/scan-coach", label: "Scan Coach" },
  { path: "/pocus-assist-hub", label: "Point-of-Care Tools" },
  { path: "/pocus-efast", label: "eFAST Navigator" },
  { path: "/pocus-rush", label: "RUSH Navigator" },
  { path: "/pocus-cardiac", label: "Cardiac POCUS Navigator" },
  { path: "/pocus-lung", label: "Lung POCUS Navigator" },
  { path: "/pocus-efast-scan-coach", label: "eFAST Scan Coach" },
  { path: "/pocus-rush-scan-coach", label: "RUSH Scan Coach" },
  { path: "/pocus-cardiac-scan-coach", label: "Cardiac POCUS Scan Coach" },
  { path: "/pocus-lung-scan-coach", label: "Lung POCUS Scan Coach" },
  { path: "/ecg-navigator", label: "ECG Navigator" },
  { path: "/ecg-coach", label: "ECG Coach" },
  { path: "/ecg-assist", label: "ECG Tools" },
  { path: "/fetal-echo-assist", label: "Fetal Echo Tools" },
  { path: "/pediatric-echo-assist", label: "Pediatric Echo Tools" },
  { path: "/achd-echo-assist", label: "Congenital Echo Tools" },
  { path: "/diy-accreditation-plans", label: "DIY Accreditation\u2122 Plans" },
  { path: "/diy-accreditation-smart", label: "DIY Accreditation\u2122" },
  { path: "/diy-register", label: "Register Your Lab" },
  { path: "/lab-admin", label: "Lab Admin Portal" },
  { path: "/diy-member", label: "Member Portal" },
  { path: "/hemodynamics", label: "Hemodynamics Lab" },
  { path: "/echoassist", label: "Clinical Calculators" },
  { path: "/report", label: "Report Builder" },
  { path: "/educator-assist", label: "Educator Tools" },
  { path: "/soundbytes-ihe", label: "Audio Learning Library" },
  { path: "/engagement", label: "Engagement Dashboard" },
  { path: "/student-dashboard", label: "Student Dashboard" },
];

// ─── Exported config getter ─────────────────────────────────────────────────────
export function getBrandNavConfig(_brand?: Brand): BrandNavConfig {
  // Teachific is a single-brand multi-tenant platform — always return Teachific config
  return {
    navGroups: PLATFORM_NAV_GROUPS,
    hiddenNavItems: PLATFORM_HIDDEN_NAV,
    logoUrl: "",
    logoAlt: "Teachific™",
    title: "Teachific™",
    subtitle: "SCORM & LMS Hosting Platform",
    bgColor: "#0e1e2e",
    accentColor: "#4ad9e0",
  };
}
