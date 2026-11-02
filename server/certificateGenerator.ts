/**
 * Certificate PDF Generator
 *
 * Generates a branded PDF certificate using WeasyPrint (Python) via child_process.
 * White-label logic:
 *   - pro / enterprise plans  → org logo + org colors, NO Course360 branding
 *   - free / starter / builder → org logo + org colors + "Powered by Course360™" footer
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

const execFileAsync = promisify(execFile);

export interface CertificateData {
  studentName: string;
  courseName: string;
  issuedAt: Date;
  verificationCode: string;
  // Org branding
  orgName: string;
  orgLogoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  bgStyle: "white" | "light" | "gradient" | "dark";
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureImageUrl?: string | null;
  footerText?: string | null;
  showCourse360Branding: boolean;
}

/** Plans that get full white-label (no Course360 branding) */
const WHITE_LABEL_PLANS = ["pro", "enterprise"];

export function shouldShowCourse360Branding(plan: string): boolean {
  return !WHITE_LABEL_PLANS.includes(plan);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCertificateHtml(data: CertificateData): string {
  const {
    studentName,
    courseName,
    issuedAt,
    verificationCode,
    orgName,
    orgLogoUrl,
    primaryColor,
    accentColor,
    bgStyle,
    signatureName,
    signatureTitle,
    signatureImageUrl,
    footerText,
    showCourse360Branding,
  } = data;

  const dateStr = issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Background styles
  const bgMap: Record<string, string> = {
    white: "#ffffff",
    light: "#f8fafc",
    gradient: `linear-gradient(135deg, ${primaryColor}10 0%, #ffffff 50%, ${accentColor}10 100%)`,
    dark: "#1a1a2e",
  };
  const isDark = bgStyle === "dark";
  const textColor = isDark ? "#ffffff" : "#1e293b";
  const subtextColor = isDark ? "#cbd5e1" : "#64748b";
  const bgValue = bgMap[bgStyle] ?? bgMap.white;
  const bgCss = bgStyle === "gradient"
    ? `background: ${bgValue};`
    : `background-color: ${bgValue};`;

  const logoHtml = orgLogoUrl
    ? `<img src="${escapeHtml(orgLogoUrl)}" alt="${escapeHtml(orgName)} logo" class="org-logo" />`
    : `<div class="org-name-fallback">${escapeHtml(orgName)}</div>`;

  const signatureHtml = signatureName
    ? `
    <div class="signature-block">
      ${signatureImageUrl ? `<img src="${escapeHtml(signatureImageUrl)}" alt="Signature" class="signature-img" />` : `<div class="signature-line"></div>`}
      <div class="signature-name">${escapeHtml(signatureName)}</div>
      ${signatureTitle ? `<div class="signature-title">${escapeHtml(signatureTitle)}</div>` : ""}
    </div>`
    : `<div class="signature-block"><div class="signature-line"></div><div class="signature-name">${escapeHtml(orgName)}</div></div>`;

  const teachificFooter = showCourse360Branding
    ? `<div class="teachific-badge">Powered by <strong>Course360™</strong></div>`
    : "";

  const customFooter = footerText
    ? `<div class="custom-footer">${escapeHtml(footerText)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: A4 landscape;
    margin: 0;
  }

  body {
    width: 297mm;
    height: 210mm;
    ${bgCss}
    font-family: 'Inter', sans-serif;
    color: ${textColor};
    overflow: hidden;
  }

  .certificate {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20mm 25mm;
    position: relative;
  }

  /* Decorative border */
  .border-outer {
    position: absolute;
    inset: 8mm;
    border: 2px solid ${primaryColor};
    border-radius: 4mm;
    pointer-events: none;
  }
  .border-inner {
    position: absolute;
    inset: 10mm;
    border: 1px solid ${accentColor}60;
    border-radius: 3mm;
    pointer-events: none;
  }

  /* Corner ornaments */
  .corner {
    position: absolute;
    width: 12mm;
    height: 12mm;
    border-color: ${primaryColor};
    border-style: solid;
  }
  .corner-tl { top: 6mm; left: 6mm; border-width: 2px 0 0 2px; }
  .corner-tr { top: 6mm; right: 6mm; border-width: 2px 2px 0 0; }
  .corner-bl { bottom: 6mm; left: 6mm; border-width: 0 0 2px 2px; }
  .corner-br { bottom: 6mm; right: 6mm; border-width: 0 2px 2px 0; }

  /* Header */
  .header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 6mm;
  }
  .org-logo {
    max-height: 18mm;
    max-width: 60mm;
    object-fit: contain;
    margin-bottom: 3mm;
  }
  .org-name-fallback {
    font-size: 16pt;
    font-weight: 600;
    color: ${primaryColor};
    margin-bottom: 3mm;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* Certificate title */
  .cert-title {
    font-family: 'Playfair Display', serif;
    font-size: 28pt;
    font-weight: 700;
    color: ${primaryColor};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 2mm;
  }
  .cert-subtitle {
    font-size: 10pt;
    color: ${subtextColor};
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 6mm;
  }

  /* Divider */
  .divider {
    width: 80mm;
    height: 1px;
    background: linear-gradient(to right, transparent, ${primaryColor}, transparent);
    margin-bottom: 6mm;
  }

  /* Presented to */
  .presented-to {
    font-size: 10pt;
    color: ${subtextColor};
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 2mm;
  }
  .student-name {
    font-family: 'Playfair Display', serif;
    font-size: 26pt;
    font-weight: 400;
    color: ${isDark ? "#ffffff" : "#0f172a"};
    margin-bottom: 4mm;
    text-align: center;
  }

  /* Course info */
  .completion-text {
    font-size: 10pt;
    color: ${subtextColor};
    margin-bottom: 2mm;
    text-align: center;
  }
  .course-name {
    font-size: 14pt;
    font-weight: 600;
    color: ${accentColor};
    text-align: center;
    margin-bottom: 6mm;
  }

  /* Date */
  .issue-date {
    font-size: 9pt;
    color: ${subtextColor};
    margin-bottom: 6mm;
  }

  /* Signature */
  .signature-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 4mm;
  }
  .signature-img {
    height: 12mm;
    max-width: 40mm;
    object-fit: contain;
    margin-bottom: 1mm;
  }
  .signature-line {
    width: 50mm;
    height: 1px;
    background: ${primaryColor}80;
    margin-bottom: 1mm;
  }
  .signature-name {
    font-size: 9pt;
    font-weight: 600;
    color: ${textColor};
  }
  .signature-title {
    font-size: 8pt;
    color: ${subtextColor};
  }

  /* Footer */
  .footer {
    position: absolute;
    bottom: 14mm;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 0 20mm;
  }
  .verification {
    font-size: 7pt;
    color: ${subtextColor};
    text-align: left;
  }
  .custom-footer {
    font-size: 7pt;
    color: ${subtextColor};
    text-align: center;
    flex: 1;
  }
  .teachific-badge {
    font-size: 7pt;
    color: ${subtextColor};
    text-align: right;
  }
  .teachific-badge strong {
    color: #0ea5e9;
  }
</style>
</head>
<body>
<div class="certificate">
  <!-- Decorative borders -->
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <!-- Header -->
  <div class="header">
    ${logoHtml}
  </div>

  <!-- Title -->
  <div class="cert-title">Certificate of Completion</div>
  <div class="cert-subtitle">This is to certify that</div>

  <div class="divider"></div>

  <!-- Student -->
  <div class="presented-to">has successfully completed</div>
  <div class="student-name">${escapeHtml(studentName)}</div>

  <!-- Course -->
  <div class="completion-text">the course</div>
  <div class="course-name">${escapeHtml(courseName)}</div>

  <!-- Date -->
  <div class="issue-date">Issued on ${dateStr}</div>

  <!-- Signature -->
  ${signatureHtml}

  <!-- Footer -->
  <div class="footer">
    <div class="verification">
      Certificate ID: ${escapeHtml(verificationCode)}
    </div>
    ${customFooter}
    ${teachificFooter}
  </div>
</div>
</body>
</html>`;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const id = randomBytes(8).toString("hex");
  const htmlPath = join(tmpdir(), `cert-${id}.html`);
  const pdfPath = join(tmpdir(), `cert-${id}.pdf`);

  try {
    await writeFile(htmlPath, buildCertificateHtml(data), "utf8");

    // Use WeasyPrint to render HTML → PDF
    await execFileAsync("python3", [
      "-c",
      `from weasyprint import HTML; HTML(filename='${htmlPath}').write_pdf('${pdfPath}')`,
    ], { timeout: 30000 });

    const pdfBuffer = await readFile(pdfPath);
    return pdfBuffer;
  } finally {
    // Clean up temp files
    await unlink(htmlPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}
