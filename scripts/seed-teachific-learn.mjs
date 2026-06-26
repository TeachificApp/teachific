import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const db = await mysql.createConnection(DATABASE_URL);

const TEACHIFIC_ORG_SLUG = "teach";
const DEFAULT_PRIMARY = "#179ca3";

const tutorials = [
  {
    slug: "create-your-first-course",
    title: "Create Your First Course",
    subtitle: "Build a course, add lessons, publish, and preview the learner experience.",
    lessons: [
      {
        title: "Create the course shell",
        html: `
          <h2>Create a course</h2>
          <ol>
            <li>Open <strong>LMS Management</strong> from the main Teachific app.</li>
            <li>Select <strong>Courses</strong>, then click <strong>New Course</strong>.</li>
            <li>Add a title, description, cover image, and pricing settings.</li>
            <li>Save as draft while you build the curriculum.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> LMS Management > Courses list with the New Course button highlighted.</p>
        `,
      },
      {
        title: "Add sections and lessons",
        html: `
          <h2>Add curriculum content</h2>
          <ol>
            <li>Open the course and go to <strong>Curriculum</strong>.</li>
            <li>Create sections for modules or weeks.</li>
            <li>Add text, video, download, quiz, and embed lessons.</li>
            <li>Use preview mode to confirm the lesson flow.</li>
          </ol>
          <p><strong>Tip:</strong> Keep each lesson short and focused on one outcome.</p>
          <p><strong>Screenshot to add:</strong> Curriculum editor with a section expanded and lesson block editor open.</p>
        `,
      },
      {
        title: "Publish and test",
        html: `
          <h2>Publish safely</h2>
          <ol>
            <li>Review course settings, access, pricing, and completion requirements.</li>
            <li>Use the preview link before switching status to public.</li>
            <li>Enroll a test member to verify emails, course access, and certificates.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Course settings status selector and public preview link.</p>
        `,
      },
    ],
  },
  {
    slug: "build-a-funnel",
    title: "Build a Funnel",
    subtitle: "Create a landing page, collect leads, and route visitors to checkout.",
    lessons: [
      {
        title: "Create a funnel and pages",
        html: `
          <h2>Create your funnel</h2>
          <ol>
            <li>Open <strong>Marketing</strong> then <strong>Funnels</strong>.</li>
            <li>Create a funnel for your offer.</li>
            <li>Add landing, checkout, upsell, and thank-you pages as needed.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Funnel builder flow diagram with page nodes.</p>
        `,
      },
      {
        title: "Add forms and checkout",
        html: `
          <h2>Convert visitors</h2>
          <ol>
            <li>Add lead forms for free resources or waitlists.</li>
            <li>Add embedded checkout for paid courses, downloads, or memberships.</li>
            <li>Use order bumps to present optional add-ons.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Funnel page editor with form and embedded checkout blocks.</p>
        `,
      },
    ],
  },
  {
    slug: "use-teachific-studio",
    title: "Use Teachific Studio",
    subtitle: "Record, edit, and publish training videos for your organization.",
    lessons: [
      {
        title: "Record and edit a lesson video",
        html: `
          <h2>Record content quickly</h2>
          <ol>
            <li>Open <strong>Teachific Studio</strong> from the app menu.</li>
            <li>Record screen, camera, or both.</li>
            <li>Trim mistakes, add captions, and export the final clip.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Studio recording screen with timeline editor.</p>
        `,
      },
      {
        title: "Publish video into a lesson",
        html: `
          <h2>Publish to a course</h2>
          <ol>
            <li>Choose the destination organization and course.</li>
            <li>Select or create a lesson.</li>
            <li>Publish and preview the lesson player.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Publish dialog showing course and lesson destination.</p>
        `,
      },
    ],
  },
  {
    slug: "build-a-quiz",
    title: "Build a Quiz",
    subtitle: "Create quizzes manually, from the question bank, or with AI assistance.",
    lessons: [
      {
        title: "Create quiz questions",
        html: `
          <h2>Build questions</h2>
          <ol>
            <li>Open the lesson editor and add a quiz block.</li>
            <li>Create multiple choice or true/false questions.</li>
            <li>Add explanations and media where helpful.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Quiz block editor with a question and answer choices.</p>
        `,
      },
      {
        title: "Use the question bank",
        html: `
          <h2>Reuse questions</h2>
          <ol>
            <li>Open <strong>Question Bank</strong> in LMS Management.</li>
            <li>Create reusable questions with explanations.</li>
            <li>Insert them into lesson quizzes when building lessons.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Question bank list and insert-from-bank picker.</p>
        `,
      },
    ],
  },
  {
    slug: "create-an-email-campaign",
    title: "Create an Email Campaign",
    subtitle: "Send announcements, nurture leads, and track engagement.",
    lessons: [
      {
        title: "Create and send a campaign",
        html: `
          <h2>Create an email campaign</h2>
          <ol>
            <li>Open <strong>Marketing</strong> then <strong>Email Campaigns</strong>.</li>
            <li>Create a campaign, choose recipients, and write your message.</li>
            <li>Send a test before sending to learners or leads.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Email campaign editor with recipient selector and test-send button.</p>
        `,
      },
      {
        title: "Review analytics",
        html: `
          <h2>Measure engagement</h2>
          <ol>
            <li>Open campaign analytics after sending.</li>
            <li>Review delivered, opened, clicked, and failed counts.</li>
            <li>Use engagement data to improve subject lines and content.</li>
          </ol>
          <p><strong>Screenshot to add:</strong> Campaign analytics modal with KPI cards and recipient table.</p>
        `,
      },
    ],
  },
  {
    slug: "teachific-platform-faq",
    title: "Teachific Platform FAQ",
    subtitle: "Common answers for org admins and super admins.",
    lessons: [
      {
        title: "Account and access FAQs",
        html: `
          <h2>Account and access</h2>
          <h3>Who can access Teachific Learn?</h3>
          <p>Teachific Learn is for organization admins, organization super admins, site admins, and site owners.</p>
          <h3>Can learners sign up directly for Teachific Learn?</h3>
          <p>No. Learners access their own organization's school. Teachific Learn is not a public signup LMS.</p>
          <h3>Where do org admins land after login?</h3>
          <p>Org admins land on their organization subdomain dashboard. Teachific Learn is opened from a direct menu link.</p>
        `,
      },
      {
        title: "Course and product FAQs",
        html: `
          <h2>Courses and products</h2>
          <h3>Where do I manage my organization's courses?</h3>
          <p>Use <strong>LMS Management</strong> in the main Teachific app.</p>
          <h3>Why don't my org courses show in the top-level Teachific course section?</h3>
          <p>The top-level Teachific course area is reserved for Teachific tutorial content. Your org content is managed in your admin area and displayed in your organization school.</p>
          <h3>Can I hide a course from the public library?</h3>
          <p>Yes. Disable <strong>Show in Education Library</strong> in course settings while keeping direct access available.</p>
        `,
      },
      {
        title: "Billing, imports, and integrations FAQs",
        html: `
          <h2>Billing and integrations</h2>
          <h3>Where do I connect Thinkific, Teachable, or Kajabi?</h3>
          <p>Open <strong>Integrations</strong> and connect the platform for your own organization.</p>
          <h3>Is Thinkific required for Teachific to work?</h3>
          <p>No. Thinkific import is optional and org-scoped.</p>
          <h3>Where do I manage billing?</h3>
          <p>Use the Billing area in the main app, or contact Teachific support for enterprise plan changes.</p>
        `,
      },
    ],
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function textBlock(html) {
  return JSON.stringify([
    {
      id: `text-${Math.random().toString(36).slice(2, 10)}`,
      type: "text",
      visible: true,
      data: {
        html,
        align: "left",
        bgColor: "#ffffff",
        textColor: "#111827",
      },
    },
  ]);
}

async function getTeachOrg() {
  const [rows] = await db.execute("SELECT id, ownerId FROM organizations WHERE slug = ? LIMIT 1", [TEACHIFIC_ORG_SLUG]);
  if (rows.length === 0) {
    throw new Error("Teachific org with slug 'teach' was not found. Create it before seeding tutorials.");
  }
  return rows[0];
}

async function upsertCourse(orgId, ownerId, tutorial, order) {
  const [existingRows] = await db.execute(
    "SELECT id FROM lms_courses WHERE orgId = ? AND slug = ? LIMIT 1",
    [orgId, tutorial.slug],
  );

  if (existingRows.length > 0) {
    const courseId = existingRows[0].id;
    await db.execute(
      `UPDATE lms_courses
       SET title = ?, subtitle = ?, description = ?, status = 'public', type = 'course',
           price = '0', is_free = 1, pricing_type = 'free', show_in_library = 1,
           primary_color = ?, accent_color = ?, library_order = ?, updated_at = NOW()
       WHERE id = ?`,
      [tutorial.title, tutorial.subtitle, tutorial.subtitle, DEFAULT_PRIMARY, DEFAULT_PRIMARY, order, courseId],
    );
    return courseId;
  }

  const [result] = await db.execute(
    `INSERT INTO lms_courses
     (orgId, slug, title, subtitle, description, status, type, price, is_free,
      pricing_type, show_in_library, primary_color, accent_color, created_by_user_id,
      library_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'public', 'course', '0', 1, 'free', 1, ?, ?, ?, ?, NOW(), NOW())`,
    [orgId, tutorial.slug, tutorial.title, tutorial.subtitle, tutorial.subtitle, DEFAULT_PRIMARY, DEFAULT_PRIMARY, ownerId, order],
  );
  return result.insertId;
}

async function replaceCourseLessons(orgId, courseId, tutorial) {
  await db.execute("DELETE FROM lms_lessons WHERE course_id = ?", [courseId]);
  await db.execute("DELETE FROM lms_sections WHERE course_id = ?", [courseId]);

  const [sectionResult] = await db.execute(
    "INSERT INTO lms_sections (orgId, course_id, title, position, is_preview, drip_days, created_at) VALUES (?, ?, 'Tutorials', 0, 0, 0, NOW())",
    [orgId, courseId],
  );
  const sectionId = sectionResult.insertId;

  for (let i = 0; i < tutorial.lessons.length; i++) {
    const lesson = tutorial.lessons[i];
    await db.execute(
      `INSERT INTO lms_lessons
       (orgId, course_id, section_id, title, type, content, position, content_blocks,
        is_preview, preview_mode, drip_days, require_video_completion, comments_enabled,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, 'text', ?, ?, ?, 0, 'none', 0, 0, 0, NOW(), NOW())`,
      [orgId, courseId, sectionId, lesson.title, lesson.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), i, textBlock(lesson.html)],
    );
  }
}

async function upsertLandingPage(courseId, tutorial) {
  const blocks = JSON.stringify([
    {
      id: "hero",
      type: "hero",
      visible: true,
      data: {
        headline: tutorial.title,
        subheadline: tutorial.subtitle,
        bgType: "color",
        bgColor: DEFAULT_PRIMARY,
        textColor: "#ffffff",
        align: "center",
        buttons: [{ text: "Start Tutorial", color: "#ffffff", textColor: DEFAULT_PRIMARY, link: "", style: "filled" }],
        showButtons: true,
      },
    },
    {
      id: "curriculum",
      type: "curriculum_auto",
      visible: true,
      data: {
        headline: "What you'll learn",
        bgColor: "#ffffff",
      },
    },
  ]);

  await db.execute(
    `INSERT INTO lms_landing_pages (course_id, hero_title, hero_subtitle, cta_text, is_custom, blocks, updated_at)
     VALUES (?, ?, ?, 'Start Tutorial', 1, ?, NOW())
     ON DUPLICATE KEY UPDATE hero_title = VALUES(hero_title), hero_subtitle = VALUES(hero_subtitle),
       cta_text = VALUES(cta_text), is_custom = VALUES(is_custom), blocks = VALUES(blocks), updated_at = NOW()`,
    [courseId, tutorial.title, tutorial.subtitle, blocks],
  );
}

const teachOrg = await getTeachOrg();
const ownerId = teachOrg.ownerId || 1;

for (let i = 0; i < tutorials.length; i++) {
  const tutorial = tutorials[i];
  tutorial.slug = tutorial.slug || slugify(tutorial.title);
  const courseId = await upsertCourse(teachOrg.id, ownerId, tutorial, i + 1);
  await replaceCourseLessons(teachOrg.id, courseId, tutorial);
  await upsertLandingPage(courseId, tutorial);
  console.log(`Seeded ${tutorial.title}`);
}

await db.end();
