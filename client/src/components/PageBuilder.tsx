import React, { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GripVertical,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Image,
  Type,
  Layout,
  MousePointer,
  BookOpen,
  Video,
  Star,
  DollarSign,
  CheckSquare,
  Code,
  AlignLeft,
  Eye,
  EyeOff,
  Copy,
  Clipboard,
  ClipboardPaste,
  Pencil,
  Check,
  Save,
  Undo2,
  Redo2,
  Upload,
  Film,
  X,
  FileDown,
} from "lucide-react";
import { nanoid } from "nanoid";
import * as LucideIcons from "lucide-react";

// ─── Lucide Icon Registry ─────────────────────────────────────────────────────
// Curated set of icons useful for feature grids, icon lists, etc.
const ICON_NAMES: string[] = [
  "Check", "Star", "Zap", "BookOpen", "Users", "Award", "Clock", "ArrowRight",
  "Heart", "Shield", "Target", "Lightbulb", "Rocket", "Globe", "Lock", "Unlock",
  "Mail", "Phone", "MessageCircle", "Bell", "Calendar", "Camera", "Video",
  "Music", "Headphones", "Mic", "Play", "Pause", "Download", "Upload",
  "File", "FileText", "Folder", "Database", "Server", "Cloud", "Wifi",
  "Monitor", "Smartphone", "Tablet", "Cpu", "Code", "Terminal", "Settings",
  "Search", "Filter", "BarChart", "PieChart", "TrendingUp", "DollarSign",
  "CreditCard", "ShoppingCart", "Package", "Truck", "MapPin", "Navigation",
  "Home", "Building", "Briefcase", "GraduationCap", "BookMarked", "Pencil",
  "Clipboard", "List", "CheckSquare", "ThumbsUp", "Smile", "Sun", "Moon",
];

function LucideIcon({ name, size = 20, color = "#fff" }: { name: string; size?: number; color?: string }) {
  const IconComp = (LucideIcons as any)[name];
  if (!IconComp) return <span style={{ fontSize: size * 0.6, color }}>{name[0]}</span>;
  return <IconComp size={size} color={color} strokeWidth={2} />;
}

// ─── Block Types ─────────────────────────────────────────────────────────────

export type BlockType =
  | "banner"
  | "text_media"
  | "image"
  | "cta"
  | "course_outline"
  | "video"
  | "testimonials"
  | "pricing"
  | "checklist"
  | "html"
  | "spacer"
  | "divider"
  | "bg_section"
  | "button"
  | "icon_list"
  | "numbered_steps"
  | "checklist_steps"
  | "feature_grid"
  | "faq"
  | "embed_html"
  | "columns";

export interface Block {
  id: string;
  type: BlockType;
  visible: boolean;
  data: Record<string, any>;
}

// ─── Block Defaults ───────────────────────────────────────────────────────────

const BLOCK_DEFAULTS: Record<BlockType, Record<string, any>> = {
  banner: {
    headline: "Welcome to Our Course",
    headline2: "",
    subtext: "Start learning today and transform your skills.",
    ctaText: "Enroll Now",
    ctaUrl: "#",
    ctaSecondaryText: "",
    ctaSecondaryUrl: "",
    backgroundType: "color",
    backgroundColor: "#1e293b",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    textColor: "#ffffff",
    height: "large",
    alignment: "center",
    overlay: true,
    overlayOpacity: 0.5,
  },
  text_media: {
    headline: "Why Choose This Course?",
    body: "Our curriculum is designed by industry experts to give you the most relevant and up-to-date knowledge.",
    imageUrl: "",
    imagePosition: "right",
    imageAlt: "",
    ctaText: "",
    ctaUrl: "",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
  },
  image: {
    imageUrl: "",
    imageAlt: "",
    caption: "",
    width: "full",
    alignment: "center",
    linkUrl: "",
    backgroundColor: "#ffffff",
  },
  cta: {
    headline: "Ready to Get Started?",
    headline2: "",
    subtext: "Join thousands of students already learning.",
    ctaText: "Start Learning",
    ctaUrl: "#",
    ctaStyle: "primary",
    backgroundType: "color",
    backgroundColor: "#0f172a",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    textColor: "#ffffff",
    ctaBgColor: "",
    ctaTextColor: "",
    alignment: "center",
    overlay: true,
    overlayOpacity: 0.5,
  },
  course_outline: {
    headline: "What You'll Learn",
    courseId: null,
    showLessonCount: true,
    showDuration: true,
    backgroundColor: "#f8fafc",
    textColor: "#1e293b",
  },
  video: {
    headline: "",
    videoUrl: "",
    videoType: "youtube",
    autoplay: false,
    showControls: true,
    backgroundColor: "#000000",
    maxWidth: "800",
  },
  testimonials: {
    headline: "",
    testimonials: [],
    backgroundColor: "#f8fafc",
    textColor: "#1e293b",
    layout: "grid",
  },
  pricing: {
    headline: "Choose Your Plan",
    courseId: null,
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    accentColor: "#189aa1",
  },
  checklist: {
    headline: "Course Includes",
    items: [
      { id: nanoid(4), text: "Lifetime access to all materials" },
      { id: nanoid(4), text: "Certificate of completion" },
      { id: nanoid(4), text: "Community support" },
    ],
    icon: "check",
    iconColor: "#22c55e",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    columns: 2,
  },
  html: {
    html: "<p>Custom HTML content here</p>",
    backgroundColor: "#ffffff",
  },
  spacer: {
    height: 60,
    backgroundColor: "#ffffff",
  },
  divider: {
    style: "solid",
    color: "#e2e8f0",
    thickness: 1,
    margin: 40,
    backgroundColor: "#ffffff",
  },
  bg_section: {
    headline: "Our Mission",
    body: "We believe in empowering learners with the best education possible.",
    backgroundImageUrl: "",
    overlay: true,
    overlayOpacity: 0.6,
    textColor: "#ffffff",
    alignment: "center",
    paddingY: 80,
  },
  button: {
    text: "Get Started",
    url: "#",
    variant: "primary",
    size: "medium",
    alignment: "center",
    backgroundColor: "#ffffff",
  },
  icon_list: {
    headline: "Key Features",
    items: [
      { id: nanoid(4), icon: "check", text: "Easy to use interface" },
      { id: nanoid(4), icon: "star", text: "Expert instructors" },
      { id: nanoid(4), icon: "zap", text: "Fast and efficient" },
    ],
    iconColor: "#189aa1",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    columns: 1,
  },
  numbered_steps: {
    headline: "How It Works",
    steps: [
      { id: nanoid(4), title: "Sign Up", description: "Create your free account in seconds", mediaType: "none", mediaUrl: "", mediaPosition: "below" },
      { id: nanoid(4), title: "Choose a Course", description: "Browse our catalog and pick what interests you", mediaType: "none", mediaUrl: "", mediaPosition: "below" },
      { id: nanoid(4), title: "Start Learning", description: "Access your course materials immediately", mediaType: "none", mediaUrl: "", mediaPosition: "below" },
    ],
    numberColor: "#189aa1",
    backgroundColor: "#f8fafc",
    textColor: "#1e293b",
    listPosition: "left",
    alignment: "left",
  },
  checklist_steps: {
    headline: "What You'll Learn",
    steps: [
      { id: nanoid(4), title: "Core concepts explained clearly", description: "", mediaType: "none", mediaUrl: "", mediaPosition: "below" },
      { id: nanoid(4), title: "Hands-on practice exercises", description: "", mediaType: "none", mediaUrl: "", mediaPosition: "below" },
      { id: nanoid(4), title: "Real-world project experience", description: "", mediaType: "none", mediaUrl: "", mediaPosition: "below" },
    ],
    checkColor: "#22c55e",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    listPosition: "left",
    alignment: "left",
  },
  feature_grid: {
    headline: "Why Choose Us",
    features: [
      { id: nanoid(4), icon: "book", title: "Comprehensive Content", description: "Everything you need to succeed" },
      { id: nanoid(4), icon: "users", title: "Community Support", description: "Learn alongside thousands of students" },
      { id: nanoid(4), icon: "award", title: "Certification", description: "Earn recognized certificates" },
      { id: nanoid(4), icon: "clock", title: "Lifetime Access", description: "Learn at your own pace, forever" },
    ],
    iconColor: "#189aa1",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    columns: 2,
  },
  faq: {
    headline: "Frequently Asked Questions",
    items: [
      { id: nanoid(4), question: "What format are the files?", answer: "PDF format, ready to print." },
      { id: nanoid(4), question: "How do I access the content?", answer: "You'll receive instant access after purchase." },
    ],
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
  },
  embed_html: {
    headline: "",
    embedCode: "",
    maxWidth: "800",
    backgroundColor: "#ffffff",
  },
  columns: {
    layout: "50-50",
    gap: 24,
    leftContent: "",
    rightContent: "",
    backgroundColor: "#ffffff",
    paddingY: 40,
  },
};

// ─── Block Library ──────────────────────────────────────────────────────────────────────

const BLOCK_LIBRARY: { type: BlockType; label: string; icon: React.ComponentType<any>; description: string }[] = [
  { type: "banner", label: "Banner / Hero", icon: Layout, description: "Full-width hero with headline and CTA" },
  { type: "text_media", label: "Text & Media", icon: AlignLeft, description: "Text alongside an image" },
  { type: "image", label: "Image Block", icon: Image, description: "Single image or gallery" },
  { type: "cta", label: "Call to Action", icon: MousePointer, description: "Centered headline with button" },
  { type: "course_outline", label: "Course Outline", icon: BookOpen, description: "Display course curriculum" },
  { type: "video", label: "Video", icon: Video, description: "Embed YouTube, Vimeo, or upload" },
  { type: "testimonials", label: "Testimonials", icon: Star, description: "Student quote cards" },
  { type: "pricing", label: "Pricing", icon: DollarSign, description: "Course pricing options" },
  { type: "checklist", label: "Checklist", icon: CheckSquare, description: "Feature list with icons" },
  { type: "html", label: "HTML Block", icon: Code, description: "Raw HTML / custom code" },
  { type: "spacer", label: "Spacer", icon: Type, description: "Vertical whitespace" },
  { type: "divider", label: "Divider", icon: Type, description: "Horizontal rule" },
  { type: "bg_section", label: "Background Image Section", icon: Image, description: "Full-width section with background image and text overlay" },
  { type: "button", label: "Button", icon: MousePointer, description: "Standalone styled button with link" },
  { type: "icon_list", label: "Icon List", icon: AlignLeft, description: "Pre-formatted list with custom icons" },
  { type: "numbered_steps", label: "Numbered Steps", icon: Type, description: "Ordered steps with styled numbers" },
  { type: "checklist_steps", label: "Checklist Steps", icon: CheckSquare, description: "Checkmark steps with optional text & media" },
  { type: "feature_grid", label: "Feature Grid", icon: Layout, description: "Grid of feature cards with icons" },
];

// ─── Block Preview Renderers ──────────────────────────────────────────────────

function BannerPreview({ data }: { data: Record<string, any> }) {
  const isVideo = data.backgroundType === "video" && data.backgroundVideoUrl;
  const bg = data.backgroundType === "gradient"
    ? { background: `linear-gradient(${data.gradientDirection || "to bottom right"}, ${data.gradientFrom || "#1e293b"}, ${data.gradientTo || "#189aa1"})` }
    : data.backgroundType === "image" && data.backgroundImageUrl
    ? { backgroundImage: `url(${data.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : isVideo ? { backgroundColor: "#000" }
    : { backgroundColor: data.backgroundColor || "#1e293b" };
  const heights: Record<string, string> = { small: "160px", medium: "240px", large: "360px" };
  const hasInlineMedia = data.inlineMediaUrl && data.inlineMediaType;
  const h1Color = data.headlineColor || data.textColor || "#fff";
  const h2Color = data.headline2Color || data.textColor || "#fff";
  return (
    <div style={{ ...bg, minHeight: heights[data.height] || "240px", position: "relative", display: "flex", alignItems: "center", justifyContent: data.alignment === "left" ? "flex-start" : data.alignment === "right" ? "flex-end" : "center" }}>
      {isVideo && (
        <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} src={data.backgroundVideoUrl} />
      )}
      {(data.backgroundType === "image" || isVideo) && data.overlay !== false && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${data.overlayOpacity ?? 0.5})`, zIndex: 1 }} />
      )}
      <div className="animate-fade-in-up" style={{ position: "relative", zIndex: 2, textAlign: hasInlineMedia && data.inlineMediaPosition !== "center" ? "left" : (data.alignment || "center"), padding: "40px 60px", maxWidth: hasInlineMedia ? "1100px" : "800px", width: "100%", display: hasInlineMedia ? "flex" : "block", alignItems: "center", gap: "40px", flexDirection: data.inlineMediaPosition === "left" ? "row-reverse" : "row" }}>
        <div style={{ flex: hasInlineMedia ? 1 : undefined }}>
          <h1 style={{ color: h1Color, fontSize: "2.5rem", fontWeight: 700, margin: data.headline2 ? "0 0 4px" : "0 0 16px" }}>{data.headline}</h1>
          {data.headline2 && <h1 style={{ color: h2Color, fontSize: "2.5rem", fontWeight: 700, margin: "0 0 16px" }}>{data.headline2}</h1>}
          {data.subtext && <p style={{ color: data.textColor || "#fff", fontSize: "1.125rem", margin: "0 0 24px", opacity: 0.9 }}>{data.subtext}</p>}
          <div style={{ display: "flex", gap: "12px", justifyContent: data.alignment === "center" && !hasInlineMedia ? "center" : "flex-start", flexWrap: "wrap" }}>
            {data.ctaText && <a href={data.ctaUrl || "#"} style={{ backgroundColor: data.ctaBgColor || "#189aa1", color: data.ctaTextColor || "#fff", padding: "12px 28px", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "1rem" }}>{data.ctaText}</a>}
            {data.ctaSecondaryText && <a href={data.ctaSecondaryUrl || "#"} style={{ backgroundColor: data.ctaSecondaryBgColor || "transparent", color: data.ctaSecondaryTextColor || data.textColor || "#fff", padding: "12px 28px", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "1rem", border: `2px solid ${data.ctaSecondaryBgColor || data.textColor || "#fff"}` }}>{data.ctaSecondaryText}</a>}
            {data.previewPageUrl && <a href={data.previewPageUrl} style={{ backgroundColor: "transparent", color: data.textColor || "#fff", padding: "12px 28px", borderRadius: "8px", textDecoration: "none", fontWeight: 500, fontSize: "0.95rem", border: "1.5px solid rgba(255,255,255,0.5)", opacity: 0.85 }}>Preview</a>}
          </div>
        </div>
        {hasInlineMedia && (
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            {data.inlineMediaType.startsWith("video") ? (
              <video autoPlay muted loop playsInline style={{ maxWidth: "100%", maxHeight: "320px", borderRadius: "12px" }} src={data.inlineMediaUrl} />
            ) : (
              <img src={data.inlineMediaUrl} alt="" style={{ maxWidth: "100%", maxHeight: "320px", borderRadius: "12px", objectFit: "cover" }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TextMediaPreview({ data }: { data: Record<string, any> }) {
  const isRight = data.imagePosition === "right";
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      <div style={{ display: "flex", gap: "48px", alignItems: "center", flexDirection: isRight ? "row" : "row-reverse", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ flex: 1 }}>
          {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, marginBottom: "16px" }}>{data.headline}</h2>}
          {data.body && <p style={{ color: data.textColor || "#1e293b", lineHeight: 1.7, opacity: 0.85 }}>{data.body}</p>}
          {data.ctaText && <a href={data.ctaUrl || "#"} style={{ display: "inline-block", marginTop: "24px", backgroundColor: "#189aa1", color: "#fff", padding: "10px 24px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 }}>{data.ctaText}</a>}
        </div>
        <div style={{ flex: 1 }}>
          {data.imageUrl ? (
            <img src={data.imageUrl} alt={data.imageAlt || ""} style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: "#e2e8f0", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Image size={48} color="#94a3b8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ data }: { data: Record<string, any> }) {
  const widths: Record<string, string> = { full: "100%", wide: "80%", medium: "60%", small: "40%" };
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "40px 20px", textAlign: data.alignment || "center" }}>
      <div style={{ display: "inline-block", width: widths[data.width] || "100%", maxWidth: "100%" }}>
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.imageAlt || ""} style={{ width: "100%", borderRadius: "8px" }} />
        ) : (
          <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: "#e2e8f0", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image size={48} color="#94a3b8" />
          </div>
        )}
        {data.caption && <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "8px" }}>{data.caption}</p>}
      </div>
    </div>
  );
}

function CTAPreview({ data }: { data: Record<string, any> }) {
  const isVideo = data.backgroundType === "video" && data.backgroundVideoUrl;
  const bg = data.backgroundType === "gradient"
    ? { background: `linear-gradient(${data.gradientDirection || "to bottom right"}, ${data.gradientFrom || "#0f172a"}, ${data.gradientTo || "#189aa1"})` }
    : data.backgroundType === "image" && data.backgroundImageUrl
    ? { backgroundImage: `url(${data.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : isVideo ? { backgroundColor: "#000" }
    : { backgroundColor: data.backgroundColor || "#0f172a" };
  const h1Color = data.headlineColor || data.textColor || "#fff";
  const h2Color = data.headline2Color || data.textColor || "#fff";
  return (
    <div style={{ ...bg, padding: "80px 40px", textAlign: data.alignment || "center", position: "relative" }}>
      {isVideo && (
        <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} src={data.backgroundVideoUrl} />
      )}
      {(data.backgroundType === "image" || isVideo) && data.overlay !== false && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${data.overlayOpacity ?? 0.5})`, zIndex: 1 }} />
      )}
      <div className="animate-fade-in-up" style={{ position: "relative", zIndex: 2 }}>
        <h2 style={{ color: h1Color, fontSize: "2rem", fontWeight: 700, marginBottom: data.headline2 ? "4px" : "12px" }}>{data.headline}</h2>
        {data.headline2 && <h2 style={{ color: h2Color, fontSize: "2rem", fontWeight: 700, marginBottom: "12px" }}>{data.headline2}</h2>}
        {data.subtext && <p style={{ color: data.textColor || "#fff", opacity: 0.8, marginBottom: "32px", fontSize: "1.125rem" }}>{data.subtext}</p>}
        {data.ctaText && <a href={data.ctaUrl || "#"} style={{ backgroundColor: data.ctaBgColor || "#189aa1", color: data.ctaTextColor || "#fff", padding: "14px 36px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, fontSize: "1.125rem" }}>{data.ctaText}</a>}
      </div>
    </div>
  );
}

function VideoPreview({ data }: { data: Record<string, any> }) {
  const getEmbedUrl = (url: string, type: string) => {
    if (!url) return "";
    if (type === "youtube") {
      const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
      return match ? `https://www.youtube.com/embed/${match[1]}` : url;
    }
    if (type === "vimeo") {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : url;
    }
    return url;
  };
  const embedUrl = getEmbedUrl(data.videoUrl, data.videoType);
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#000", padding: "40px 20px", textAlign: "center" }}>
      {data.headline && <h2 style={{ color: "#fff", marginBottom: "24px", fontSize: "1.5rem", fontWeight: 700 }}>{data.headline}</h2>}
      <div style={{ maxWidth: `${data.maxWidth || 800}px`, margin: "0 auto", aspectRatio: "16/9", backgroundColor: "#1e293b", borderRadius: "8px", overflow: "hidden" }}>
        {embedUrl ? (
          <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="Video" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Video size={64} color="#475569" />
          </div>
        )}
      </div>
    </div>
  );
}

function TestimonialsPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#f8fafc", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }}>{data.headline}</h2>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", maxWidth: "1100px", margin: "0 auto" }}>
        {(data.testimonials || []).map((t: any) => (
          <div key={t.id} style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <p style={{ color: "#475569", lineHeight: 1.7, marginBottom: "20px", fontStyle: "italic" }}>"{t.quote}"</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {t.avatarUrl ? (
                <img src={t.avatarUrl} alt={t.author} style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#189aa1", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{t.author?.[0] || "?"}</div>
              )}
              <div>
                <div style={{ fontWeight: 600, color: data.textColor || "#1e293b" }}>{t.author}</div>
                {t.role && <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{t.role}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>{data.headline}</h2>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.columns || 2}, 1fr)`, gap: "16px", maxWidth: "900px", margin: "0 auto" }}>
        {(data.items || []).map((item: any) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: data.iconColor || "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span style={{ color: data.textColor || "#1e293b", lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HtmlPreview({ data }: { data: Record<string, any> }) {
  const html = data.html || "";
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:sans-serif;background:${data.backgroundColor || "#fff"};}</style></head><body>${html}</body></html>`;
  if (!html.trim()) {
    return (
      <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "20px", minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
        HTML block — add code in the editor
      </div>
    );
  }
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff" }}>
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        style={{ width: "100%", border: "none", minHeight: "80px" }}
        onLoad={(e) => {
          const iframe = e.currentTarget;
          try {
            const h = iframe.contentWindow?.document?.body?.scrollHeight;
            if (h) iframe.style.height = h + "px";
          } catch {}
        }}
        title="HTML Preview"
      />
    </div>
  );
}

function SpacerPreview({ data }: { data: Record<string, any> }) {
  return <div style={{ height: `${data.height || 60}px`, backgroundColor: data.backgroundColor || "#fff" }} />;
}

function DividerPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: `${data.margin || 40}px 40px` }}>
      <hr style={{ border: "none", borderTop: `${data.thickness || 1}px ${data.style || "solid"} ${data.color || "#e2e8f0"}` }} />
    </div>
  );
}

function CourseOutlinePreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#f8fafc", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {data.courseId ? (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "24px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
            Course curriculum will appear here (Course ID: {data.courseId})
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "40px", border: "2px dashed #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
            <BookOpen size={40} style={{ margin: "0 auto 12px" }} />
            <p>Select a course in the settings panel to display its curriculum</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PricingPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {data.courseId ? (
          <div style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "24px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>
            Pricing options will appear here (Course ID: {data.courseId})
          </div>
        ) : (
          <div style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "40px", border: "2px dashed #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
            <DollarSign size={40} style={{ margin: "0 auto 12px" }} />
            <p>Select a course in the settings panel to display its pricing</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Block Previews ───────────────────────────────────────────────────────

function BgSectionPreview({ data }: { data: Record<string, any> }) {
  const bg = data.backgroundImageUrl
    ? { backgroundImage: `url(${data.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: "#334155" };
  return (
    <div style={{ ...bg, position: "relative", padding: `${data.paddingY || 80}px 60px`, textAlign: data.alignment || "center" }}>
      {data.overlay && data.backgroundImageUrl && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${data.overlayOpacity || 0.6})` }} />
      )}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto" }}>
        {data.headline && <h2 style={{ color: data.textColor || "#fff", fontSize: "2rem", fontWeight: 700, marginBottom: "16px" }}>{data.headline}</h2>}
        {data.body && <p style={{ color: data.textColor || "#fff", fontSize: "1.125rem", lineHeight: 1.7, opacity: 0.9 }}>{data.body}</p>}
      </div>
    </div>
  );
}

function ButtonPreview({ data }: { data: Record<string, any> }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: "#189aa1", color: "#fff", border: "none" },
    secondary: { backgroundColor: "#e2e8f0", color: "#1e293b", border: "none" },
    outline: { backgroundColor: "transparent", color: "#189aa1", border: "2px solid #189aa1" },
    ghost: { backgroundColor: "transparent", color: "#189aa1", border: "none" },
  };
  const sizes: Record<string, React.CSSProperties> = {
    small: { padding: "8px 20px", fontSize: "0.875rem" },
    medium: { padding: "12px 28px", fontSize: "1rem" },
    large: { padding: "16px 40px", fontSize: "1.125rem" },
  };
  const align = data.alignment === "left" ? "flex-start" : data.alignment === "right" ? "flex-end" : "center";
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "40px", display: "flex", justifyContent: align }}>
      <a href={data.url || "#"} style={{ ...styles[data.variant || "primary"], ...sizes[data.size || "medium"], borderRadius: "8px", textDecoration: "none", fontWeight: 600, display: "inline-block", cursor: "pointer" }}>
        {data.text || "Button"}
      </a>
    </div>
  );
}

// ICON_SVG removed — now using LucideIcon component directly

// Helper to render the icon/image/none for a feature card or list item
function BlockIcon({ iconType, iconName, imageUrl, size = 24, bgColor = "#189aa1" }: {
  iconType?: string; iconName?: string; imageUrl?: string; size?: number; bgColor?: string;
}) {
  const boxSize = size * 2;
  if (iconType === "none" || (!iconType && !iconName && !imageUrl)) return null;
  if (iconType === "image" || (iconType !== "icon" && imageUrl)) {
    return (
      <div style={{ width: boxSize, height: boxSize, borderRadius: "10px", overflow: "hidden", marginBottom: "16px", flexShrink: 0 }}>
        {imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", backgroundColor: "#e2e8f0" }} />}
      </div>
    );
  }
  // icon (default)
  return (
    <div style={{ width: boxSize, height: boxSize, borderRadius: "10px", backgroundColor: bgColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", flexShrink: 0 }}>
      <LucideIcon name={iconName || "Star"} size={size} color="#fff" />
    </div>
  );
}

function IconListPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>{data.headline}</h2>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.columns || 1}, 1fr)`, gap: "20px", maxWidth: "900px", margin: "0 auto" }}>
        {(data.items || []).map((item: any) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            {item.iconType !== "none" && (
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: item.iconType === "image" ? "transparent" : (data.iconColor || "#189aa1"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                {item.iconType === "image" && item.imageUrl
                  ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <LucideIcon name={item.icon || "Check"} size={18} color="#fff" />
                }
              </div>
            )}
            <span style={{ color: data.textColor || "#1e293b", lineHeight: 1.6, paddingTop: "6px" }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepMediaItem({ step, textColor }: { step: any; textColor: string }) {
  const media = step.mediaType !== "none" && step.mediaUrl ? (
    step.mediaType === "video"
      ? <video src={step.mediaUrl} style={{ width: "100%", borderRadius: "8px", maxHeight: "200px", objectFit: "cover" }} muted />
      : <img src={step.mediaUrl} alt="" style={{ width: "100%", borderRadius: "8px", maxHeight: "200px", objectFit: "cover" }} />
  ) : null;
  const hasText = step.description && step.description.trim();
  return (
    <div style={{ flex: 1 }}>
      {media && step.mediaPosition === "above" && <div style={{ marginBottom: "10px" }}>{media}</div>}
      {step.mediaType !== "replace" && (
        <>
          <h3 style={{ color: textColor, fontWeight: 700, fontSize: "1.0625rem", marginBottom: "4px" }}>{step.title}</h3>
          {hasText && <p style={{ color: textColor, opacity: 0.75, lineHeight: 1.6, fontSize: "0.9375rem" }}>{step.description}</p>}
        </>
      )}
      {step.mediaType === "replace" && media}
      {media && step.mediaPosition === "below" && <div style={{ marginTop: "10px" }}>{media}</div>}
    </div>
  );
}

function NumberedStepsPreview({ data }: { data: Record<string, any> }) {
  const tc = data.textColor || "#1e293b";
  const nc = data.numberColor || "#189aa1";
  const layout = data.layout || "left";
  const centered = layout === "center";
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#f8fafc", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: tc, fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", alignItems: centered ? "center" : "stretch" }}>
        {(data.steps || []).map((step: any, i: number) => (
          <div key={step.id} style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexDirection: layout === "right" ? "row-reverse" : "row", textAlign: centered ? "center" : "left" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: nc, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1.25rem", flexShrink: 0 }}>{i + 1}</div>
            <StepMediaItem step={step} textColor={tc} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistStepsPreview({ data }: { data: Record<string, any> }) {
  const tc = data.textColor || "#1e293b";
  const cc = data.checkColor || "#22c55e";
  const layout = data.layout || "left";
  const centered = layout === "center";
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#ffffff", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: tc, fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", alignItems: centered ? "center" : "stretch" }}>
        {(data.steps || []).map((step: any) => (
          <div key={step.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexDirection: layout === "right" ? "row-reverse" : "row", textAlign: centered ? "center" : "left" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: cc, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <StepMediaItem step={step} textColor={tc} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureGridPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }}>{data.headline}</h2>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.columns || 2}, 1fr)`, gap: "24px", maxWidth: "1000px", margin: "0 auto" }}>
        {(data.features || []).map((f: any) => (
          <div key={f.id} style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "28px", border: "1px solid #e2e8f0" }}>
            {f.iconType !== "none" && (
              <div style={{ width: "48px", height: "48px", borderRadius: "10px", backgroundColor: f.iconType === "image" ? "transparent" : (data.iconColor || "#189aa1"), display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", overflow: "hidden" }}>
                {f.iconType === "image" && f.imageUrl
                  ? <img src={f.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <LucideIcon name={f.icon || "Star"} size={24} color="#fff" />
                }
              </div>
            )}
            <h3 style={{ color: data.textColor || "#1e293b", fontWeight: 700, fontSize: "1.0625rem", marginBottom: "8px" }}>{f.title}</h3>
            <p style={{ color: data.textColor || "#1e293b", opacity: 0.75, lineHeight: 1.6, fontSize: "0.9375rem" }}>{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function renderBlockPreview(block: Block) {
  const safeData = block.data ?? {};
  switch (block.type) {
    case "banner": return <BannerPreview data={safeData} />;
    case "text_media": return <TextMediaPreview data={safeData} />;
    case "image": return <ImagePreview data={safeData} />;
    case "cta": return <CTAPreview data={safeData} />;
    case "course_outline": return <CourseOutlinePreview data={safeData} />;
    case "video": return <VideoPreview data={safeData} />;
    case "testimonials": return <TestimonialsPreview data={safeData} />;
    case "pricing": return <PricingPreview data={safeData} />;
    case "checklist": return <ChecklistPreview data={safeData} />;
    case "html": return <HtmlPreview data={safeData} />;
    case "spacer": return <SpacerPreview data={safeData} />;
    case "divider": return <DividerPreview data={safeData} />;
    case "bg_section": return <BgSectionPreview data={safeData} />;
    case "button": return <ButtonPreview data={safeData} />;
    case "icon_list": return <IconListPreview data={safeData} />;
    case "numbered_steps": return <NumberedStepsPreview data={safeData} />;
    case "checklist_steps": return <ChecklistStepsPreview data={safeData} />;
    case "feature_grid": return <FeatureGridPreview data={safeData} />;
    case "faq": return <FAQPreview data={safeData} />;
    case "embed_html": return <EmbedHtmlPreviewBlock data={safeData} />;
    case "columns": return <ColumnsPreview data={safeData} />;
    default: return null;
  }
}

// FAQ Preview (public renderer)
function FAQPreview({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 24px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {(data.items || []).map((item: any) => (
          <details key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px" }}>
            <summary style={{ color: data.textColor || "#1e293b", fontWeight: 600, fontSize: "1rem", cursor: "pointer" }}>{item.question}</summary>
            <p style={{ color: data.textColor || "#1e293b", opacity: 0.75, lineHeight: "1.6", fontSize: "0.9375rem", marginTop: "12px" }}>{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

// Embed HTML Preview (public renderer)
function EmbedHtmlPreviewBlock({ data }: { data: Record<string, any> }) {
  const code = data.embedCode || "";
  const maxW = data.maxWidth || "800";
  if (!code.trim()) return null;
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "40px 24px" }}>
      <div style={{ maxWidth: `${maxW}px`, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: code }} />
    </div>
  );
}

// Columns Preview (public renderer)
function ColumnsPreview({ data }: { data: Record<string, any> }) {
  const layout = data.layout || "50-50";
  const gap = data.gap || 24;
  const gridCols = layout === "33-67" ? "1fr 2fr" : layout === "67-33" ? "2fr 1fr" : layout === "25-75" ? "1fr 3fr" : layout === "75-25" ? "3fr 1fr" : "1fr 1fr";
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: `${data.paddingY || 40}px 24px` }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: `${gap}px`, maxWidth: "1100px", margin: "0 auto" }}>
        {data.leftContent && <div dangerouslySetInnerHTML={{ __html: data.leftContent }} />}
        {data.rightContent && <div dangerouslySetInnerHTML={{ __html: data.rightContent }} />}
        {!data.leftContent && !data.rightContent && (
          <>
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", border: "1px dashed #e2e8f0", borderRadius: "8px" }}>Left column</div>
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", border: "1px dashed #e2e8f0", borderRadius: "8px" }}>Right column</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Block Settings Field Components (hoisted outside BlockSettings to prevent remount) ─

type FieldProps = { d: Record<string, any>; set: (key: string, val: any) => void };

function ColorField({ label, field, d, set }: FieldProps & { label: string; field: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={d[field] || "#ffffff"}
          onChange={e => set(field, e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border"
        />
        <Input
          value={d[field] || ""}
          onChange={e => set(field, e.target.value)}
          className="h-8 text-xs font-mono"
          placeholder="#ffffff"
        />
      </div>
    </div>
  );
}

function TextField({ label, field, d, set, multiline = false, placeholder = "" }: FieldProps & { label: string; field: string; multiline?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {multiline
        ? <Textarea value={d[field] || ""} onChange={e => set(field, e.target.value)} className="text-xs min-h-[80px]" placeholder={placeholder} />
        : <Input value={d[field] || ""} onChange={e => set(field, e.target.value)} className="h-8 text-xs" placeholder={placeholder} />
      }
    </div>
  );
}

function SelectField({ label, field, d, set, options }: FieldProps & { label: string; field: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select value={d[field] || ""} onChange={e => set(field, e.target.value)} className="w-full h-8 text-xs border rounded px-2 bg-background">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberField({ label, field, d, set, min = 0, max = 9999 }: FieldProps & { label: string; field: string; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={d[field] ?? 0} onChange={e => set(field, Number(e.target.value))} className="h-8 text-xs" min={min} max={max} />
    </div>
  );
}

function CourseSelect({ field, d, set, courses }: FieldProps & { field: string; courses: { id: number; title: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Course</Label>
      <select value={d[field] ?? ""} onChange={e => set(field, e.target.value ? Number(e.target.value) : null)} className="w-full h-8 text-xs border rounded px-2 bg-background">
        <option value="">— Select a course —</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
    </div>
  );
}

// Icon picker — shows a searchable grid of Lucide icons
function IconPickerField({ label, field, obj, onUpdate }: { label: string; field: string; obj: Record<string, any>; onUpdate: (updated: Record<string, any>) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()));
  const current = obj[field] || "Star";
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center">
          <LucideIcon name={current} size={16} color="currentColor" />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(v => !v)}>
          {open ? "Close" : "Change Icon"}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onUpdate({ ...obj, [field]: "none", iconType: "none" })}>
          None
        </Button>
      </div>
      {open && (
        <div className="border rounded p-2 space-y-2 bg-background">
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search icons..." className="h-7 text-xs" />
          <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
            {filtered.map(name => (
              <button
                key={name}
                title={name}
                onClick={() => { onUpdate({ ...obj, [field]: name, iconType: "icon" }); setOpen(false); }}
                className={`w-8 h-8 rounded flex items-center justify-center hover:bg-accent transition-colors ${current === name ? "bg-primary/20 ring-1 ring-primary" : ""}`}
              >
                <LucideIcon name={name} size={14} color="currentColor" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Media upload field — uploads to /api/media-upload and returns a URL
function MediaUploadField({ label, urlField, typeField, d, set, orgId }: FieldProps & { label: string; urlField: string; typeField?: string; orgId?: number }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (orgId) fd.append("orgId", String(orgId));
      fd.append("folder", "page-builder");
      const res = await fetch("/api/media-upload", { method: "POST", body: fd, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        set(urlField, data.url);
        if (typeField) set(typeField, file.type.startsWith("video") ? "video" : "image");
      }
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <Input value={d[urlField] || ""} onChange={e => set(urlField, e.target.value)} className="h-8 text-xs flex-1" placeholder="https://..." />
        <label className="cursor-pointer">
          <input type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Button variant="outline" size="icon" className="h-8 w-8" asChild={false} disabled={uploading} title="Upload file">
            {uploading ? <span className="text-[10px]">...</span> : <Upload size={13} />}
          </Button>
        </label>
        {d[urlField] && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => set(urlField, "")} title="Clear">
            <X size={13} />
          </Button>
        )}
      </div>
      {d[urlField] && (
        <div className="mt-1 rounded overflow-hidden border" style={{ maxHeight: "80px" }}>
          {(d[typeField || ""] === "video" || d[urlField]?.match(/\.(mp4|webm|ogg)$/i))
            ? <video src={d[urlField]} className="w-full h-20 object-cover" muted />
            : <img src={d[urlField]} alt="" className="w-full h-20 object-cover" />}
        </div>
      )}
    </div>
  );
}

// Icon picker — shows a searchable grid of Lucide icons
// ─── Block Settings Panel ─────────────────────────────────────────────────────

function BlockSettings({ block, onChange, courses, orgId }: {
  block: Block;
  onChange: (data: Record<string, any>) => void;
  courses: { id: number; title: string }[];
  orgId?: number;
}) {
  const d = block.data;
  const set = (key: string, val: any) => onChange({ ...d, [key]: val });

  switch (block.type) {
    case "banner":
      return (
        <div className="space-y-3">
          <TextField label="Headline Line 1" field="headline" d={d} set={set} />
          <TextField label="Headline Line 2" field="headline2" d={d} set={set} />
          <TextField label="Subtext" field="subtext" multiline d={d} set={set} />
          <TextField label="Primary CTA Text" field="ctaText" d={d} set={set} />
          <TextField label="Primary CTA URL" field="ctaUrl" d={d} set={set} />
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Primary Button BG" field="ctaBgColor" d={d} set={set} />
            <ColorField label="Primary Button Text" field="ctaTextColor" d={d} set={set} />
          </div>
          <TextField label="Secondary CTA Text" field="ctaSecondaryText" d={d} set={set} />
          <TextField label="Secondary CTA URL" field="ctaSecondaryUrl" d={d} set={set} />
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Secondary Button BG" field="ctaSecondaryBgColor" d={d} set={set} />
            <ColorField label="Secondary Button Text" field="ctaSecondaryTextColor" d={d} set={set} />
          </div>
          <Separator />
          <SelectField label="Background Type" field="backgroundType" options={[{ value: "color", label: "Color" }, { value: "image", label: "Image" }, { value: "video", label: "Video" }]} d={d} set={set} />
          {d.backgroundType === "image" ? (
            <MediaUploadField label="Background Image" urlField="backgroundImageUrl" d={d} set={set} orgId={orgId} />
          ) : d.backgroundType === "video" ? (
            <MediaUploadField label="Background Video" urlField="backgroundVideoUrl" typeField="backgroundType" d={d} set={set} orgId={orgId} />
          ) : (
            <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          )}
          {(d.backgroundType === "image" || d.backgroundType === "video") && (
            <div className="space-y-1">
              <Label className="text-xs">Overlay Opacity</Label>
              <input type="range" min={0} max={1} step={0.05} value={d.overlayOpacity ?? 0.5} onChange={e => set("overlayOpacity", Number(e.target.value))} className="w-full" />
              <span className="text-xs text-muted-foreground">{Math.round((d.overlayOpacity ?? 0.5) * 100)}%</span>
            </div>
          )}
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
          <SelectField label="Height" field="height" options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} d={d} set={set} />
          <SelectField label="Alignment" field="alignment" options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} d={d} set={set} />
          <Separator />
          <TextField label="Preview Page URL (optional)" field="previewPageUrl" placeholder="https://..." d={d} set={set} />
        </div>
      );
    case "text_media":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <TextField label="Body Text" field="body" multiline d={d} set={set} />
          <TextField label="Image URL" field="imageUrl" placeholder="https://..." d={d} set={set} />
          <TextField label="Image Alt Text" field="imageAlt" d={d} set={set} />
          <SelectField label="Image Position" field="imagePosition" options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} d={d} set={set} />
          <TextField label="CTA Button Text" field="ctaText" d={d} set={set} />
          <TextField label="CTA Button URL" field="ctaUrl" d={d} set={set} />
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <TextField label="Image URL" field="imageUrl" placeholder="https://..." d={d} set={set} />
          <TextField label="Alt Text" field="imageAlt" d={d} set={set} />
          <TextField label="Caption" field="caption" d={d} set={set} />
          <TextField label="Link URL" field="linkUrl" placeholder="https://..." d={d} set={set} />
          <SelectField label="Width" field="width" options={[{ value: "full", label: "Full" }, { value: "wide", label: "Wide (80%)" }, { value: "medium", label: "Medium (60%)" }, { value: "small", label: "Small (40%)" }]} d={d} set={set} />
          <SelectField label="Alignment" field="alignment" options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} d={d} set={set} />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
        </div>
      );
    case "cta":
      return (
        <div className="space-y-3">
          <TextField label="Headline Line 1" field="headline" d={d} set={set} />
          <TextField label="Headline Line 2" field="headline2" d={d} set={set} />
          <TextField label="Subtext" field="subtext" d={d} set={set} />
          <TextField label="Button Text" field="ctaText" d={d} set={set} />
          <TextField label="Button URL" field="ctaUrl" d={d} set={set} />
          <SelectField label="Alignment" field="alignment" options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} d={d} set={set} />
          <Separator />
          <SelectField label="Background Type" field="backgroundType" options={[{ value: "color", label: "Color" }, { value: "image", label: "Image" }, { value: "video", label: "Video" }]} d={d} set={set} />
          {d.backgroundType === "image" ? (
            <MediaUploadField label="Background Image" urlField="backgroundImageUrl" d={d} set={set} orgId={orgId} />
          ) : d.backgroundType === "video" ? (
            <MediaUploadField label="Background Video" urlField="backgroundVideoUrl" d={d} set={set} orgId={orgId} />
          ) : (
            <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          )}
          {(d.backgroundType === "image" || d.backgroundType === "video") && (
            <div className="space-y-1">
              <Label className="text-xs">Overlay Opacity</Label>
              <input type="range" min={0} max={1} step={0.05} value={d.overlayOpacity ?? 0.5} onChange={e => set("overlayOpacity", Number(e.target.value))} className="w-full" />
              <span className="text-xs text-muted-foreground">{Math.round((d.overlayOpacity ?? 0.5) * 100)}%</span>
            </div>
          )}
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "course_outline":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <CourseSelect field="courseId" d={d} set={set} courses={courses} />
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Lesson Count</Label>
            <Switch checked={d.showLessonCount} onCheckedChange={v => set("showLessonCount", v)} />
          </div>
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "video":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <SelectField label="Video Type" field="videoType" options={[{ value: "youtube", label: "YouTube" }, { value: "vimeo", label: "Vimeo" }, { value: "direct", label: "Direct URL" }]} d={d} set={set} />
          <TextField label="Video URL" field="videoUrl" placeholder="https://youtube.com/watch?v=..." d={d} set={set} />
          <NumberField label="Max Width (px)" field="maxWidth" min={200} max={1400} d={d} set={set} />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
        </div>
      );
    case "testimonials":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <Separator />
          <Label className="text-xs font-semibold">Testimonials</Label>
          {(d.testimonials || []).map((t: any, i: number) => (
            <div key={t.id} className="border rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Testimonial {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => set("testimonials", d.testimonials.filter((_: any, j: number) => j !== i))}>
                  <Trash2 size={12} />
                </Button>
              </div>
              <Textarea value={t.quote} onChange={e => set("testimonials", d.testimonials.map((x: any, j: number) => j === i ? { ...x, quote: e.target.value } : x))} className="text-xs min-h-[60px]" placeholder="Quote..." />
              <Input value={t.author} onChange={e => set("testimonials", d.testimonials.map((x: any, j: number) => j === i ? { ...x, author: e.target.value } : x))} className="h-7 text-xs" placeholder="Author name" />
              <Input value={t.role} onChange={e => set("testimonials", d.testimonials.map((x: any, j: number) => j === i ? { ...x, role: e.target.value } : x))} className="h-7 text-xs" placeholder="Role / Title" />
              <Input value={t.avatarUrl} onChange={e => set("testimonials", d.testimonials.map((x: any, j: number) => j === i ? { ...x, avatarUrl: e.target.value } : x))} className="h-7 text-xs" placeholder="Avatar URL (optional)" />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set("testimonials", [...(d.testimonials || []), { id: nanoid(4), quote: "", author: "", role: "", avatarUrl: "" }])}>
            <Plus size={14} className="mr-1" /> Add Testimonial
          </Button>
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "pricing":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <CourseSelect field="courseId" d={d} set={set} courses={courses} />
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
          <ColorField label="Accent Color" field="accentColor" d={d} set={set} />
        </div>
      );
    case "checklist":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <NumberField label="Columns" field="columns" min={1} max={4} d={d} set={set} />
          <ColorField label="Check Icon Color" field="iconColor" d={d} set={set} />
          <Separator />
          <Label className="text-xs font-semibold">Items</Label>
          {(d.items || []).map((item: any, i: number) => (
            <div key={item.id} className="flex gap-2 items-center">
              <Input value={item.text} onChange={e => set("items", d.items.map((x: any, j: number) => j === i ? { ...x, text: e.target.value } : x))} className="h-7 text-xs flex-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => set("items", d.items.filter((_: any, j: number) => j !== i))}>
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set("items", [...(d.items || []), { id: nanoid(4), text: "New item" }])}>
            <Plus size={14} className="mr-1" /> Add Item
          </Button>
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "html":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">HTML / CSS / JavaScript</Label>
            <Textarea value={d.html || ""} onChange={e => set("html", e.target.value)} className="text-xs min-h-[200px] font-mono" placeholder="<div>Your HTML here</div>" />
          </div>
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-3">
          <NumberField label="Height (px)" field="height" min={10} max={400} d={d} set={set} />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
        </div>
      );
    case "divider":
      return (
        <div className="space-y-3">
          <SelectField label="Style" field="style" options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} d={d} set={set} />
          <ColorField label="Line Color" field="color" d={d} set={set} />
          <NumberField label="Thickness (px)" field="thickness" min={1} max={10} d={d} set={set} />
          <NumberField label="Margin (px)" field="margin" min={0} max={200} d={d} set={set} />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
        </div>
      );
    case "bg_section":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <TextField label="Body Text" field="body" multiline d={d} set={set} />
          <TextField label="Background Image URL" field="backgroundImageUrl" placeholder="https://..." d={d} set={set} />
          <div className="flex items-center gap-2">
            <Switch checked={!!d.overlay} onCheckedChange={v => set("overlay", v)} />
            <Label className="text-xs">Dark overlay on image</Label>
          </div>
          {d.overlay && <NumberField label="Overlay Opacity (0-1)" field="overlayOpacity" min={0} max={1} d={d} set={set} />}
          <SelectField label="Text Alignment" field="alignment" options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} d={d} set={set} />
          <NumberField label="Vertical Padding (px)" field="paddingY" min={20} max={300} d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <TextField label="Button Text" field="text" d={d} set={set} />
          <TextField label="URL" field="url" placeholder="https://..." d={d} set={set} />
          <SelectField label="Style" field="variant" options={[
            { value: "primary", label: "Primary (filled)" },
            { value: "secondary", label: "Secondary" },
            { value: "outline", label: "Outline" },
            { value: "ghost", label: "Ghost" },
          ]} d={d} set={set} />
          <SelectField label="Size" field="size" options={[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]} d={d} set={set} />
          <SelectField label="Alignment" field="alignment" options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]} d={d} set={set} />
          <ColorField label="Section Background" field="backgroundColor" d={d} set={set} />
        </div>
      );
    case "icon_list":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <SelectField label="Columns" field="columns" options={[
            { value: "1", label: "1 column" },
            { value: "2", label: "2 columns" },
            { value: "3", label: "3 columns" },
          ]} d={d} set={set} />
          <ColorField label="Icon Color" field="iconColor" d={d} set={set} />
          <Separator />
          <Label className="text-xs font-semibold">List Items</Label>
          {(d.items || []).map((item: any, i: number) => (
            <div key={item.id} className="space-y-2 border rounded p-2">
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <IconPickerField
                    label="Icon"
                    field="icon"
                    obj={item}
                    onUpdate={updated => { const items = [...d.items]; items[i] = updated; set("items", items); }}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive self-end" onClick={() => set("items", d.items.filter((_: any, j: number) => j !== i))}><Trash2 size={12} /></Button>
              </div>
              <Input value={item.text} onChange={e => { const items = [...d.items]; items[i] = { ...item, text: e.target.value }; set("items", items); }} className="h-8 text-xs" placeholder="Item title" />
              <Textarea value={item.description || ""} onChange={e => { const items = [...d.items]; items[i] = { ...item, description: e.target.value }; set("items", items); }} className="text-xs min-h-[48px]" placeholder="Optional description" />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set("items", [...(d.items || []), { id: nanoid(4), icon: "Check", iconType: "icon", text: "New item", description: "" }])}>
            <Plus size={14} className="mr-1" /> Add Item
          </Button>
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "numbered_steps":
    case "checklist_steps":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <SelectField label="Layout" field="layout" options={[
            { value: "left", label: "List on left" },
            { value: "right", label: "List on right" },
            { value: "center", label: "Centered (no side text)" },
          ]} d={d} set={set} />
          {block.type === "numbered_steps"
            ? <ColorField label="Number Color" field="numberColor" d={d} set={set} />
            : <ColorField label="Check Color" field="checkColor" d={d} set={set} />}
          <Separator />
          <Label className="text-xs font-semibold">{block.type === "numbered_steps" ? "Steps" : "Checklist Items"}</Label>
          {(d.steps || []).map((step: any, i: number) => (
            <div key={step.id} className="space-y-2 border rounded p-2">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                <Input value={step.title} onChange={e => { const steps = [...d.steps]; steps[i] = { ...step, title: e.target.value }; set("steps", steps); }} className="h-7 text-xs flex-1" placeholder="Title" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => set("steps", d.steps.filter((_: any, j: number) => j !== i))}><Trash2 size={12} /></Button>
              </div>
              <Textarea value={step.description || ""} onChange={e => { const steps = [...d.steps]; steps[i] = { ...step, description: e.target.value }; set("steps", steps); }} className="text-xs min-h-[48px]" placeholder="Optional description beside the item" />
              <SelectField label="Media" field="mediaType" options={[
                { value: "none", label: "No media" },
                { value: "image", label: "Image" },
                { value: "video", label: "Video" },
              ]} d={step} set={(k, v) => { const steps = [...d.steps]; steps[i] = { ...step, [k]: v }; set("steps", steps); }} />
              {(step.mediaType === "image" || step.mediaType === "video") && (
                <>
                  <MediaUploadField label={step.mediaType === "video" ? "Video URL" : "Image URL"} urlField="mediaUrl" typeField="mediaType" d={step} set={(k, v) => { const steps = [...d.steps]; steps[i] = { ...step, [k]: v }; set("steps", steps); }} />
                  <SelectField label="Media Position" field="mediaPosition" options={[
                    { value: "above", label: "Above text" },
                    { value: "below", label: "Below text" },
                    { value: "replace", label: "Replace text" },
                  ]} d={step} set={(k, v) => { const steps = [...d.steps]; steps[i] = { ...step, [k]: v }; set("steps", steps); }} />
                </>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set("steps", [...(d.steps || []), { id: nanoid(4), title: "New Item", description: "", mediaType: "none" }])}>
            <Plus size={14} className="mr-1" /> Add {block.type === "numbered_steps" ? "Step" : "Item"}
          </Button>
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    case "feature_grid":
      return (
        <div className="space-y-3">
          <TextField label="Headline" field="headline" d={d} set={set} />
          <SelectField label="Columns" field="columns" options={[
            { value: "2", label: "2 columns" },
            { value: "3", label: "3 columns" },
            { value: "4", label: "4 columns" },
          ]} d={d} set={set} />
          <ColorField label="Icon Color" field="iconColor" d={d} set={set} />
          <Separator />
          <Label className="text-xs font-semibold">Features</Label>
          {(d.features || []).map((f: any, i: number) => (
            <div key={f.id} className="space-y-2 border rounded p-2">
              <div className="flex items-start gap-1">
                <div className="flex-1">
                  <IconPickerField
                    label="Icon"
                    field="icon"
                    obj={f}
                    onUpdate={updated => { const features = [...d.features]; features[i] = updated; set("features", features); }}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive self-end" onClick={() => set("features", d.features.filter((_: any, j: number) => j !== i))}><Trash2 size={12} /></Button>
              </div>
              <Input value={f.title} onChange={e => { const features = [...d.features]; features[i] = { ...f, title: e.target.value }; set("features", features); }} className="h-7 text-xs" placeholder="Feature title" />
              <Textarea value={f.description || ""} onChange={e => { const features = [...d.features]; features[i] = { ...f, description: e.target.value }; set("features", features); }} className="text-xs min-h-[48px]" placeholder="Short description" />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set("features", [...(d.features || []), { id: nanoid(4), icon: "Star", iconType: "icon", title: "New Feature", description: "" }])}>
            <Plus size={14} className="mr-1" /> Add Feature
          </Button>
          <Separator />
          <ColorField label="Background Color" field="backgroundColor" d={d} set={set} />
          <ColorField label="Text Color" field="textColor" d={d} set={set} />
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground">No settings available.</p>;
  }
}

// ─── Sortable Block Row ───────────────────────────────────────────────────────

function SortableBlock({ block, isSelected, onSelect, onDelete, onDuplicate, onCopyToClipboard, onToggleVisible, onChange, courses, orgId }: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyToClipboard: () => void;
  onToggleVisible: () => void;
  onChange: (data: Record<string, any>) => void;
  courses: { id: number; title: string }[];
  orgId?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const libEntry = BLOCK_LIBRARY.find(b => b.type === block.type);

  return (
    <div ref={setNodeRef} style={style} className={`border-2 rounded-lg overflow-hidden transition-all ${isSelected ? "border-primary shadow-md" : "border-border hover:border-muted-foreground/40"} ${!block.visible ? "opacity-50" : ""}`}>
      {/* Block toolbar */}
      <div className={`flex items-center gap-2 px-3 py-2 select-none ${isSelected ? "bg-primary/10 border-b border-primary/20" : "bg-muted/50 hover:bg-muted"}`}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical size={16} />
        </div>
        {libEntry && <libEntry.icon size={14} className="text-muted-foreground" />}
        <span className="text-sm font-medium flex-1 truncate">{libEntry?.label || block.type}</span>
        <div className="flex items-center gap-1">
          {/* Edit / Done toggle */}
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className={`h-6 px-2 gap-1 text-xs ${isSelected ? "bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}
            onClick={onSelect}
            title={isSelected ? "Done editing — collapse to preview" : "Edit this block"}
          >
            {isSelected ? <><Check size={11} /> Done</> : <><Pencil size={11} /> Edit</>}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleVisible} title={block.visible ? "Hide block" : "Show block"}>
            {block.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate} title="Duplicate block">
            <Copy size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopyToClipboard} title="Copy to clipboard">
            <Clipboard size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete} title="Delete block">
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      {/* Live preview — always shown when not editing */}
      {!isSelected && block.visible && (
        <div
          className="overflow-hidden cursor-pointer group relative"
          style={{ maxHeight: "280px" }}
          onClick={onSelect}
          title="Click to edit"
        >
          <div style={{ transform: "scale(0.7)", transformOrigin: "top left", width: "143%", pointerEvents: "none" }}>
            {renderBlockPreview(block)}
          </div>
          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="bg-background/90 text-xs font-medium px-2 py-1 rounded shadow flex items-center gap-1">
              <Pencil size={10} /> Click to edit
            </span>
          </div>
        </div>
      )}

      {/* Settings panel — shown when editing */}
      {isSelected && (
        <div className="bg-background p-4 space-y-4">
          <BlockSettings block={block} onChange={onChange} courses={courses} orgId={orgId} />
          <div className="pt-2 border-t flex justify-end">
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground" onClick={onSelect}>
              <Save size={13} /> Done Editing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main PageBuilder Component ───────────────────────────────────────────────

// ─── Import Block from Page Modal ───────────────────────────────────────────
function ImportBlockModal({ onClose, onImport, orgId }: { onClose: () => void; onImport: (blocks: Block[]) => void; orgId: number }) {
  const { data: pages = [], isLoading } = trpc.lms.pages.list.useQuery({ orgId }, {
    // orgId 0 means "all pages for my org" — the backend uses ctx.user.orgId
    // We pass a dummy value; the actual org is resolved server-side
    retry: false,
  });
  const [searchPage, setSearchPage] = useState("");
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());

  const filteredPages = (pages as any[]).filter((p: any) =>
    !searchPage || p.title?.toLowerCase().includes(searchPage.toLowerCase())
  );

  const pageBlocks: Block[] = selectedPage
    ? (() => { try { return JSON.parse(selectedPage.blocksJson || "[]"); } catch { return []; } })()
    : [];

  const toggleBlock = (id: string) => {
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    const toImport = pageBlocks.filter(b => selectedBlocks.has(b.id));
    if (toImport.length > 0) onImport(toImport);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Import Block from Another Page</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X size={16} /></Button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: page list */}
          <div className="w-56 border-r flex flex-col">
            <div className="p-3 border-b">
              <Input placeholder="Search pages..." value={searchPage} onChange={e => setSearchPage(e.target.value)} className="h-8 text-xs" />
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoading && <p className="text-xs text-muted-foreground px-2 py-1">Loading...</p>}
                {!isLoading && filteredPages.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No pages found</p>}
                {filteredPages.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPage(p); setSelectedBlocks(new Set()); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                      selectedPage?.id === p.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {p.title || "Untitled Page"}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          {/* Right: block list */}
          <div className="flex-1 flex flex-col">
            {!selectedPage && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select a page to browse its blocks
              </div>
            )}
            {selectedPage && (
              <>
                <div className="px-4 py-2 border-b text-xs text-muted-foreground">
                  {pageBlocks.length} block{pageBlocks.length !== 1 ? "s" : ""} — click to select
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {pageBlocks.length === 0 && <p className="text-xs text-muted-foreground">No blocks on this page</p>}
                    {pageBlocks.map((b: Block) => {
                      const meta = BLOCK_LIBRARY.find(x => x.type === b.type);
                      const checked = selectedBlocks.has(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleBlock(b.id)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            checked ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            checked ? "border-primary bg-primary" : "border-muted-foreground"
                          }`}>
                            {checked && <Check size={10} className="text-primary-foreground" />}
                          </div>
                          {meta && <meta.icon size={14} className="text-muted-foreground flex-shrink-0" />}
                          <div>
                            <div className="text-xs font-medium">{meta?.label ?? b.type}</div>
                            <div className="text-[10px] text-muted-foreground">{b.data?.headline || b.data?.title || b.data?.text || ""}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t">
          <span className="text-xs text-muted-foreground">{selectedBlocks.size} block{selectedBlocks.size !== 1 ? "s" : ""} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={selectedBlocks.size === 0}>Import Selected</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface PageBuilderProps {
  initialBlocks?: Block[];
  onChange: (blocks: Block[]) => void;
  courses?: { id: number; title: string }[];
  orgId?: number;
}

export function PageBuilder({ initialBlocks = [], onChange, courses = [], orgId = 0 }: PageBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  const historyRef = useRef<Block[][]>([initialBlocks]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ── Import Block from Page modal ─────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateBlocks = useCallback((newBlocks: Block[], skipHistory = false) => {
    setBlocks(newBlocks);
    onChange(newBlocks);
    if (!skipHistory) {
      // Truncate forward history
      const newHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
      newHistory.push(newBlocks);
      historyRef.current = newHistory;
      historyIdxRef.current = newHistory.length - 1;
      setCanUndo(historyIdxRef.current > 0);
      setCanRedo(false);
    }
  }, [onChange]);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const prev = historyRef.current[historyIdxRef.current];
    setBlocks(prev);
    onChange(prev);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, [onChange]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const next = historyRef.current[historyIdxRef.current];
    setBlocks(next);
    onChange(next);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, [onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const addBlock = (type: BlockType) => {
    const newBlock: Block = {
      id: nanoid(8),
      type,
      visible: true,
      data: { ...BLOCK_DEFAULTS[type] },
    };
    const newBlocks = [...blocks, newBlock];
    updateBlocks(newBlocks);
    setSelectedId(newBlock.id);
  };

  const deleteBlock = (id: string) => {
    updateBlocks(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const original = blocks[idx];
    const copy: Block = { ...original, id: nanoid(8), data: { ...original.data } };
    const newBlocks = [...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)];
    updateBlocks(newBlocks);
    setSelectedId(copy.id);
  };

  // ── Cross-page block clipboard via localStorage ─────────────────────────────────────────────
  const CLIPBOARD_KEY = "teachific_block_clipboard";
  const [clipboardLabel, setClipboardLabel] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(CLIPBOARD_KEY);
      if (!raw) return null;
      const b: Block = JSON.parse(raw);
      return BLOCK_LIBRARY.find(x => x.type === b.type)?.label ?? b.type;
    } catch { return null; }
  });

  const copyBlockToClipboard = (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    try {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(block));
      const label = BLOCK_LIBRARY.find(x => x.type === block.type)?.label ?? block.type;
      setClipboardLabel(label);
    } catch {}
  };

  const pasteBlockFromClipboard = () => {
    try {
      const raw = localStorage.getItem(CLIPBOARD_KEY);
      if (!raw) return;
      const block: Block = JSON.parse(raw);
      const pasted: Block = { ...block, id: nanoid(8), data: { ...block.data } };
      const newBlocks = selectedId
        ? (() => {
            const idx = blocks.findIndex(b => b.id === selectedId);
            if (idx === -1) return [...blocks, pasted];
            return [...blocks.slice(0, idx + 1), pasted, ...blocks.slice(idx + 1)];
          })()
        : [...blocks, pasted];
      updateBlocks(newBlocks);
      setSelectedId(pasted.id);
    } catch {}
  };

  const toggleVisible = (id: string) => {
    updateBlocks(blocks.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
  };

  const updateBlockData = (id: string, data: Record<string, any>) => {
    updateBlocks(blocks.map(b => b.id === id ? { ...b, data } : b));
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex(b => b.id === active.id);
    const newIdx = blocks.findIndex(b => b.id === over.id);
    updateBlocks(arrayMove(blocks, oldIdx, newIdx));
  };

  const activeBlock = blocks.find(b => b.id === activeId);

  return (
    <div className="flex h-full gap-0">
      {/* Left: Block Library */}
      <div className={`border-r bg-muted/30 flex flex-col transition-all ${showLibrary ? "w-56" : "w-10"}`}>
        <div className="flex items-center justify-between p-3 border-b">
          {showLibrary && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blocks</span>}
          <div className="flex items-center gap-1 ml-auto">
            {showLibrary && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                  <Undo2 size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
                  <Redo2 size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowImport(true)} title="Import block from another page">
                  <FileDown size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={pasteBlockFromClipboard}
                  title={clipboardLabel ? `Paste "${clipboardLabel}" from clipboard` : "No block in clipboard"}
                  disabled={!clipboardLabel}
                >
                  <ClipboardPaste size={14} />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLibrary(v => !v)}>
              {showLibrary ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </Button>
          </div>
        </div>
        {showLibrary && (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {BLOCK_LIBRARY.map(item => (
                <button
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-accent hover:text-accent-foreground transition-colors group"
                >
                  <item.icon size={14} className="text-muted-foreground group-hover:text-accent-foreground shrink-0" />
                  <div>
                    <div className="text-xs font-medium leading-tight">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 overflow-auto bg-slate-100">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="p-4 space-y-3 min-h-full">
              {blocks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-xl text-muted-foreground">
                  <Plus size={32} className="mb-3 opacity-50" />
                  <p className="text-sm font-medium">Add your first block</p>
                  <p className="text-xs mt-1">Click any block type in the left panel</p>
                </div>
              )}
              {blocks.map(block => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedId === block.id}
                  onSelect={() => setSelectedId(selectedId === block.id ? null : block.id)}
                  onDelete={() => deleteBlock(block.id)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onCopyToClipboard={() => copyBlockToClipboard(block.id)}
                  onToggleVisible={() => toggleVisible(block.id)}
                  onChange={data => updateBlockData(block.id, data)}
                  courses={courses}
                  orgId={orgId}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeBlock && (
              <div className="border-2 border-primary rounded-lg bg-background shadow-2xl opacity-90 overflow-hidden" style={{ width: "400px" }}>
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10">
                  <GripVertical size={16} />
                  <span className="text-sm font-medium">{BLOCK_LIBRARY.find(b => b.type === activeBlock.type)?.label}</span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Import Block from Page Modal */}
      {showImport && (
        <ImportBlockModal
          orgId={orgId}
          onClose={() => setShowImport(false)}
          onImport={(importedBlocks) => {
            const withNewIds = importedBlocks.map(b => ({ ...b, id: nanoid(8), data: { ...b.data } }));
            const insertAt = selectedId ? blocks.findIndex(b => b.id === selectedId) + 1 : blocks.length;
            const newBlocks = [...blocks.slice(0, insertAt), ...withNewIds, ...blocks.slice(insertAt)];
            updateBlocks(newBlocks);
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}
