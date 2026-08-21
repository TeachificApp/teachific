/**
 * WysiwygPageBuilder — Weebly-style drag-and-drop page editor
 *
 * Layout:
 *   [Left Sidebar: Element tiles] | [Canvas: live page preview] | [Right Panel: properties]
 *
 * Interactions:
 *   - Drag element tile from sidebar → drop onto canvas to insert
 *   - Click section on canvas → select it (highlights border, opens right panel)
 *   - Click text directly on canvas → inline edit with contentEditable
 *   - Drag section handle on canvas → reorder sections
 *   - Right panel → edit all properties for selected section
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
} from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  GripVertical,
  Trash2,
  Copy,
  Plus,
  ChevronLeft,
  ChevronRight,
  Layout,
  Type,
  Image,
  MousePointer,
  BookOpen,
  Video,
  Star,
  DollarSign,
  CheckSquare,
  Code,
  AlignLeft,
  Minus,
  Grid,
  List,
  Hash,
  Upload,
  X,
  Eye,
  EyeOff,
  Undo2,
  Redo2,
  Settings,
  Layers,
  Move,
  HelpCircle,
  Columns2,

} from "lucide-react";
import * as LucideIcons from "lucide-react";

// ─── Re-use the same Block types from PageBuilder ────────────────────────────
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
  | "text_block"
  | "footer"
  | "faq"
  | "embed_html"
  | "columns";

export interface Block {
  id: string;
  type: BlockType;
  visible: boolean;
  data: Record<string, any>;
}

// ─── Icon helper ─────────────────────────────────────────────────────────────
function LucideIcon({ name, size = 18, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const IconComp = (LucideIcons as any)[name];
  if (!IconComp) return <span style={{ fontSize: size * 0.6, color }}>{name[0]}</span>;
  return <IconComp size={size} color={color} strokeWidth={2} />;
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
    ctaBgColor: "#189aa1",
    ctaTextColor: "#ffffff",
    backgroundType: "color",
    backgroundColor: "#1e293b",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    gradientFrom: "#1e293b",
    gradientTo: "#189aa1",
    gradientDirection: "to bottom right",
    textColor: "#ffffff",
    headlineColor: "",
    headline2Color: "",
    height: "large",
    alignment: "center",
    overlay: true,
    overlayOpacity: 0.5,
    inlineMediaUrl: "",
    inlineMediaPosition: "right",
    inlineMediaType: "",
  },
  text_media: {
    headline: "Why Choose This Course?",
    body: "Our curriculum is designed by industry experts to give you the most relevant and up-to-date knowledge.",
    imageUrl: "",
    imagePosition: "right",
    imageAlt: "",
    ctaText: "",
    ctaUrl: "",
    ctaBgColor: "#189aa1",
    ctaTextColor: "#ffffff",
    backgroundType: "color",
    backgroundColor: "#ffffff",
    backgroundImageUrl: "",
    gradientFrom: "#ffffff",
    gradientTo: "#e0e7ff",
    gradientDirection: "to bottom right",
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
    ctaBgColor: "#189aa1",
    ctaTextColor: "#ffffff",
    backgroundType: "color",
    backgroundColor: "#0f172a",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    gradientFrom: "#0f172a",
    gradientTo: "#189aa1",
    gradientDirection: "to bottom right",
    textColor: "#ffffff",
    headlineColor: "",
    headline2Color: "",
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
    headline: "What Our Students Say",
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
  html: { html: "<p>Custom HTML content here</p>", backgroundColor: "#ffffff" },
  spacer: { height: 60, backgroundColor: "#ffffff" },
  divider: { style: "solid", color: "#e2e8f0", thickness: 1, margin: 40, backgroundColor: "#ffffff" },
  bg_section: {
    headline: "Our Mission",
    body: "We believe in empowering learners with the best education possible.",
    backgroundType: "image",
    backgroundColor: "#1e293b",
    backgroundImageUrl: "",
    backgroundVideoUrl: "",
    gradientFrom: "#1e293b",
    gradientTo: "#189aa1",
    gradientDirection: "to bottom right",
    overlay: true,
    overlayOpacity: 0.6,
    textColor: "#ffffff",
    alignment: "center",
    paddingY: 80,
  },
  button: { text: "Get Started", url: "#", variant: "primary", size: "medium", alignment: "center", backgroundColor: "#ffffff" },
  icon_list: {
    headline: "Key Features",
    items: [
      { id: nanoid(4), icon: "Check", text: "Easy to use interface" },
      { id: nanoid(4), icon: "Star", text: "Expert instructors" },
      { id: nanoid(4), icon: "Zap", text: "Fast and efficient" },
    ],
    iconColor: "#189aa1",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    columns: 1,
  },
  numbered_steps: {
    headline: "How It Works",
    steps: [
      { id: nanoid(4), title: "Sign Up", description: "Create your free account in seconds" },
      { id: nanoid(4), title: "Choose a Course", description: "Browse our catalog and pick what interests you" },
      { id: nanoid(4), title: "Start Learning", description: "Access your course materials immediately" },
    ],
    numberColor: "#189aa1",
    backgroundColor: "#f8fafc",
    textColor: "#1e293b",
  },
  checklist_steps: {
    headline: "What You'll Learn",
    steps: [
      { id: nanoid(4), title: "Core concepts explained clearly", description: "" },
      { id: nanoid(4), title: "Hands-on practice exercises", description: "" },
      { id: nanoid(4), title: "Real-world project experience", description: "" },
    ],
    checkColor: "#22c55e",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
  },
  feature_grid: {
    headline: "Why Choose Us",
    features: [
      { id: nanoid(4), icon: "BookOpen", title: "Comprehensive Content", description: "Everything you need to succeed" },
      { id: nanoid(4), icon: "Users", title: "Community Support", description: "Learn alongside thousands of students" },
      { id: nanoid(4), icon: "Award", title: "Certification", description: "Earn recognized certificates" },
      { id: nanoid(4), icon: "Clock", title: "Lifetime Access", description: "Learn at your own pace, forever" },
    ],
    iconColor: "#189aa1",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    columns: 2,
  },
  text_block: {
    headline: "",
    body: "Enter your text here.",
    alignment: "left",
    backgroundColor: "#ffffff",
    textColor: "#1e293b",
    maxWidth: 800,
  },
  footer: {
    text: "© 2025 Your School. All rights reserved.",
    backgroundColor: "#0f172a",
    textColor: "#94a3b8",
    links: [],
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
    leftBlocks: [],
    rightBlocks: [],
    backgroundColor: "#ffffff",
    paddingY: 40,
  },
};

function getActiveOrganizationPrimary() {
  if (typeof window === "undefined") return "#179ca3";
  return window.getComputedStyle(document.documentElement).getPropertyValue("--org-primary").trim() || "#179ca3";
}

function resolveBlockDefaults(type: BlockType): Record<string, any> {
  const primary = getActiveOrganizationPrimary();
  const defaults = { ...BLOCK_DEFAULTS[type] };
  for (const key of ["ctaBgColor", "gradientTo", "accentColor", "iconColor", "numberColor"]) {
    if (defaults[key] === "#189aa1") defaults[key] = primary;
  }
  return defaults;
}

// ─── Element Library (left sidebar tiles) ────────────────────────────────────
const ELEMENT_LIBRARY = [
  // Layout
  { type: "banner" as BlockType, label: "Hero / Banner", icon: Layout, category: "Layout" },
  { type: "columns" as BlockType, label: "Two Columns", icon: Columns2, category: "Layout" },
  { type: "bg_section" as BlockType, label: "Background Section", icon: Image, category: "Layout" },
  { type: "spacer" as BlockType, label: "Spacer", icon: Type, category: "Layout" },
  { type: "divider" as BlockType, label: "Divider", icon: Minus, category: "Layout" },
  // Content
  { type: "text_media" as BlockType, label: "Text & Media", icon: AlignLeft, category: "Content" },
  { type: "video" as BlockType, label: "Video", icon: Video, category: "Content" },
  { type: "image" as BlockType, label: "Image Block", icon: Image, category: "Content" },
  { type: "checklist" as BlockType, label: "Checklist", icon: CheckSquare, category: "Content" },
  { type: "icon_list" as BlockType, label: "Icon List", icon: List, category: "Content" },
  { type: "numbered_steps" as BlockType, label: "Numbered Steps", icon: Hash, category: "Content" },
  { type: "checklist_steps" as BlockType, label: "Checklist Steps", icon: CheckSquare, category: "Content" },
  { type: "faq" as BlockType, label: "FAQ", icon: HelpCircle, category: "Content" },
  { type: "feature_grid" as BlockType, label: "Feature Grid", icon: Grid, category: "Content" },
  { type: "course_outline" as BlockType, label: "Course Outline", icon: BookOpen, category: "Content" },
  { type: "html" as BlockType, label: "HTML Block", icon: Code, category: "Content" },
  { type: "embed_html" as BlockType, label: "Embed (HTML)", icon: Code, category: "Content" },
  // Conversion
  { type: "cta" as BlockType, label: "CTA / Pricing", icon: MousePointer, category: "Conversion" },
  { type: "pricing" as BlockType, label: "Pricing Table", icon: DollarSign, category: "Conversion" },
  { type: "button" as BlockType, label: "CTA Button", icon: MousePointer, category: "Conversion" },
  // Social Proof
  { type: "testimonials" as BlockType, label: "Reviews", icon: Star, category: "Social Proof" },
];
const CATEGORIES = ["Layout", "Content", "Conversion", "Social Proof"];

// ─── Canvas Block Renderers (full-fidelity, click-to-edit) ────────────────────

function InlineText({
  value,
  onChange,
  tag = "p",
  style = {},
  className = "",
  placeholder = "Click to edit…",
  multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  tag?: "h1" | "h2" | "h3" | "p" | "span";
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);

  const handleBlur = () => {
    setEditing(false);
    const text = ref.current?.innerText ?? "";
    onChange(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === "Escape") ref.current?.blur();
    e.stopPropagation();
  };

  const Tag = tag as any;
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      style={{
        ...style,
        outline: editing ? "2px solid #189aa1" : "none",
        outlineOffset: "2px",
        borderRadius: "3px",
        cursor: "text",
        minWidth: "20px",
        display: "block",
        whiteSpace: multiline ? "pre-wrap" : "normal",
      }}
      className={className}
      data-placeholder={placeholder}
      dangerouslySetInnerHTML={{ __html: value || "" }}
    />
  );
}

// Helper to compute background style from block data
function getBgStyle(data: Record<string, any>, fallback = "#1e293b"): React.CSSProperties {
  const type = data.backgroundType ?? "color";
  if (type === "image" && data.backgroundImageUrl) return { backgroundImage: `url(${data.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
  if (type === "gradient") return { background: `linear-gradient(${data.gradientDirection || "to bottom right"}, ${data.gradientFrom || fallback}, ${data.gradientTo || "#189aa1"})` };
  if (type === "video") return { backgroundColor: "#000" };
  return { backgroundColor: data.backgroundColor || fallback };
}

// Banner canvas block
function BannerCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const isVideo = data.backgroundType === "video" && data.backgroundVideoUrl;
  const bg = getBgStyle(data, "#1e293b");
  const heights: Record<string, string> = { small: "200px", medium: "320px", large: "480px" };
  const hasInlineMedia = data.inlineMediaUrl;
  const mediaPosition = data.inlineMediaPosition || "right";
  const isInlineVideo = data.inlineMediaUrl && (data.inlineMediaUrl.match(/\.(mp4|webm|ogg)/) || data.inlineMediaType === "video");

  const textContent = (
    <div className="animate-fade-in-up" style={{ textAlign: data.alignment || "center", flex: hasInlineMedia ? "1" : undefined, minWidth: hasInlineMedia ? "0" : undefined }}>
      <InlineText
        tag="h1"
        value={data.headline}
        onChange={v => onChange({ ...data, headline: v })}
        style={{ color: data.headlineColor || data.textColor || "#fff", fontSize: "2.5rem", fontWeight: 700, margin: "0 0 4px" }}
        placeholder="Add headline line 1…"
      />
      {(data.headline2 || true) && (
        <InlineText
          tag="h1"
          value={data.headline2 || ""}
          onChange={v => onChange({ ...data, headline2: v })}
          style={{ color: data.headline2Color || data.textColor || "#fff", fontSize: "2.5rem", fontWeight: 700, margin: "0 0 16px" }}
          placeholder="Headline line 2 (optional)…"
        />
      )}
      <InlineText
        tag="p"
        value={data.subtext}
        onChange={v => onChange({ ...data, subtext: v })}
        style={{ color: data.textColor || "#fff", fontSize: "1.125rem", margin: "0 0 24px", opacity: 0.9 }}
        placeholder="Add a subtitle…"
        multiline
      />
      <div style={{ display: "flex", gap: "12px", justifyContent: data.alignment === "center" ? "center" : "flex-start", flexWrap: "wrap" }}>
        {(data.ctaText || true) && (
          <InlineText
            tag="span"
            value={data.ctaText || "Enroll Now"}
            onChange={v => onChange({ ...data, ctaText: v })}
            style={{ backgroundColor: data.ctaBgColor || "#189aa1", color: data.ctaTextColor || "#fff", padding: "12px 28px", borderRadius: "8px", fontWeight: 600, fontSize: "1rem", display: "inline-block" }}
            placeholder="Button text…"
          />
        )}
      </div>
    </div>
  );

  const mediaContent = hasInlineMedia ? (
    <div style={{ flex: "0 0 40%", maxWidth: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {isInlineVideo ? (
        <video autoPlay muted loop playsInline style={{ width: "100%", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }} src={data.inlineMediaUrl} />
      ) : (
        <img src={data.inlineMediaUrl} alt="" style={{ width: "100%", borderRadius: "12px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }} />
      )}
    </div>
  ) : null;

  return (
    <div style={{ ...bg, minHeight: heights[data.height] || "320px", position: "relative", display: "flex", alignItems: "center", justifyContent: data.alignment === "left" ? "flex-start" : data.alignment === "right" ? "flex-end" : "center" }}>
      {isVideo && <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} src={data.backgroundVideoUrl} />}
      {(data.backgroundType === "image" || isVideo) && data.overlay && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${data.overlayOpacity ?? 0.5})`, zIndex: 1 }} />
      )}
      <div style={{ position: "relative", zIndex: 2, padding: "40px 60px", maxWidth: hasInlineMedia ? "100%" : "800px", width: "100%", display: hasInlineMedia ? "flex" : "block", alignItems: "center", gap: "40px", flexDirection: mediaPosition === "left" ? "row-reverse" : "row" }}>
        {textContent}
        {mediaContent}
      </div>
    </div>
  );
}

function TextMediaCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const isRight = data.imagePosition !== "left";
  const bg = getBgStyle(data, "#ffffff");
  return (
    <div style={{ ...bg, padding: "60px 40px" }}>
      <div style={{ display: "flex", gap: "48px", alignItems: "center", flexDirection: isRight ? "row" : "row-reverse", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ flex: 1 }}>
          <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, marginBottom: "16px" }} placeholder="Headline…" />
          <InlineText tag="p" value={data.body} onChange={v => onChange({ ...data, body: v })} style={{ color: data.textColor || "#1e293b", lineHeight: "1.7", opacity: 0.85 }} placeholder="Body text…" multiline />
          {data.ctaText && <a href={data.ctaUrl || "#"} style={{ display: "inline-block", marginTop: "24px", backgroundColor: data.ctaBgColor || "#189aa1", color: data.ctaTextColor || "#fff", padding: "10px 24px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 }}>{data.ctaText}</a>}
        </div>
        <div style={{ flex: 1 }}>
          {data.imageUrl ? (
            <img src={data.imageUrl} alt={data.imageAlt || ""} style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: "#e2e8f0", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <div style={{ textAlign: "center", color: "#94a3b8" }}>
                <Image size={40} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.875rem" }}>Click to add image</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CTACanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const isVideo = data.backgroundType === "video" && data.backgroundVideoUrl;
  const bg = getBgStyle(data, "#0f172a");
  return (
    <div style={{ ...bg, padding: "80px 40px", textAlign: data.alignment || "center", position: "relative" }}>
      {isVideo && <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} src={data.backgroundVideoUrl} />}
      {(data.backgroundType === "image" || isVideo) && data.overlay && <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${data.overlayOpacity ?? 0.5})`, zIndex: 1 }} />}
      <div className="animate-fade-in-up" style={{ position: "relative", zIndex: 2 }}>
        <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.headlineColor || data.textColor || "#fff", fontSize: "2rem", fontWeight: 700, marginBottom: data.headline2 ? "4px" : "12px" }} placeholder="CTA Headline line 1…" />
        {(data.headline2 !== undefined) && (
          <InlineText tag="h2" value={data.headline2 || ""} onChange={v => onChange({ ...data, headline2: v })} style={{ color: data.headline2Color || data.textColor || "#fff", fontSize: "2rem", fontWeight: 700, marginBottom: "12px" }} placeholder="Headline line 2 (optional)…" />
        )}
        <InlineText tag="p" value={data.subtext} onChange={v => onChange({ ...data, subtext: v })} style={{ color: data.textColor || "#fff", opacity: 0.8, marginBottom: "32px", fontSize: "1.125rem" }} placeholder="Supporting text…" multiline />
        <InlineText tag="span" value={data.ctaText || "Get Started"} onChange={v => onChange({ ...data, ctaText: v })} style={{ backgroundColor: data.ctaBgColor || "#189aa1", color: data.ctaTextColor || "#fff", padding: "14px 36px", borderRadius: "8px", fontWeight: 700, fontSize: "1.125rem", display: "inline-block" }} placeholder="Button text…" />
      </div>
    </div>
  );
}

function FeatureGridCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const cols = parseInt(data.columns) || 2;
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }} placeholder="Section headline…" />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "24px", maxWidth: "1000px", margin: "0 auto" }}>
        {(data.features || []).map((f: any, i: number) => (
          <div key={f.id} style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "28px", border: "1px solid #e2e8f0" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "10px", backgroundColor: data.iconColor || "#189aa1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <LucideIcon name={f.icon || "Star"} size={24} color="#fff" />
            </div>
            <InlineText tag="h3" value={f.title} onChange={v => { const features = [...data.features]; features[i] = { ...f, title: v }; onChange({ ...data, features }); }} style={{ color: data.textColor || "#1e293b", fontWeight: 700, fontSize: "1.0625rem", marginBottom: "8px" }} placeholder="Feature title…" />
            <InlineText tag="p" value={f.description} onChange={v => { const features = [...data.features]; features[i] = { ...f, description: v }; onChange({ ...data, features }); }} style={{ color: data.textColor || "#1e293b", opacity: 0.75, lineHeight: "1.6", fontSize: "0.9375rem" }} placeholder="Description…" multiline />
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialsCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#f8fafc", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }} placeholder="Section headline…" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", maxWidth: "1100px", margin: "0 auto" }}>
        {(data.testimonials || []).map((t: any, i: number) => (
          <div key={t.id} style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <InlineText tag="p" value={t.quote} onChange={v => { const ts = [...data.testimonials]; ts[i] = { ...t, quote: v }; onChange({ ...data, testimonials: ts }); }} style={{ color: "#475569", lineHeight: "1.7", marginBottom: "20px", fontStyle: "italic" }} placeholder="Quote…" multiline />
            <InlineText tag="span" value={t.author} onChange={v => { const ts = [...data.testimonials]; ts[i] = { ...t, author: v }; onChange({ ...data, testimonials: ts }); }} style={{ fontWeight: 600, color: data.textColor || "#1e293b", display: "block" }} placeholder="Author name…" />
            <InlineText tag="span" value={t.role} onChange={v => { const ts = [...data.testimonials]; ts[i] = { ...t, role: v }; onChange({ ...data, testimonials: ts }); }} style={{ fontSize: "0.875rem", color: "#64748b", display: "block" }} placeholder="Role / title…" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }} placeholder="Section headline…" />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.columns || 2}, 1fr)`, gap: "16px", maxWidth: "900px", margin: "0 auto" }}>
        {(data.items || []).map((item: any, i: number) => (
          <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: data.iconColor || "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <InlineText tag="span" value={item.text} onChange={v => { const items = [...data.items]; items[i] = { ...item, text: v }; onChange({ ...data, items }); }} style={{ color: data.textColor || "#1e293b", lineHeight: "1.5", display: "block" }} placeholder="Item text…" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BgSectionCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const isVideo = data.backgroundType === "video" && data.backgroundVideoUrl;
  const bg = getBgStyle(data, "#334155");
  return (
    <div style={{ ...bg, padding: `${data.paddingY || 80}px 40px`, textAlign: data.alignment || "center", position: "relative" }}>
      {isVideo && <video autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} src={data.backgroundVideoUrl} />}
      {(data.backgroundType === "image" || isVideo || !data.backgroundType) && data.overlay && <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(0,0,0,${data.overlayOpacity ?? 0.6})`, zIndex: 1 }} />}
      <div style={{ position: "relative", zIndex: 2, maxWidth: "800px", margin: "0 auto" }}>
        <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#fff", fontSize: "2rem", fontWeight: 700, marginBottom: "16px" }} placeholder="Headline…" />
        <InlineText tag="p" value={data.body} onChange={v => onChange({ ...data, body: v })} style={{ color: data.textColor || "#fff", opacity: 0.9, lineHeight: "1.7", fontSize: "1.125rem" }} placeholder="Body text…" multiline />
      </div>
    </div>
  );
}

function VideoCanvas({ data }: { data: Record<string, any> }) {
  const getEmbedUrl = (url: string, type: string) => {
    if (!url) return "";
    if (type === "youtube") { const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/); return m ? `https://www.youtube.com/embed/${m[1]}` : url; }
    if (type === "vimeo") { const m = url.match(/vimeo\.com\/(\d+)/); return m ? `https://player.vimeo.com/video/${m[1]}` : url; }
    return url;
  };
  const embedUrl = getEmbedUrl(data.videoUrl, data.videoType);
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#000", padding: "40px 20px", textAlign: "center" }}>
      {data.headline && <h2 style={{ color: "#fff", marginBottom: "24px", fontSize: "1.5rem", fontWeight: 700 }}>{data.headline}</h2>}
      <div style={{ maxWidth: `${data.maxWidth || 800}px`, margin: "0 auto", aspectRatio: "16/9", backgroundColor: "#1e293b", borderRadius: "8px", overflow: "hidden" }}>
        {embedUrl ? <iframe src={embedUrl} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="Video" /> : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Video size={64} color="#475569" />
          </div>
        )}
      </div>
    </div>
  );
}

function ImageCanvas({ data }: { data: Record<string, any> }) {
  const widths: Record<string, string> = { full: "100%", wide: "80%", medium: "60%", small: "40%" };
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "40px 20px", textAlign: data.alignment || "center" }}>
      <div style={{ display: "inline-block", width: widths[data.width] || "100%", maxWidth: "100%" }}>
        {data.imageUrl ? <img src={data.imageUrl} alt={data.imageAlt || ""} style={{ width: "100%", borderRadius: "8px" }} /> : (
          <div style={{ width: "100%", aspectRatio: "16/9", backgroundColor: "#e2e8f0", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "#94a3b8" }}><Image size={48} style={{ margin: "0 auto 8px" }} /><p style={{ fontSize: "0.875rem" }}>Click properties to add image</p></div>
          </div>
        )}
        {data.caption && <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "8px" }}>{data.caption}</p>}
      </div>
    </div>
  );
}

function ButtonCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const variants: Record<string, React.CSSProperties> = {
    primary: { backgroundColor: "#189aa1", color: "#fff" },
    secondary: { backgroundColor: "#e2e8f0", color: "#1e293b" },
    outline: { backgroundColor: "transparent", color: "#189aa1", border: "2px solid #189aa1" },
  };
  const sizes: Record<string, React.CSSProperties> = {
    small: { padding: "8px 20px", fontSize: "0.875rem" },
    medium: { padding: "12px 28px", fontSize: "1rem" },
    large: { padding: "16px 40px", fontSize: "1.125rem" },
  };
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "32px 40px", textAlign: data.alignment || "center" }}>
      <InlineText tag="span" value={data.text || "Get Started"} onChange={v => onChange({ ...data, text: v })} style={{ ...variants[data.variant || "primary"], ...sizes[data.size || "medium"], borderRadius: "8px", fontWeight: 600, display: "inline-block" }} placeholder="Button text…" />
    </div>
  );
}

function SpacerCanvas({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ height: `${data.height || 60}px`, backgroundColor: data.backgroundColor || "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "#94a3b8", userSelect: "none" }}>Spacer ({data.height || 60}px)</span>
    </div>
  );
}

function DividerCanvas({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: `${data.margin || 40}px 40px` }}>
      <hr style={{ border: "none", borderTop: `${data.thickness || 1}px ${data.style || "solid"} ${data.color || "#e2e8f0"}` }} />
    </div>
  );
}

function HtmlCanvas({ data }: { data: Record<string, any> }) {
  const html = data.html || "";
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:sans-serif;background:${data.backgroundColor || "#fff"};}</style></head><body>${html}</body></html>`;
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff" }}>
      {html.trim() ? (
        <iframe srcDoc={srcdoc} sandbox="allow-scripts" style={{ width: "100%", border: "none", minHeight: "80px" }} onLoad={e => { try { const h = e.currentTarget.contentWindow?.document?.body?.scrollHeight; if (h) e.currentTarget.style.height = h + "px"; } catch {} }} title="HTML Preview" />
      ) : (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>HTML block — edit in properties panel</div>
      )}
    </div>
  );
}

function CourseOutlineCanvas({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#f8fafc", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "40px", border: "2px dashed #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
          <BookOpen size={40} style={{ margin: "0 auto 12px" }} />
          <p>{data.courseId ? `Course curriculum (ID: ${data.courseId})` : "Select a course in the properties panel"}</p>
        </div>
      </div>
    </div>
  );
}

function PricingCanvas({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      {data.headline && <h2 style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }}>{data.headline}</h2>}
      <div style={{ maxWidth: "800px", margin: "0 auto", backgroundColor: "#f8fafc", borderRadius: "12px", padding: "40px", border: "2px dashed #e2e8f0", textAlign: "center", color: "#94a3b8" }}>
        <DollarSign size={40} style={{ margin: "0 auto 12px" }} />
        <p>{data.courseId ? `Pricing for course ID: ${data.courseId}` : "Select a course in the properties panel"}</p>
      </div>
    </div>
  );
}

function IconListCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "32px" }} placeholder="Section headline…" />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.columns || 1}, 1fr)`, gap: "16px", maxWidth: "800px", margin: "0 auto" }}>
        {(data.items || []).map((item: any, i: number) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: data.iconColor || "#189aa1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LucideIcon name={item.icon || "Check"} size={16} color="#fff" />
            </div>
            <InlineText tag="span" value={item.text} onChange={v => { const items = [...data.items]; items[i] = { ...item, text: v }; onChange({ ...data, items }); }} style={{ color: data.textColor || "#1e293b", display: "block" }} placeholder="Item text…" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberedStepsCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#f8fafc", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }} placeholder="Section headline…" />
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        {(data.steps || []).map((step: any, i: number) => (
          <div key={step.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: data.numberColor || "#189aa1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontWeight: 700, fontSize: "1.125rem" }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <InlineText tag="h3" value={step.title} onChange={v => { const steps = [...data.steps]; steps[i] = { ...step, title: v }; onChange({ ...data, steps }); }} style={{ color: data.textColor || "#1e293b", fontWeight: 600, fontSize: "1.0625rem", marginBottom: "4px" }} placeholder="Step title…" />
              <InlineText tag="p" value={step.description} onChange={v => { const steps = [...data.steps]; steps[i] = { ...step, description: v }; onChange({ ...data, steps }); }} style={{ color: data.textColor || "#1e293b", opacity: 0.75, lineHeight: "1.6" }} placeholder="Step description…" multiline />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistStepsCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }} placeholder="Section headline…" />
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
        {(data.steps || []).map((step: any, i: number) => (
          <div key={step.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: data.checkColor || "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <InlineText tag="h3" value={step.title} onChange={v => { const steps = [...data.steps]; steps[i] = { ...step, title: v }; onChange({ ...data, steps }); }} style={{ color: data.textColor || "#1e293b", fontWeight: 600, fontSize: "1.0625rem" }} placeholder="Item title…" />
              {step.description !== undefined && <InlineText tag="p" value={step.description} onChange={v => { const steps = [...data.steps]; steps[i] = { ...step, description: v }; onChange({ ...data, steps }); }} style={{ color: data.textColor || "#1e293b", opacity: 0.75, lineHeight: "1.6", marginTop: "4px" }} placeholder="Optional description…" multiline />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// FAQ Canvas Block
function FAQCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "60px 40px" }}>
      <InlineText tag="h2" value={data.headline} onChange={v => onChange({ ...data, headline: v })} style={{ color: data.textColor || "#1e293b", fontSize: "1.875rem", fontWeight: 700, textAlign: "center", marginBottom: "40px" }} placeholder="FAQ headline…" />
      <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {(data.items || []).map((item: any, i: number) => (
          <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px 20px" }}>
            <InlineText tag="h3" value={item.question} onChange={v => { const items = [...data.items]; items[i] = { ...item, question: v }; onChange({ ...data, items }); }} style={{ color: data.textColor || "#1e293b", fontWeight: 600, fontSize: "1rem", marginBottom: "8px" }} placeholder="Question…" />
            <InlineText tag="p" value={item.answer} onChange={v => { const items = [...data.items]; items[i] = { ...item, answer: v }; onChange({ ...data, items }); }} style={{ color: data.textColor || "#1e293b", opacity: 0.75, lineHeight: "1.6", fontSize: "0.9375rem" }} placeholder="Answer…" multiline />
          </div>
        ))}
      </div>
    </div>
  );
}

// Embed HTML Canvas Block
function EmbedHtmlCanvas({ data }: { data: Record<string, any> }) {
  const code = data.embedCode || "";
  const maxW = data.maxWidth || "800";
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:60px;background:${data.backgroundColor || "#fff"};}</style></head><body>${code}</body></html>`;
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: "40px 20px" }}>
      <div style={{ maxWidth: `${maxW}px`, margin: "0 auto" }}>
        {code.trim() ? (
          <iframe srcDoc={srcdoc} sandbox="allow-scripts allow-same-origin" style={{ width: "100%", border: "none", minHeight: "80px", borderRadius: "8px" }} onLoad={e => { try { const h = e.currentTarget.contentWindow?.document?.body?.scrollHeight; if (h) e.currentTarget.style.height = h + "px"; } catch {} }} title="Embed Preview" />
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem", border: "2px dashed #e2e8f0", borderRadius: "8px" }}>
            <Code size={32} style={{ margin: "0 auto 8px", display: "block" }} />
            Embed block — paste your embed code in the properties panel
          </div>
        )}
      </div>
    </div>
  );
}

// Columns (Divided) Canvas Block
function ColumnsCanvas({ data, onChange }: { data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  const layout = data.layout || "50-50";
  const gap = data.gap || 24;
  const gridCols = layout === "33-67" ? "1fr 2fr" : layout === "67-33" ? "2fr 1fr" : layout === "25-75" ? "1fr 3fr" : layout === "75-25" ? "3fr 1fr" : "1fr 1fr";
  return (
    <div style={{ backgroundColor: data.backgroundColor || "#fff", padding: `${data.paddingY || 40}px 40px` }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: `${gap}px`, maxWidth: "1100px", margin: "0 auto", minHeight: "120px" }}>
        <div style={{ border: "2px dashed #e2e8f0", borderRadius: "8px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
          <Columns2 size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
          Left Column
          {(data.leftContent) && <div style={{ marginTop: "8px", color: "#1e293b", fontSize: "0.8125rem", textAlign: "center" }} dangerouslySetInnerHTML={{ __html: data.leftContent }} />}
        </div>
        <div style={{ border: "2px dashed #e2e8f0", borderRadius: "8px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
          <Columns2 size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
          Right Column
          {(data.rightContent) && <div style={{ marginTop: "8px", color: "#1e293b", fontSize: "0.8125rem", textAlign: "center" }} dangerouslySetInnerHTML={{ __html: data.rightContent }} />}
        </div>
      </div>
    </div>
  );
}

// Master canvas block renderer
function renderCanvasBlock(block: Block, onChange: (d: Record<string, any>) => void) {
  const p = { data: block.data ?? {}, onChange };
  switch (block.type) {
    case "banner": return <BannerCanvas {...p} />;
    case "text_media": return <TextMediaCanvas {...p} />;
    case "cta": return <CTACanvas {...p} />;
    case "bg_section": return <BgSectionCanvas {...p} />;
    case "feature_grid": return <FeatureGridCanvas {...p} />;
    case "testimonials": return <TestimonialsCanvas {...p} />;
    case "checklist": return <ChecklistCanvas {...p} />;
    case "icon_list": return <IconListCanvas {...p} />;
    case "numbered_steps": return <NumberedStepsCanvas {...p} />;
    case "checklist_steps": return <ChecklistStepsCanvas {...p} />;
    case "button": return <ButtonCanvas {...p} />;
    case "video": return <VideoCanvas data={block.data} />;
    case "image": return <ImageCanvas data={block.data} />;
    case "html": return <HtmlCanvas data={block.data} />;
    case "course_outline": return <CourseOutlineCanvas data={block.data} />;
    case "pricing": return <PricingCanvas data={block.data} />;
    case "spacer": return <SpacerCanvas data={block.data} />;
    case "divider": return <DividerCanvas data={block.data} />;
    case "faq": return <FAQCanvas {...p} />;
    case "embed_html": return <EmbedHtmlCanvas data={block.data} />;
    case "columns": return <ColumnsCanvas {...p} />;
    default: return <div style={{ padding: "20px", color: "#94a3b8" }}>Unknown block type</div>;
  }
}
// ─── Properties Panell ─────────────────────────────────────────────────────────

function ColorProp({ label, field, data, onChange }: { label: string; field: string; data: Record<string, any>; onChange: (d: Record<string, any>) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2 items-center">
        <input type="color" value={data[field] || "#ffffff"} onChange={e => onChange({ ...data, [field]: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-border" />
        <Input value={data[field] || ""} onChange={e => onChange({ ...data, [field]: e.target.value })} className="h-8 text-xs font-mono flex-1" placeholder="#ffffff" />
      </div>
    </div>
  );
}

function TextProp({ label, field, data, onChange, multiline = false, placeholder = "" }: { label: string; field: string; data: Record<string, any>; onChange: (d: Record<string, any>) => void; multiline?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline
        ? <Textarea value={data[field] || ""} onChange={e => onChange({ ...data, [field]: e.target.value })} className="text-xs min-h-[72px]" placeholder={placeholder} />
        : <Input value={data[field] || ""} onChange={e => onChange({ ...data, [field]: e.target.value })} className="h-8 text-xs" placeholder={placeholder} />
      }
    </div>
  );
}

function SelectProp({ label, field, data, onChange, options }: { label: string; field: string; data: Record<string, any>; onChange: (d: Record<string, any>) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select value={data[field] || ""} onChange={e => onChange({ ...data, [field]: e.target.value })} className="w-full h-8 text-xs border border-border rounded px-2 bg-background">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberProp({ label, field, data, onChange, min = 0, max = 9999 }: { label: string; field: string; data: Record<string, any>; onChange: (d: Record<string, any>) => void; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={data[field] ?? 0} onChange={e => onChange({ ...data, [field]: Number(e.target.value) })} className="h-8 text-xs" min={min} max={max} />
    </div>
  );
}

function ImageUploadProp({ label, field, data, onChange, orgId }: { label: string; field: string; data: Record<string, any>; onChange: (d: Record<string, any>) => void; orgId?: number }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (orgId) fd.append("orgId", String(orgId));
      fd.append("folder", "page-builder");
      const res = await fetch("/api/media-upload", { method: "POST", body: fd, credentials: "include" });
      if (res.ok) { const d = await res.json(); onChange({ ...data, [field]: d.url }); }
    } finally { setUploading(false); }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {data[field] && (
        <div className="relative rounded overflow-hidden border border-border mb-1">
          <img src={data[field]} alt="" className="w-full h-24 object-cover" />
          <button onClick={() => onChange({ ...data, [field]: "" })} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/80">
            <X size={10} />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Input value={data[field] || ""} onChange={e => onChange({ ...data, [field]: e.target.value })} className="h-8 text-xs flex-1" placeholder="https://…" />
        <label className="cursor-pointer">
          <input type="file" accept="image/*,video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <Button variant="outline" size="icon" className="h-8 w-8" asChild={false} disabled={uploading} title="Upload">
            {uploading ? <span className="text-[10px]">…</span> : <Upload size={12} />}
          </Button>
        </label>
      </div>
    </div>
  );
}

function PropertiesPanel({ block, onChange, onDelete, onDuplicate, onToggleVisible, courses, orgId }: {
  block: Block;
  onChange: (data: Record<string, any>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  courses: { id: number; title: string }[];
  orgId?: number;
}) {
  const d = block.data ?? {};
  const set = (key: string, val: any) => onChange({ ...d, [key]: val });
  const libEntry = ELEMENT_LIBRARY.find(e => e.type === block.type);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          {libEntry && <libEntry.icon size={14} className="text-muted-foreground" />}
          <span className="text-sm font-semibold">{libEntry?.label || block.type}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1 gap-1" onClick={onDuplicate}><Copy size={11} /> Duplicate</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onToggleVisible} title={block.visible ? "Hide" : "Show"}>
            {block.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive gap-1" onClick={onDelete}><Trash2 size={11} /></Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Block-specific properties */}
          {block.type === "banner" && <>
            <TextProp label="Headline Line 1" field="headline" data={d} onChange={onChange} placeholder="Your headline…" />
            <TextProp label="Headline Line 2" field="headline2" data={d} onChange={onChange} placeholder="Second line (optional)…" />
            <TextProp label="Subtext" field="subtext" data={d} onChange={onChange} multiline placeholder="Supporting text…" />
            <TextProp label="CTA Button Text" field="ctaText" data={d} onChange={onChange} placeholder="Enroll Now" />
            <TextProp label="CTA Button URL" field="ctaUrl" data={d} onChange={onChange} placeholder="https://…" />
            <ColorProp label="Button Color" field="ctaBgColor" data={d} onChange={onChange} />
            <ColorProp label="Button Text Color" field="ctaTextColor" data={d} onChange={onChange} />
            <Separator />
            <SelectProp label="Background Type" field="backgroundType" data={d} onChange={onChange} options={[{ value: "color", label: "Color" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }, { value: "video", label: "Video" }]} />
            {d.backgroundType === "color" && <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />}
            {d.backgroundType === "gradient" && <>
              <ColorProp label="Gradient Start" field="gradientFrom" data={d} onChange={onChange} />
              <ColorProp label="Gradient End" field="gradientTo" data={d} onChange={onChange} />
              <SelectProp label="Direction" field="gradientDirection" data={d} onChange={onChange} options={[{ value: "to right", label: "Left → Right" }, { value: "to bottom", label: "Top → Bottom" }, { value: "to bottom right", label: "Diagonal ↘" }, { value: "to bottom left", label: "Diagonal ↙" }]} />
            </>}
            {d.backgroundType === "image" && <>
              <ImageUploadProp label="Background Image" field="backgroundImageUrl" data={d} onChange={onChange} orgId={orgId} />
              <div className="flex items-center gap-2"><input type="checkbox" checked={!!d.overlay} onChange={e => onChange({ ...d, overlay: e.target.checked })} /><span className="text-xs text-muted-foreground">Overlay</span></div>
              {d.overlay && <NumberProp label="Overlay Opacity" field="overlayOpacity" data={d} onChange={onChange} min={0} max={1} />}
            </>
            }
            {d.backgroundType === "video" && <>
              <ImageUploadProp label="Background Video" field="backgroundVideoUrl" data={d} onChange={onChange} orgId={orgId} />
              <div className="flex items-center gap-2"><input type="checkbox" checked={!!d.overlay} onChange={e => onChange({ ...d, overlay: e.target.checked })} /><span className="text-xs text-muted-foreground">Overlay</span></div>
              {d.overlay && <NumberProp label="Overlay Opacity" field="overlayOpacity" data={d} onChange={onChange} min={0} max={1} />}
            </>}
            <Separator />
            <ColorProp label="Headline 1 Color" field="headlineColor" data={d} onChange={onChange} />
            <ColorProp label="Headline 2 Color" field="headline2Color" data={d} onChange={onChange} />
            <ColorProp label="Body Text Color" field="textColor" data={d} onChange={onChange} />
            <SelectProp label="Height" field="height" data={d} onChange={onChange} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
            <SelectProp label="Alignment" field="alignment" data={d} onChange={onChange} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
            <Separator />
            <ImageUploadProp label="Inline Image/Video" field="inlineMediaUrl" data={d} onChange={onChange} orgId={orgId} />
            {d.inlineMediaUrl && <SelectProp label="Media Position" field="inlineMediaPosition" data={d} onChange={onChange} options={[{ value: "left", label: "Left of text" }, { value: "right", label: "Right of text" }, { value: "center", label: "Below text (center)" }]} />}
          </>}

          {block.type === "text_media" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <TextProp label="Body Text" field="body" data={d} onChange={onChange} multiline />
            <TextProp label="CTA Text" field="ctaText" data={d} onChange={onChange} />
            <TextProp label="CTA URL" field="ctaUrl" data={d} onChange={onChange} placeholder="https://…" />
            <ColorProp label="Button Color" field="ctaBgColor" data={d} onChange={onChange} />
            <ColorProp label="Button Text Color" field="ctaTextColor" data={d} onChange={onChange} />
            <Separator />
            <ImageUploadProp label="Image" field="imageUrl" data={d} onChange={onChange} orgId={orgId} />
            <SelectProp label="Image Position" field="imagePosition" data={d} onChange={onChange} options={[{ value: "right", label: "Right" }, { value: "left", label: "Left" }]} />
            <Separator />
            <SelectProp label="Background Type" field="backgroundType" data={d} onChange={onChange} options={[{ value: "color", label: "Color" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }]} />
            {(d.backgroundType === "color" || !d.backgroundType) && <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />}
            {d.backgroundType === "gradient" && <>
              <ColorProp label="Gradient Start" field="gradientFrom" data={d} onChange={onChange} />
              <ColorProp label="Gradient End" field="gradientTo" data={d} onChange={onChange} />
              <SelectProp label="Direction" field="gradientDirection" data={d} onChange={onChange} options={[{ value: "to right", label: "Left → Right" }, { value: "to bottom", label: "Top → Bottom" }, { value: "to bottom right", label: "Diagonal ↘" }, { value: "to bottom left", label: "Diagonal ↙" }]} />
            </>}
            {d.backgroundType === "image" && <ImageUploadProp label="Background Image" field="backgroundImageUrl" data={d} onChange={onChange} orgId={orgId} />}
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}

          {block.type === "cta" && <>
            <TextProp label="Headline Line 1" field="headline" data={d} onChange={onChange} />
            <TextProp label="Headline Line 2" field="headline2" data={d} onChange={onChange} placeholder="Second line (optional)…" />
            <TextProp label="Subtext" field="subtext" data={d} onChange={onChange} multiline />
            <TextProp label="Button Text" field="ctaText" data={d} onChange={onChange} />
            <TextProp label="Button URL" field="ctaUrl" data={d} onChange={onChange} placeholder="https://…" />
            <ColorProp label="Button Color" field="ctaBgColor" data={d} onChange={onChange} />
            <ColorProp label="Button Text Color" field="ctaTextColor" data={d} onChange={onChange} />
            <Separator />
            <SelectProp label="Background Type" field="backgroundType" data={d} onChange={onChange} options={[{ value: "color", label: "Color" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }, { value: "video", label: "Video" }]} />
            {d.backgroundType === "color" && <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />}
            {d.backgroundType === "gradient" && <>
              <ColorProp label="Gradient Start" field="gradientFrom" data={d} onChange={onChange} />
              <ColorProp label="Gradient End" field="gradientTo" data={d} onChange={onChange} />
              <SelectProp label="Direction" field="gradientDirection" data={d} onChange={onChange} options={[{ value: "to right", label: "Left → Right" }, { value: "to bottom", label: "Top → Bottom" }, { value: "to bottom right", label: "Diagonal ↘" }, { value: "to bottom left", label: "Diagonal ↙" }]} />
            </>}
            {d.backgroundType === "image" && <>
              <ImageUploadProp label="Background Image" field="backgroundImageUrl" data={d} onChange={onChange} orgId={orgId} />
              <div className="flex items-center gap-2"><input type="checkbox" checked={!!d.overlay} onChange={e => onChange({ ...d, overlay: e.target.checked })} /><span className="text-xs text-muted-foreground">Overlay</span></div>
              {d.overlay && <NumberProp label="Overlay Opacity" field="overlayOpacity" data={d} onChange={onChange} min={0} max={1} />}
            </>}
            {d.backgroundType === "video" && <>
              <ImageUploadProp label="Background Video" field="backgroundVideoUrl" data={d} onChange={onChange} orgId={orgId} />
              <div className="flex items-center gap-2"><input type="checkbox" checked={!!d.overlay} onChange={e => onChange({ ...d, overlay: e.target.checked })} /><span className="text-xs text-muted-foreground">Overlay</span></div>
              {d.overlay && <NumberProp label="Overlay Opacity" field="overlayOpacity" data={d} onChange={onChange} min={0} max={1} />}
            </>}
            <Separator />
            <ColorProp label="Headline 1 Color" field="headlineColor" data={d} onChange={onChange} />
            <ColorProp label="Headline 2 Color" field="headline2Color" data={d} onChange={onChange} />
            <ColorProp label="Body Text Color" field="textColor" data={d} onChange={onChange} />
            <SelectProp label="Alignment" field="alignment" data={d} onChange={onChange} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} />
          </>}

          {block.type === "bg_section" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <TextProp label="Body Text" field="body" data={d} onChange={onChange} multiline />
            <Separator />
            <SelectProp label="Background Type" field="backgroundType" data={d} onChange={onChange} options={[{ value: "color", label: "Color" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }, { value: "video", label: "Video" }]} />
            {(d.backgroundType === "color" || !d.backgroundType) && <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />}
            {d.backgroundType === "gradient" && <>
              <ColorProp label="Gradient Start" field="gradientFrom" data={d} onChange={onChange} />
              <ColorProp label="Gradient End" field="gradientTo" data={d} onChange={onChange} />
              <SelectProp label="Direction" field="gradientDirection" data={d} onChange={onChange} options={[{ value: "to right", label: "Left → Right" }, { value: "to bottom", label: "Top → Bottom" }, { value: "to bottom right", label: "Diagonal ↘" }, { value: "to bottom left", label: "Diagonal ↙" }]} />
            </>}
            {d.backgroundType === "image" && <>
              <ImageUploadProp label="Background Image" field="backgroundImageUrl" data={d} onChange={onChange} orgId={orgId} />
              <div className="flex items-center gap-2"><input type="checkbox" checked={!!d.overlay} onChange={e => onChange({ ...d, overlay: e.target.checked })} /><span className="text-xs text-muted-foreground">Overlay</span></div>
              {d.overlay && <NumberProp label="Overlay Opacity" field="overlayOpacity" data={d} onChange={onChange} min={0} max={1} />}
            </>}
            {d.backgroundType === "video" && <>
              <TextProp label="Background Video URL" field="backgroundVideoUrl" data={d} onChange={onChange} placeholder="https://…" />
              <div className="flex items-center gap-2"><input type="checkbox" checked={!!d.overlay} onChange={e => onChange({ ...d, overlay: e.target.checked })} /><span className="text-xs text-muted-foreground">Overlay</span></div>
              {d.overlay && <NumberProp label="Overlay Opacity" field="overlayOpacity" data={d} onChange={onChange} min={0} max={1} />}
            </>}
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
            <NumberProp label="Vertical Padding (px)" field="paddingY" data={d} onChange={onChange} min={20} max={300} />
            <SelectProp label="Alignment" field="alignment" data={d} onChange={onChange} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} />
          </>}

          {block.type === "feature_grid" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <SelectProp label="Columns" field="columns" data={d} onChange={onChange} options={[{ value: "2", label: "2 columns" }, { value: "3", label: "3 columns" }, { value: "4", label: "4 columns" }]} />
            <ColorProp label="Icon Color" field="iconColor" data={d} onChange={onChange} />
            <Separator />
            <Label className="text-xs font-semibold">Features</Label>
            {(d.features || []).map((f: any, i: number) => (
              <div key={f.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Feature {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => set("features", d.features.filter((_: any, j: number) => j !== i))}><Trash2 size={11} /></Button>
                </div>
                <Input value={f.title} onChange={e => { const features = [...d.features]; features[i] = { ...f, title: e.target.value }; set("features", features); }} className="h-7 text-xs" placeholder="Title" />
                <Textarea value={f.description || ""} onChange={e => { const features = [...d.features]; features[i] = { ...f, description: e.target.value }; set("features", features); }} className="text-xs min-h-[56px]" placeholder="Description" />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => set("features", [...(d.features || []), { id: nanoid(4), icon: "Star", iconType: "icon", title: "New Feature", description: "" }])}>
              <Plus size={12} className="mr-1" /> Add Feature
            </Button>
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}

          {block.type === "testimonials" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <Separator />
            <Label className="text-xs font-semibold">Testimonials</Label>
            {(d.testimonials || []).map((t: any, i: number) => (
              <div key={t.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Testimonial {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => set("testimonials", d.testimonials.filter((_: any, j: number) => j !== i))}><Trash2 size={11} /></Button>
                </div>
                <Textarea value={t.quote} onChange={e => { const ts = [...d.testimonials]; ts[i] = { ...t, quote: e.target.value }; set("testimonials", ts); }} className="text-xs min-h-[72px]" placeholder="Quote…" />
                <Input value={t.author} onChange={e => { const ts = [...d.testimonials]; ts[i] = { ...t, author: e.target.value }; set("testimonials", ts); }} className="h-7 text-xs" placeholder="Author name" />
                <Input value={t.role || ""} onChange={e => { const ts = [...d.testimonials]; ts[i] = { ...t, role: e.target.value }; set("testimonials", ts); }} className="h-7 text-xs" placeholder="Role / title" />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => set("testimonials", [...(d.testimonials || []), { id: nanoid(4), quote: "Great course!", author: "Student Name", role: "Role", avatarUrl: "" }])}>
              <Plus size={12} className="mr-1" /> Add Testimonial
            </Button>
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}

          {block.type === "checklist" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <SelectProp label="Columns" field="columns" data={d} onChange={onChange} options={[{ value: "1", label: "1 column" }, { value: "2", label: "2 columns" }, { value: "3", label: "3 columns" }]} />
            <ColorProp label="Icon Color" field="iconColor" data={d} onChange={onChange} />
            <Separator />
            <Label className="text-xs font-semibold">Items</Label>
            {(d.items || []).map((item: any, i: number) => (
              <div key={item.id} className="flex gap-2 items-center">
                <Input value={item.text} onChange={e => { const items = [...d.items]; items[i] = { ...item, text: e.target.value }; set("items", items); }} className="h-7 text-xs flex-1" placeholder="Item text" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => set("items", d.items.filter((_: any, j: number) => j !== i))}><Trash2 size={11} /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => set("items", [...(d.items || []), { id: nanoid(4), text: "New item" }])}>
              <Plus size={12} className="mr-1" /> Add Item
            </Button>
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}

          {block.type === "icon_list" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <SelectProp label="Columns" field="columns" data={d} onChange={onChange} options={[{ value: "1", label: "1 column" }, { value: "2", label: "2 columns" }]} />
            <ColorProp label="Icon Color" field="iconColor" data={d} onChange={onChange} />
            <Separator />
            <Label className="text-xs font-semibold">Items</Label>
            {(d.items || []).map((item: any, i: number) => (
              <div key={item.id} className="flex gap-2 items-center">
                <Input value={item.text} onChange={e => { const items = [...d.items]; items[i] = { ...item, text: e.target.value }; set("items", items); }} className="h-7 text-xs flex-1" placeholder="Item text" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => set("items", d.items.filter((_: any, j: number) => j !== i))}><Trash2 size={11} /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => set("items", [...(d.items || []), { id: nanoid(4), icon: "Check", text: "New item" }])}>
              <Plus size={12} className="mr-1" /> Add Item
            </Button>
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}

          {(block.type === "numbered_steps" || block.type === "checklist_steps") && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            {block.type === "numbered_steps" ? <ColorProp label="Number Color" field="numberColor" data={d} onChange={onChange} /> : <ColorProp label="Check Color" field="checkColor" data={d} onChange={onChange} />}
            <Separator />
            <Label className="text-xs font-semibold">Steps</Label>
            {(d.steps || []).map((step: any, i: number) => (
              <div key={step.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => set("steps", d.steps.filter((_: any, j: number) => j !== i))}><Trash2 size={11} /></Button>
                </div>
                <Input value={step.title} onChange={e => { const steps = [...d.steps]; steps[i] = { ...step, title: e.target.value }; set("steps", steps); }} className="h-7 text-xs" placeholder="Title" />
                <Textarea value={step.description || ""} onChange={e => { const steps = [...d.steps]; steps[i] = { ...step, description: e.target.value }; set("steps", steps); }} className="text-xs min-h-[56px]" placeholder="Description" />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => set("steps", [...(d.steps || []), { id: nanoid(4), title: "New Step", description: "" }])}>
              <Plus size={12} className="mr-1" /> Add Step
            </Button>
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}

          {block.type === "video" && <>
            <TextProp label="Headline (optional)" field="headline" data={d} onChange={onChange} />
            <TextProp label="Video URL" field="videoUrl" data={d} onChange={onChange} placeholder="YouTube / Vimeo URL…" />
            <SelectProp label="Video Type" field="videoType" data={d} onChange={onChange} options={[{ value: "youtube", label: "YouTube" }, { value: "vimeo", label: "Vimeo" }, { value: "direct", label: "Direct URL" }]} />
            <NumberProp label="Max Width (px)" field="maxWidth" data={d} onChange={onChange} min={200} max={1600} />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}

          {block.type === "image" && <>
            <ImageUploadProp label="Image" field="imageUrl" data={d} onChange={onChange} orgId={orgId} />
            <TextProp label="Alt Text" field="imageAlt" data={d} onChange={onChange} />
            <TextProp label="Caption" field="caption" data={d} onChange={onChange} />
            <TextProp label="Link URL (optional)" field="linkUrl" data={d} onChange={onChange} placeholder="https://…" />
            <SelectProp label="Width" field="width" data={d} onChange={onChange} options={[{ value: "full", label: "Full width" }, { value: "wide", label: "Wide (80%)" }, { value: "medium", label: "Medium (60%)" }, { value: "small", label: "Small (40%)" }]} />
            <SelectProp label="Alignment" field="alignment" data={d} onChange={onChange} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}

          {block.type === "button" && <>
            <TextProp label="Button Text" field="text" data={d} onChange={onChange} />
            <TextProp label="Button URL" field="url" data={d} onChange={onChange} placeholder="https://…" />
            <SelectProp label="Style" field="variant" data={d} onChange={onChange} options={[{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "outline", label: "Outline" }]} />
            <SelectProp label="Size" field="size" data={d} onChange={onChange} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
            <SelectProp label="Alignment" field="alignment" data={d} onChange={onChange} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}

          {block.type === "html" && <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">HTML Code</Label>
              <Textarea value={d.html || ""} onChange={e => onChange({ ...d, html: e.target.value })} className="text-xs font-mono min-h-[160px]" placeholder="<p>Your HTML here</p>" />
            </div>
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}

          {block.type === "spacer" && <>
            <NumberProp label="Height (px)" field="height" data={d} onChange={onChange} min={10} max={400} />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}

          {block.type === "divider" && <>
            <SelectProp label="Style" field="style" data={d} onChange={onChange} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} />
            <ColorProp label="Color" field="color" data={d} onChange={onChange} />
            <NumberProp label="Thickness (px)" field="thickness" data={d} onChange={onChange} min={1} max={20} />
            <NumberProp label="Margin (px)" field="margin" data={d} onChange={onChange} min={0} max={200} />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}

          {(block.type === "course_outline" || block.type === "pricing") && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Course</Label>
              <select value={d.courseId ?? ""} onChange={e => onChange({ ...d, courseId: e.target.value ? Number(e.target.value) : null })} className="w-full h-8 text-xs border border-border rounded px-2 bg-background">
                <option value="">— Select a course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}
          {block.type === "faq" && <>
            <TextProp label="Headline" field="headline" data={d} onChange={onChange} />
            <Separator />
            <Label className="text-xs font-semibold">Questions & Answers</Label>
            {(d.items || []).map((item: any, i: number) => (
              <div key={item.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Q&A {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => set("items", d.items.filter((_: any, j: number) => j !== i))}><Trash2 size={11} /></Button>
                </div>
                <Input value={item.question} onChange={e => { const items = [...d.items]; items[i] = { ...item, question: e.target.value }; set("items", items); }} className="h-8 text-xs font-semibold" placeholder="Question" />
                <Textarea value={item.answer} onChange={e => { const items = [...d.items]; items[i] = { ...item, answer: e.target.value }; set("items", items); }} className="text-xs min-h-[56px]" placeholder="Answer" />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => set("items", [...(d.items || []), { id: nanoid(4), question: "New question?", answer: "Answer here." }])}>
              <Plus size={12} className="mr-1" /> Add Q&A
            </Button>
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
            <ColorProp label="Text Color" field="textColor" data={d} onChange={onChange} />
          </>}
          {block.type === "embed_html" && <>
            <TextProp label="Headline (optional)" field="headline" data={d} onChange={onChange} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Embed Code</Label>
              <Textarea value={d.embedCode || ""} onChange={e => onChange({ ...d, embedCode: e.target.value })} className="text-xs font-mono min-h-[120px]" placeholder='Paste embed code here (e.g. YouTube iframe, Vimeo, etc.)' />
              <p className="text-[10px] text-muted-foreground">Paste any HTML embed code — YouTube, Vimeo, Spotify, Google Maps, etc.</p>
            </div>
            <TextProp label="Max Width (px)" field="maxWidth" data={d} onChange={onChange} placeholder="800" />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}
          {block.type === "columns" && <>
            <SelectProp label="Column Layout" field="layout" data={d} onChange={onChange} options={[
              { value: "50-50", label: "50% / 50% (Equal)" },
              { value: "33-67", label: "33% / 67%" },
              { value: "67-33", label: "67% / 33%" },
              { value: "25-75", label: "25% / 75%" },
              { value: "75-25", label: "75% / 25%" },
            ]} />
            <NumberProp label="Gap (px)" field="gap" data={d} onChange={onChange} min={0} max={80} />
            <NumberProp label="Vertical Padding (px)" field="paddingY" data={d} onChange={onChange} min={0} max={200} />
            <Separator />
            <Label className="text-xs font-semibold">Left Column Content</Label>
            <Textarea value={d.leftContent || ""} onChange={e => onChange({ ...d, leftContent: e.target.value })} className="text-xs min-h-[80px]" placeholder="Enter text or HTML for left column" />
            <Separator />
            <Label className="text-xs font-semibold">Right Column Content</Label>
            <Textarea value={d.rightContent || ""} onChange={e => onChange({ ...d, rightContent: e.target.value })} className="text-xs min-h-[80px]" placeholder="Enter text or HTML for right column" />
            <Separator />
            <ColorProp label="Background Color" field="backgroundColor" data={d} onChange={onChange} />
          </>}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Sortable Canvas Block ─────────────────────────────────────────────────────

function SortableCanvasBlock({
  block,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisible,
  onChange,
}: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  onChange: (data: Record<string, any>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/block relative transition-all ${!block.visible ? "opacity-40" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Selection border */}
      <div className={`absolute inset-0 pointer-events-none z-10 transition-all ${isSelected ? "ring-2 ring-indigo-500 ring-offset-0" : "group-hover/block:ring-1 group-hover/block:ring-indigo-300"}`} />

      {/* Floating toolbar — appears on hover/select */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full z-20 flex items-center gap-0.5 bg-indigo-600 rounded-t-lg px-1 py-0.5 shadow-lg transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"}`}>
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/80 hover:text-white px-1 py-1" onClick={e => e.stopPropagation()}>
          <Move size={13} />
        </div>
        <div className="w-px h-4 bg-white/30" />
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="text-white/80 hover:text-white px-1.5 py-1 text-xs" title="Duplicate">
          <Copy size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); onToggleVisible(); }} className="text-white/80 hover:text-white px-1.5 py-1 text-xs" title={block.visible ? "Hide" : "Show"}>
          {block.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="text-red-300 hover:text-red-100 px-1.5 py-1 text-xs" title="Delete">
          <Trash2 size={12} />
        </button>
      </div>

      {/* The actual block content */}
      <div className="pointer-events-auto">
        {renderCanvasBlock(block, onChange)}
      </div>
    </div>
  );
}

// ─── Canvas Drop Zone ─────────────────────────────────────────────────────────

function CanvasDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-full transition-colors ${isOver ? "bg-indigo-50" : ""}`}
    >
      {isEmpty ? (
        <div className={`flex flex-col items-center justify-center min-h-[60vh] transition-colors ${isOver ? "bg-indigo-50" : ""}`}>
          <div className={`w-64 h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors ${isOver ? "border-indigo-400 bg-indigo-50" : "border-slate-300"}`}>
            <Layers size={32} className={isOver ? "text-indigo-400" : "text-slate-300"} />
            <div className="text-center">
              <p className={`text-sm font-medium ${isOver ? "text-indigo-600" : "text-slate-400"}`}>
                {isOver ? "Drop to add section" : "Drag elements here"}
              </p>
              <p className="text-xs text-slate-400 mt-1">or click an element in the left panel</p>
            </div>
          </div>
        </div>
      ) : children}
    </div>
  );
}

// ─── Draggable Element Tile (sidebar) ─────────────────────────────────────────

function ElementTile({ type, label, icon: Icon, onAdd }: { type: BlockType; label: string; icon: React.ComponentType<any>; onAdd: (type: BlockType) => void }) {
  const id = `tile-${type}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { isElementTile: true, blockType: type },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(type)}
      className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all group cursor-grab active:cursor-grabbing text-center ${isDragging ? "opacity-50 border-indigo-400" : ""}`}
      title={`Add ${label}`}
    >
      <Icon size={20} className="text-muted-foreground group-hover:text-indigo-500 transition-colors" />
      <span className="text-[11px] font-medium leading-tight text-muted-foreground group-hover:text-indigo-700">{label}</span>
    </button>
  );
}

// ─── Sortable Block List Item (left sidebar) ─────────────────────────────────
function SortableBlockListItem({
  block,
  label,
  subtitle,
  isSelected,
  onSelect,
}: {
  block: Block;
  label: string;
  subtitle: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-2 mx-1 my-0.5 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? "bg-teal-50 border border-teal-400"
          : "hover:bg-slate-50 border border-transparent"
      } ${!block.visible ? "opacity-40" : ""}`}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </div>
      {/* Block info */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${isSelected ? "text-teal-800" : "text-foreground"}`}>
          {label}
        </p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main WysiwygPageBuilder Component ────────────────────────────────────────

export interface WysiwygPageBuilderProps {
  initialBlocks?: Block[];
  onChange?: (blocks: Block[]) => void;
  onSave?: (blocks: Block[]) => void;
  isSaving?: boolean;
  pageType?: string;
  courses?: { id: number; title: string }[];
  orgId?: number;
}

// Helper to get a subtitle/summary for a block in the left panel list
function getBlockSubtitle(block: Block): string {
  const d = block.data ?? {};
  if (d.headline) return d.headline.substring(0, 30) + (d.headline.length > 30 ? "…" : "");
  if (d.text) return d.text.substring(0, 30) + (d.text.length > 30 ? "…" : "");
  if (d.body) return d.body.substring(0, 30) + (d.body.length > 30 ? "…" : "");
  if (d.ctaText) return d.ctaText;
  return "";
}

export function WysiwygPageBuilder({ initialBlocks = [], onChange, onSave, isSaving = false, pageType, courses = [], orgId = 0 }: WysiwygPageBuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Sections");

  // Undo/Redo
  const historyRef = useRef<Block[][]>([initialBlocks]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const updateBlocks = useCallback((newBlocks: Block[], skipHistory = false) => {
    setBlocks(newBlocks);
    onChange?.(newBlocks);
    if (!skipHistory) {
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
    onChange?.(prev);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, [onChange]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const next = historyRef.current[historyIdxRef.current];
    setBlocks(next);
    onChange?.(next);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, [onChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const addBlock = (type: BlockType) => {
    const newBlock: Block = { id: nanoid(8), type, visible: true, data: resolveBlockDefaults(type) };
    const newBlocks = [...blocks, newBlock];
    updateBlocks(newBlocks);
    setSelectedId(newBlock.id);
    setShowElementLibrary(false);
    // Scroll to bottom of canvas
    setTimeout(() => {
      document.getElementById("wysiwyg-canvas")?.scrollTo({ top: 99999, behavior: "smooth" });
    }, 50);
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

    // Case 1: ElementTile dragged from sidebar — add a new block
    if (active.data.current?.isElementTile) {
      const blockType = active.data.current.blockType as BlockType;
      if (over) {
        const targetIdx = blocks.findIndex(b => b.id === over.id);
        const defaults = resolveBlockDefaults(blockType);
        const newBlock: Block = { id: nanoid(8), type: blockType, data: defaults, visible: true };
        if (targetIdx !== -1) {
          const updated = [...blocks];
          updated.splice(targetIdx, 0, newBlock);
          updateBlocks(updated);
        } else {
          updateBlocks([...blocks, newBlock]);
        }
        setSelectedId(newBlock.id);
        setShowElementLibrary(false);
      }
      return;
    }

    // Case 2: Reorder existing blocks (from block list sidebar)
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex(b => b.id === active.id);
    const newIdx = blocks.findIndex(b => b.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      updateBlocks(arrayMove(blocks, oldIdx, newIdx));
    }
  };

  const selectedBlock = blocks.find(b => b.id === selectedId);
  const categoryElements = ELEMENT_LIBRARY.filter(e => e.category === activeCategory);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
    <div className="flex h-full bg-slate-100 overflow-hidden">
      {/* ── Left Sidebar: Block List + Element Library ────────────────────── */}
      <div className="flex flex-col bg-white border-r border-border shrink-0 w-64">
        {/* Sidebar header with block count */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Blocks ({blocks.length})</span>
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={!canUndo} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
              <Undo2 size={12} />
            </button>
            <button onClick={redo} disabled={!canRedo} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
              <Redo2 size={12} />
            </button>
          </div>
        </div>

        {/* Block list - sortable */}
        <ScrollArea className="flex-1">
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="py-1">
              {blocks.map(block => {
                const libEntry = ELEMENT_LIBRARY.find(e => e.type === block.type);
                const subtitle = getBlockSubtitle(block);
                return (
                  <SortableBlockListItem
                    key={block.id}
                    block={block}
                    label={libEntry?.label || block.type}
                    subtitle={subtitle}
                    isSelected={selectedId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
          {blocks.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Layers size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">No blocks yet</p>
              <p className="text-xs opacity-60">Add elements below</p>
            </div>
          )}
        </ScrollArea>

        {/* Element Library Section (bottom of sidebar) */}
        <div className="border-t border-border">
          {/* Category tabs as horizontal pills */}
          <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setShowElementLibrary(true); }}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  activeCategory === cat && showElementLibrary
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-muted-foreground hover:bg-slate-200 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Element tiles grid */}
          {showElementLibrary && (
            <div className="px-2 pb-2 grid grid-cols-2 gap-1.5 max-h-40 overflow-auto">
              {categoryElements.map(item => (
                <ElementTile
                  key={item.type}
                  type={item.type}
                  label={item.label}
                  icon={item.icon}
                  onAdd={addBlock}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Live Content Preview ──────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          id="wysiwyg-canvas"
          className="h-full overflow-auto bg-white"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          {blocks.filter(b => b.visible !== false).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Layers size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Start building your page</p>
              <p className="text-sm mt-1 opacity-60">Select elements from the left panel to add sections</p>
            </div>
          ) : (
            <div>
              {blocks.filter(b => b.visible !== false).map(block => (
                <div
                  key={block.id}
                  className={`relative cursor-pointer transition-all ${selectedId === block.id ? "ring-2 ring-teal-500 ring-inset" : "hover:ring-1 hover:ring-teal-300 hover:ring-inset"}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(block.id); }}
                >
                  {renderCanvasBlock(block, (data) => updateBlockData(block.id, data))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right Panel: Properties (overlays the preview) ─────────────── */}
        {selectedBlock && (
          <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-border shadow-xl z-30 flex flex-col animate-in slide-in-from-right-4 duration-200">
            {/* Panel header with close */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Edit: {ELEMENT_LIBRARY.find(e => e.type === selectedBlock.type)?.label || selectedBlock.type}
              </span>
              <button
                onClick={() => setSelectedId(null)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Properties content */}
            <div className="flex-1 overflow-hidden">
              <PropertiesPanel
                block={selectedBlock}
                onChange={data => updateBlockData(selectedBlock.id, data)}
                onDelete={() => deleteBlock(selectedBlock.id)}
                onDuplicate={() => duplicateBlock(selectedBlock.id)}
                onToggleVisible={() => toggleVisible(selectedBlock.id)}
                courses={courses}
                orgId={orgId}
              />
            </div>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeId && (
          <div className="bg-white rounded-lg shadow-2xl border-2 border-teal-500 p-3 opacity-90 text-sm font-medium text-teal-700">
            {(activeId as string).startsWith("tile-") ? "Drop to add section…" : "Moving block…"}
          </div>
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
}
