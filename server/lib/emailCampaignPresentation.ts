import { getOrgBaseUrl } from "./orgUrl";

export type CampaignOrganizationIdentity = {
  name: string;
  slug: string;
  customSenderName?: string | null;
  customDomain?: string | null;
  domainVerificationStatus?: string | null;
};

export function getCampaignOrganizationBrandName(org: CampaignOrganizationIdentity): string {
  return org.customSenderName?.trim() || org.name;
}

export function buildCampaignUnsubscribeUrl(
  org: CampaignOrganizationIdentity,
  token: string,
): string {
  const baseUrl = getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus);
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

function getCampaignOrganizationBaseUrl(org: CampaignOrganizationIdentity): string {
  return getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus);
}

/** Rewrites external links through the sending organization's click-tracking route. */
export function injectCampaignClickTracking(
  html: string,
  org: CampaignOrganizationIdentity,
  campaignId: number,
  recipientId: number,
): string {
  const baseUrl = getCampaignOrganizationBaseUrl(org);
  return html.replace(
    /href="(https?:\/\/[^"\s]+)"/gi,
    (match, url: string) => {
      if (url.includes("/unsubscribe") || url.includes("unsubscribe_url")) return match;
      const encoded = Buffer.from(url).toString("base64url");
      return `href="${baseUrl}/api/email/click?c=${campaignId}&r=${recipientId}&u=${encoded}"`;
    },
  );
}

/** Adds a 1px campaign open-tracking image on the sending organization's base URL. */
export function injectCampaignOpenPixel(
  html: string,
  org: CampaignOrganizationIdentity,
  campaignId: number,
  recipientId: number,
): string {
  const baseUrl = getCampaignOrganizationBaseUrl(org);
  const pixel = `<img src="${baseUrl}/api/email/open?c=${campaignId}&r=${recipientId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  return html.includes("</body>") ? html.replace("</body>", `${pixel}</body>`) : html + pixel;
}

function wrapOrganizationCampaignHtml(htmlBody: string, orgName: string): string {
  if (htmlBody.trim().toLowerCase().startsWith("<!doctype") || htmlBody.trim().toLowerCase().startsWith("<html")) {
    return htmlBody;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${orgName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-wrapper { width: 100%; background-color: #f0f4f8; padding: 32px 16px; box-sizing: border-box; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .email-header { background-color: #0e1e2e; padding: 20px 32px; text-align: center; }
    .email-header .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff; }
    .email-body { padding: 32px; color: #1a202c; font-size: 15px; line-height: 1.6; }
    .email-body h1, .email-body h2, .email-body h3 { color: #0e1e2e; margin-top: 0; }
    .email-body a { color: #189aa1; }
    .email-body img { max-width: 100%; height: auto; display: block; }
    @media only screen and (max-width: 600px) {
      .email-body { padding: 20px 16px; }
      .email-header { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <span class="brand">${orgName}</span>
      </div>
      <div class="email-body">
        ${htmlBody}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function injectCampaignUnsubscribeFooter(htmlBody: string, unsubscribeUrl: string, orgName: string): string {
  const footerBlock = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
        You are receiving this email from ${orgName}.<br/>
        <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;" target="_blank" rel="noopener noreferrer">Unsubscribe</a>
      </p>
    </div>`;
  return htmlBody.includes("</body>")
    ? htmlBody.replace("</body>", `${footerBlock}</body>`)
    : htmlBody + footerBlock;
}

/** Creates the final organization-branded campaign HTML sent to a single recipient. */
export function composeCampaignEmailHtml(
  htmlBody: string,
  org: CampaignOrganizationIdentity,
  campaignId: number,
  recipientId: number,
  unsubscribeToken: string,
): string {
  const brandName = getCampaignOrganizationBrandName(org);
  const wrapped = wrapOrganizationCampaignHtml(htmlBody, brandName);
  const withFooter = injectCampaignUnsubscribeFooter(
    wrapped,
    buildCampaignUnsubscribeUrl(org, unsubscribeToken),
    brandName,
  );
  return injectCampaignOpenPixel(
    injectCampaignClickTracking(withFooter, org, campaignId, recipientId),
    org,
    campaignId,
    recipientId,
  );
}
