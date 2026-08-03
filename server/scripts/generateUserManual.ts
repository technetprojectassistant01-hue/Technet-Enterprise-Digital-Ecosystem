/**
 * Generates the end-user manual for the Technet Enterprise Digital Ecosystem
 * as a branded PDF.
 *
 * Run from the repo root:  npm run manual -w server
 *
 * Rendering happens in two passes. The first pass lays out the body with no
 * table of contents so we learn which page each heading lands on; the second
 * pass reserves the right number of contents pages up front and re-renders.
 * Because the body layout is deterministic, every page number in the finished
 * contents is exact.
 */
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { Writable } from "node:stream";
import path from "node:path";
import { COMPANY } from "../src/lib/pdf/company";
import { LOGO_ICON_BASE64 } from "../src/lib/pdf/assets/logo";

const LOGO = Buffer.from(LOGO_ICON_BASE64, "base64");

const OUT_PATH = path.resolve(__dirname, "../../docs/Technet-Digital-User-Manual.pdf");

const MARGIN = 56;
const ACCENT = "#0891b2";
const ACCENT_DARK = "#0e7490";
const INK = "#111827";
const MUTED = "#4b5563";
const RULE = "#d1d5db";
const BAND = "#f1f5f9";

const VERSION = "1.0";
const RELEASED = "August 2026";

interface TocEntry {
  level: 1 | 2;
  label: string;
  page: number;
}

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

class Manual {
  readonly doc: PDFKit.PDFDocument;
  readonly toc: TocEntry[] = [];
  pageIndex = -1;
  private chapter = 0;
  private section = 0;

  constructor(private readonly tocPages: number) {
    this.doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: "Technet Enterprise Digital Ecosystem — User Manual",
        Author: COMPANY.name,
        Subject: "User manual for the Technet ERP and Operations platform",
      },
    });
    this.doc.on("pageAdded", () => {
      this.pageIndex += 1;
    });
  }

  get left() {
    return MARGIN;
  }
  get right() {
    return this.doc.page.width - MARGIN;
  }
  get width() {
    return this.right - this.left;
  }
  get bottom() {
    return this.doc.page.height - MARGIN;
  }

  newPage() {
    this.doc.addPage();
    this.doc.x = this.left;
    this.doc.y = MARGIN;
  }

  /** Adds a page only when `height` will not fit in what remains of this one. */
  ensure(height: number) {
    if (this.doc.y + height > this.bottom) this.newPage();
  }

  /* ---- headings ---- */

  h1(label: string) {
    this.chapter += 1;
    this.section = 0;
    this.newPage();
    const y = this.doc.y;

    this.doc.rect(this.left, y, this.width, 34).fill(ACCENT);
    this.doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`CHAPTER ${this.chapter}`, this.left + 12, y + 7, { width: this.width - 24 });
    this.doc.fontSize(15).text(label, this.left + 12, y + 17, { width: this.width - 24 });

    this.doc.fillColor(INK).x = this.left;
    this.doc.y = y + 50;
    this.toc.push({ level: 1, label: `${this.chapter}. ${label}`, page: this.pageIndex });
    return this;
  }

  h2(label: string) {
    this.section += 1;
    const number = `${this.chapter}.${this.section}`;
    this.ensure(56);
    this.doc.y += 6;
    const y = this.doc.y;

    this.doc
      .fillColor(ACCENT_DARK)
      .font("Helvetica-Bold")
      .fontSize(12.5)
      .text(`${number}  ${label}`, this.left, y, { width: this.width });
    this.doc
      .moveTo(this.left, this.doc.y + 3)
      .lineTo(this.right, this.doc.y + 3)
      .strokeColor(RULE)
      .lineWidth(0.75)
      .stroke();

    this.doc.fillColor(INK).x = this.left;
    this.doc.y += 12;
    this.toc.push({ level: 2, label: `${number}  ${label}`, page: this.pageIndex });
    return this;
  }

  h3(label: string) {
    this.ensure(38);
    this.doc.y += 5;
    this.doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(label, this.left, this.doc.y, { width: this.width });
    this.doc.x = this.left;
    this.doc.y += 4;
    return this;
  }

  /* ---- body ---- */

  p(text: string) {
    this.ensure(28);
    this.doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(9.5)
      .text(text, this.left, this.doc.y, { width: this.width, align: "left", lineGap: 2.2 });
    this.doc.x = this.left;
    this.doc.y += 8;
    return this;
  }

  /** Small caption line, e.g. where a screen lives in the navigation. */
  where(text: string) {
    this.ensure(24);
    this.doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .text(text, this.left, this.doc.y, { width: this.width });
    this.doc.fillColor(INK).x = this.left;
    this.doc.y += 7;
    return this;
  }

  bullets(items: string[]) {
    const indent = 14;
    for (const item of items) {
      // heightOfString measures with whatever font is currently active, so set
      // the body font before measuring or a preceding heading inflates the row.
      this.doc.font("Helvetica").fontSize(9.5);
      const h = this.doc.heightOfString(item, { width: this.width - indent, lineGap: 1.6 });
      this.ensure(h + 6);
      const y = this.doc.y;
      this.doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9.5).text("•", this.left + 3, y);
      this.doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(9.5)
        .text(item, this.left + indent, y, { width: this.width - indent, lineGap: 1.6 });
      this.doc.x = this.left;
      this.doc.y = y + h + 4;
    }
    this.doc.y += 4;
    return this;
  }

  steps(items: string[]) {
    const indent = 20;
    items.forEach((item, i) => {
      this.doc.font("Helvetica").fontSize(9.5);
      const h = this.doc.heightOfString(item, { width: this.width - indent, lineGap: 1.6 });
      this.ensure(h + 8);
      const y = this.doc.y;
      this.doc
        .fillColor(ACCENT_DARK)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(`${i + 1}.`, this.left + 2, y, { width: indent - 6 });
      this.doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(9.5)
        .text(item, this.left + indent, y, { width: this.width - indent, lineGap: 1.6 });
      this.doc.x = this.left;
      this.doc.y = y + h + 5;
    });
    this.doc.y += 4;
    return this;
  }

  note(title: string, text: string) {
    const inner = this.width - 26;
    this.doc.font("Helvetica").fontSize(9);
    const h = this.doc.heightOfString(text, { width: inner, lineGap: 1.6 }) + 30;
    this.ensure(h + 10);
    const y = this.doc.y;

    this.doc.rect(this.left, y, this.width, h).fill(BAND);
    this.doc.rect(this.left, y, 3.5, h).fill(ACCENT);
    this.doc
      .fillColor(ACCENT_DARK)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(title.toUpperCase(), this.left + 14, y + 8, { width: inner });
    this.doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(9)
      .text(text, this.left + 14, y + 20, { width: inner, lineGap: 1.6 });

    this.doc.x = this.left;
    this.doc.y = y + h + 12;
    return this;
  }

  table(
    columns: { header: string; fraction: number; align?: "left" | "right" }[],
    rows: string[][],
  ) {
    const widths = columns.map((c) => c.fraction * this.width);
    const pad = 6;

    const header = () => {
      this.ensure(24);
      const y = this.doc.y;
      this.doc.rect(this.left, y, this.width, 20).fill(ACCENT);
      this.doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
      let x = this.left;
      columns.forEach((col, i) => {
        this.doc.text(col.header.toUpperCase(), x + pad, y + 6.5, {
          width: widths[i] - pad * 2,
          align: col.align ?? "left",
          lineBreak: false,
        });
        x += widths[i];
      });
      this.doc.fillColor(INK).x = this.left;
      this.doc.y = y + 20;
    };

    header();

    rows.forEach((row, index) => {
      this.doc.font("Helvetica").fontSize(8.5);
      const cellHeights = row.map((cell, i) =>
        this.doc.heightOfString(cell, { width: widths[i] - pad * 2, lineGap: 1.2 }),
      );
      const rowHeight = Math.max(...cellHeights) + 10;

      if (this.doc.y + rowHeight > this.bottom) {
        this.newPage();
        header();
      }

      const y = this.doc.y;
      if (index % 2 === 1) this.doc.rect(this.left, y, this.width, rowHeight).fill(BAND);

      let x = this.left;
      this.doc.fillColor(INK).font("Helvetica").fontSize(8.5);
      row.forEach((cell, i) => {
        this.doc.text(cell, x + pad, y + 5, {
          width: widths[i] - pad * 2,
          align: columns[i].align ?? "left",
          lineGap: 1.2,
        });
        x += widths[i];
      });

      this.doc
        .moveTo(this.left, y + rowHeight)
        .lineTo(this.right, y + rowHeight)
        .strokeColor(RULE)
        .lineWidth(0.5)
        .stroke();

      this.doc.x = this.left;
      this.doc.y = y + rowHeight;
    });

    this.doc.y += 12;
    return this;
  }

  /* ---- front matter ---- */

  cover() {
    this.newPage();
    const doc = this.doc;
    const centreY = 150;

    doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);

    doc.image(LOGO, this.left, centreY, { width: 90 });

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(30)
      .text("Technet Enterprise", this.left, centreY + 130, { width: this.width });
    doc.text("Digital Ecosystem", this.left, doc.y, { width: this.width });

    doc
      .fillColor(ACCENT_DARK)
      .font("Helvetica-Bold")
      .fontSize(17)
      .text("User Manual", this.left, doc.y + 12, { width: this.width });

    doc
      .moveTo(this.left, doc.y + 18)
      .lineTo(this.left + 150, doc.y + 18)
      .strokeColor(ACCENT)
      .lineWidth(2.5)
      .stroke();

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10.5)
      .text(
        "A complete guide to the ERP and Field Operations platform — for every role, from first sign-in to day-to-day work.",
        this.left,
        doc.y + 34,
        { width: this.width * 0.8, lineGap: 3 },
      );

    const footY = doc.page.height - 150;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(COMPANY.name, this.left, footY, { width: this.width });
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(COMPANY.addressLines.join(", "), this.left, doc.y + 2, { width: this.width });
    doc.text(`Tel: ${COMPANY.tel}  |  ${COMPANY.email}  |  ${COMPANY.website}`, this.left, doc.y + 1, {
      width: this.width,
    });
    doc
      .fillColor(ACCENT_DARK)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`Version ${VERSION}  ·  ${RELEASED}`, this.left, doc.y + 10, { width: this.width });

    doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill(ACCENT);
    doc.fillColor(INK);
  }

  /** Blank pages held for the contents, filled in once page numbers are known. */
  reserveTocPages(): number[] {
    const reserved: number[] = [];
    for (let i = 0; i < this.tocPages; i += 1) {
      this.newPage();
      reserved.push(this.pageIndex);
    }
    return reserved;
  }

  renderToc(pages: number[]) {
    if (!pages.length) return;
    const entryHeight = (e: TocEntry) => (e.level === 1 ? 23 : 15.5);
    const usable = this.doc.page.height - MARGIN * 2 - 46;

    let slot = 0;
    let y = 0;
    const startPage = (index: number) => {
      this.doc.switchToPage(pages[index]);
      this.doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(index === 0 ? "Contents" : "Contents (continued)", this.left, MARGIN, {
          width: this.width,
        });
      this.doc
        .moveTo(this.left, MARGIN + 24)
        .lineTo(this.right, MARGIN + 24)
        .strokeColor(ACCENT)
        .lineWidth(1.5)
        .stroke();
    };

    startPage(0);

    for (const entry of this.toc) {
      const h = entryHeight(entry);
      if (y + h > usable) {
        slot += 1;
        y = 0;
        startPage(slot);
      }
      const top = MARGIN + 46 + y;
      const indent = entry.level === 1 ? 0 : 16;
      const pageLabel = String(entry.page + 1);

      this.doc
        .fillColor(entry.level === 1 ? INK : MUTED)
        .font(entry.level === 1 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(entry.level === 1 ? 10.5 : 9.5);

      this.doc.text(entry.label, this.left + indent, top + (entry.level === 1 ? 6 : 0), {
        width: this.width - indent - 34,
        lineBreak: false,
        ellipsis: true,
      });
      this.doc.text(pageLabel, this.right - 30, top + (entry.level === 1 ? 6 : 0), {
        width: 30,
        align: "right",
        lineBreak: false,
      });

      y += h;
    }
    this.doc.fillColor(INK);
  }

  /** Running footer on every page except the cover. */
  footers() {
    const range = this.doc.bufferedPageRange();
    const total = range.count;
    for (let i = range.start + 1; i < range.start + total; i += 1) {
      this.doc.switchToPage(i);
      // Writing below the bottom margin would make PDFKit paginate instead of
      // drawing, so drop the margin for the duration of the footer.
      const savedBottom = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;
      const y = this.doc.page.height - MARGIN + 16;
      this.doc
        .moveTo(this.left, y - 8)
        .lineTo(this.right, y - 8)
        .strokeColor(RULE)
        .lineWidth(0.5)
        .stroke();
      this.doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(7.5)
        .text(`Technet Enterprise Digital Ecosystem — User Manual  ·  v${VERSION}`, this.left, y, {
          width: this.width * 0.7,
          lineBreak: false,
        });
      this.doc.text(`Page ${i + 1} of ${total}`, this.right - 90, y, {
        width: 90,
        align: "right",
        lineBreak: false,
      });
      this.doc.page.margins.bottom = savedBottom;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Content
 * ------------------------------------------------------------------ */

function writeBody(m: Manual) {
  /* ---------------- 1. About this manual ---------------- */
  m.h1("About This Manual");

  m.p(
    "This manual describes how to use the Technet Enterprise Digital Ecosystem — the internal web platform that Technet Engineering Ltd uses to run its commercial, procurement, human-resources and field-service work in one place.",
  );
  m.p(
    "It is written for the people who use the system day to day rather than for the people who maintain it. No technical background is assumed. Every procedure is described as a sequence of things you click, type and confirm on screen.",
  );

  m.h2("Who should read it");
  m.p(
    "Read the chapters that match your role. Chapters 1 to 5 are relevant to everyone; the rest can be treated as reference material you return to when a particular task comes up.",
  );
  m.table(
    [
      { header: "If you are a…", fraction: 0.32 },
      { header: "Start with", fraction: 0.68 },
    ],
    [
      ["Administrator", "Chapters 1–5, then Chapter 8 (Administration). You have access to every area of the system."],
      ["Sales Officer", "Chapters 1–5, then 6.1 Finance (customers and quotations) and 6.6 Documents."],
      ["Finance Officer", "Chapters 1–5, then 6.1 Finance in full — invoices, expenses and contracts."],
      ["Storekeeper", "Chapters 1–5, then 6.2 Procurement and 6.3 Inventory."],
      ["HR Officer", "Chapters 1–5, then 6.4 Human Resources in full."],
      ["Operations Manager", "Chapters 1–5, then 6.5 Projects and Chapter 7 (Operations) in full."],
      ["Field Technician", "Chapters 1–4, then 7.2 Daily Reports and 7.3 Intervention Reports."],
      ["Employee", "Chapters 1–4. You have read access to most records but cannot create or change them."],
    ],
  );

  m.h2("Conventions used");
  m.bullets([
    "Names of on-screen buttons, tabs, fields and menu items are written exactly as they appear, for example Add Customer or Export CSV.",
    "Numbered lists are procedures — follow them in order.",
    "Record statuses are written in capitals, for example SUBMITTED or FULLY_RECEIVED, because that is how the system displays them.",
    "Highlighted boxes flag things that are easy to get wrong, or behaviour that cannot be undone.",
  ]);
  m.note(
    "A note on permissions",
    "The system hides actions you are not allowed to perform rather than showing you a button that fails. If a procedure in this manual mentions a button you cannot see, your role does not permit that action. Chapter 5 sets out exactly who can do what.",
  );

  /* ---------------- 2. System overview ---------------- */
  m.h1("System Overview");

  m.p(
    "The Technet Enterprise Digital Ecosystem is a single web application, reached through a browser. Everything you need lives behind one sign-in: there is no separate program to install and no per-module login.",
  );
  m.p(
    "The platform is organised into modules. Two are in full service today — Technet ERP and Technet Operations — and the remainder appear in the navigation as placeholders for work that is planned but not yet released.",
  );

  m.h2("Modules");
  m.table(
    [
      { header: "Module", fraction: 0.26 },
      { header: "Status", fraction: 0.14 },
      { header: "What it covers", fraction: 0.6 },
    ],
    [
      [
        "Technet ERP",
        "Live",
        "Finance, procurement, inventory, human resources, projects and the document library. Described in Chapter 6.",
      ],
      [
        "Technet Operations",
        "Live",
        "Field service: work orders, daily work reports and intervention reports. Described in Chapter 7.",
      ],
      ["Technet Maintenance", "Planned", "Preventive-maintenance scheduling and asset history."],
      ["Technet Connect", "Planned", "Customer-facing portal for requests, quotations and document access."],
      ["Technet Workforce", "Planned", "Workforce scheduling and dispatch."],
      ["Technet Digital Marketing", "Planned", "Campaign and lead management."],
      ["Technet Insight", "Planned", "Cross-module analytics and reporting."],
      ["Security", "Planned", "Access auditing and security policy management."],
    ],
  );
  m.p(
    "Opening a planned module shows a short placeholder page. Nothing is lost or broken — the section simply has no features yet.",
  );

  m.h2("How the modules fit together");
  m.p(
    "Records are connected, so information entered once is reused elsewhere. Understanding the main links makes the system much easier to work with:",
  );
  m.bullets([
    "A customer is the anchor for quotations, invoices, contracts, projects, work orders and intervention reports.",
    "An approved purchase requisition becomes a purchase order, and receiving goods against that order raises the stock level of the matching inventory item automatically.",
    "A project links a customer and a contract to its own invoices, expenses, requisitions, work orders and assigned staff.",
    "A work order is the job instruction; the intervention report is the signed record of what was actually done on site.",
    "An employee record is the basis for leave balances, attendance, certifications and every technician assignment.",
  ]);

  m.h2("What you need");
  m.bullets([
    "A current web browser — Chrome, Edge, Firefox or Safari. Keep it up to date.",
    "A user account. Accounts are created by an administrator; you cannot register one yourself.",
    "Network access to the platform address supplied by your administrator.",
  ]);

  /* ---------------- 3. Getting started ---------------- */
  m.h1("Getting Started");

  m.h2("Signing in");
  m.steps([
    "Open your browser and go to the platform address given to you by your administrator.",
    "Enter the email address your account was created with.",
    "Enter your password.",
    "Select Sign in.",
  ]);
  m.p(
    "You arrive at the dashboard home page. If the details are wrong the system reports “Invalid email or password” without saying which of the two was incorrect — this is deliberate, so that nobody can use the login page to discover which email addresses have accounts.",
  );

  m.h2("If you forget your password");
  m.steps([
    "On the sign-in page, select Forgot password.",
    "Enter your account email address and submit the form.",
    "Check your inbox for the reset email and open the link it contains.",
    "Enter a new password of at least eight characters, confirm it, and save.",
    "Return to the sign-in page and sign in with the new password.",
  ]);
  m.note(
    "Reset links expire after one hour",
    "A reset link is valid for one hour and can only be used once. Requesting a new link cancels any earlier link that has not been used. If your link has expired, simply request another. For security the page confirms that an email has been sent whether or not the address has an account, so check the spelling of your address if nothing arrives.",
  );
  m.p(
    "Reset requests are also rate-limited: after five attempts from the same connection within fifteen minutes, further requests are refused for a short period.",
  );

  m.h2("Changing your password");
  m.where("Navigation: Settings (gear icon, top right of any module header)");
  m.steps([
    "Open Settings.",
    "In the Change password panel, type your current password.",
    "Type the new password, then type it again to confirm. It must be at least eight characters.",
    "Select Update password.",
  ]);
  m.p(
    "A confirmation message appears when the change succeeds. If your current password was mistyped the system says so and nothing is changed.",
  );

  m.h2("Your session");
  m.p(
    "Signing in starts a session that lasts eight hours, after which you are asked to sign in again. The session is held in a secure browser cookie — it is not visible to other sites and cannot be read by scripts on the page.",
  );
  m.bullets([
    "Closing the tab does not sign you out; the session continues until it expires or you sign out.",
    "If the system suddenly returns you to the sign-in page, your session has most likely expired. Sign in again and continue.",
    "Always sign out on shared or public computers.",
  ]);

  m.h2("Signing out");
  m.p(
    "Select Sign out from the user area of the dashboard. Your session ends immediately and the session cookie is cleared from the browser.",
  );

  /* ---------------- 4. Finding your way around ---------------- */
  m.h1("Finding Your Way Around");

  m.h2("The screen layout");
  m.p("Every page inside the platform shares the same three-part structure:");
  m.table(
    [
      { header: "Area", fraction: 0.24 },
      { header: "Purpose", fraction: 0.76 },
    ],
    [
      [
        "Sidebar (left)",
        "The module navigation tree. Sections such as ERP and Operations expand to reveal their pages; select the chevron to open or close a branch. The page you are on is highlighted.",
      ],
      [
        "Module header (top)",
        "Shows which module and section you are in, with tabs for the pages inside that section. The right-hand side holds notifications, a link to Settings, and your profile avatar.",
      ],
      [
        "Content area (centre)",
        "The working area: summary cards, the record list, and the forms and detail views you open from it.",
      ],
    ],
  );

  m.h2("How list pages work");
  m.p(
    "Almost every page that shows records — customers, invoices, suppliers, employees, work orders and so on — follows one pattern. Learn it once and the whole system becomes predictable.",
  );
  m.bullets([
    "Title and description at the top, with the action buttons for that page on the right.",
    "Summary cards showing counts or totals for what is currently listed.",
    "A search box. Type your text and press Enter to filter the list; clear it and press Enter to see everything again.",
    "Filter controls on pages that need them, typically a status or date-range selector.",
    "The record table itself. Where a record has more detail, its reference is a link through to the full view.",
    "A pencil icon to edit a row and a bin icon to delete it, shown only if your role allows those actions.",
  ]);

  m.h3("Exporting to CSV");
  m.p(
    "Most list pages carry an Export CSV button. It downloads exactly the rows currently shown — so if you have searched or filtered first, only the matching records are exported. The file opens directly in Excel or Google Sheets and is useful for ad-hoc reporting and reconciliation.",
  );

  m.h2("Messages, confirmations and empty states");
  m.bullets([
    "Toast messages appear briefly in the corner to confirm that a record was saved, updated or deleted, or to report that something failed.",
    "Deleting anything raises a confirmation dialog naming the record. Read it before confirming — deletions cannot be undone.",
    "A page with no records yet shows a short prompt explaining what to add first, rather than an empty table.",
    "While data is loading, a placeholder table is shown. If loading fails, an error message appears in red — refresh the page and try again.",
  ]);

  /* ---------------- 5. Roles and permissions ---------------- */
  m.h1("Roles and Permissions");

  m.p(
    "Every account carries exactly one role, set by an administrator. Your role decides which actions are available to you. Viewing is broadly open across the business — most roles can read most records — while creating, changing and deleting are restricted to the people responsible for that area.",
  );

  m.h2("The eight roles");
  m.table(
    [
      { header: "Role", fraction: 0.26 },
      { header: "Responsibility", fraction: 0.74 },
    ],
    [
      ["ADMIN", "Unrestricted. Manages user accounts and can perform every action in every module."],
      ["SALES_OFFICER", "Maintains the customer directory and prepares quotations."],
      ["FINANCE_OFFICER", "Manages invoices, expenses and contracts."],
      ["STOREKEEPER", "Manages suppliers, requisition approvals, purchase orders, goods receipts and inventory."],
      ["HR_OFFICER", "Manages employee records, leave, attendance and certifications."],
      ["OPERATIONS_MANAGER", "Manages projects, work orders, and the approval of field reports."],
      ["FIELD_TECHNICIAN", "Submits daily work reports and intervention reports from the field."],
      ["EMPLOYEE", "General read access. Can raise a purchase requisition but cannot approve or change records."],
    ],
  );

  m.h2("Who can change what");
  m.p(
    "The table below lists the roles permitted to create, edit or delete records in each area. Any signed-in user can view these areas unless stated otherwise.",
  );
  m.table(
    [
      { header: "Area", fraction: 0.3 },
      { header: "Roles that can make changes", fraction: 0.7 },
    ],
    [
      ["Customers, Quotations", "ADMIN, SALES_OFFICER"],
      ["Invoices, Expenses, Contracts", "ADMIN, FINANCE_OFFICER"],
      ["Suppliers, Purchase Orders, Inventory", "ADMIN, STOREKEEPER"],
      ["Purchase Requisitions — raising one", "Any signed-in user"],
      ["Purchase Requisitions — approve, reject, convert", "ADMIN, STOREKEEPER"],
      ["Employees, Certifications, Attendance", "ADMIN, HR_OFFICER"],
      ["Leave — including viewing", "ADMIN, HR_OFFICER only"],
      ["Projects", "ADMIN, OPERATIONS_MANAGER"],
      ["Work Orders — creating and deleting", "ADMIN, OPERATIONS_MANAGER"],
      ["Work Orders — updating progress", "ADMIN, OPERATIONS_MANAGER, FIELD_TECHNICIAN"],
      ["Daily and Intervention Reports — submitting", "ADMIN, OPERATIONS_MANAGER, FIELD_TECHNICIAN"],
      ["Daily and Intervention Reports — approving, rejecting, deleting", "ADMIN, OPERATIONS_MANAGER"],
      [
        "Documents",
        "ADMIN, SALES_OFFICER, FINANCE_OFFICER, HR_OFFICER, OPERATIONS_MANAGER",
      ],
      ["User accounts", "ADMIN only"],
    ],
  );
  m.note(
    "Leave is fully restricted",
    "Unlike other areas, the whole Leave section — types, balances and requests — is visible only to administrators and HR officers. Other roles cannot open it at all.",
  );

  /* ---------------- 6. Technet ERP ---------------- */
  m.h1("Technet ERP");

  m.p(
    "Technet ERP is the commercial and administrative core of the platform. Open it from ERP in the sidebar; the section landing page summarises activity across its areas.",
  );

  /* 6.1 Finance */
  m.h2("Finance");
  m.where("Navigation: ERP › Finance — tabs for Customers, Invoices, Expenses, Quotations and Contracts");

  m.h3("Customers");
  m.p(
    "The customer directory is the starting point for all commercial work. Every quotation, invoice, contract, project, work order and intervention report is attached to a customer, so create the customer record first.",
  );
  m.steps([
    "Open ERP › Finance › Customers.",
    "Select Add Customer.",
    "Enter the customer Name — this is the only required field.",
    "Fill in Company, Email, Phone, Address, VAT Number and BRN as far as you know them.",
    "Select Create Customer.",
  ]);
  m.p(
    "To change a customer, select the pencil icon on its row, amend the details and save. To search, type a name, company or email address in the search box and press Enter.",
  );
  m.note(
    "Deleting a customer",
    "A customer that already has quotations, invoices, projects or other linked records cannot be deleted; the system will refuse and explain why. Correct or remove the linked records first, or simply leave the customer in place.",
  );

  m.h3("Quotations");
  m.p(
    "Quotations price a piece of work for a customer. Each has a unique quotation number, a title, one or more line items and a VAT rate, which defaults to 15%.",
  );
  m.steps([
    "Open ERP › Finance › Quotations and select Add Quotation.",
    "Choose the Customer and enter a Quotation Number and Title.",
    "Set the issue date, and an expiry date if the price is time-limited.",
    "Add a line item for each item or service: description, quantity and unit price.",
    "Check the VAT rate. The subtotal, VAT amount and total are calculated for you as you type.",
    "Save the quotation. It is created with status DRAFT.",
  ]);
  m.p(
    "Open a quotation from the list to see its full detail, change its status as it progresses, or download it as a PDF on the company letterhead — complete with the standard terms of payment, delivery period, validity and warranty conditions.",
  );
  m.table(
    [
      { header: "Status", fraction: 0.22 },
      { header: "Meaning", fraction: 0.78 },
    ],
    [
      ["DRAFT", "Being prepared. Not yet issued to the customer."],
      ["SENT", "Issued to the customer and awaiting their decision."],
      ["ACCEPTED", "The customer has accepted. Work can proceed and a project or invoice can follow."],
      ["REJECTED", "The customer has declined."],
      ["EXPIRED", "The validity period has passed without acceptance."],
    ],
  );

  m.h3("Invoices");
  m.p(
    "Invoices bill the customer. An invoice can stand alone or be linked to a project so that revenue is tracked against the job. Line items, VAT and totals work exactly as they do on quotations.",
  );
  m.steps([
    "Open ERP › Finance › Invoices and select Add Invoice.",
    "Choose the Customer, and the Project if the invoice belongs to one.",
    "Enter the Invoice Number, issue date and due date.",
    "Record the customer's PO reference and any payment terms, if applicable.",
    "Add the line items, then check the VAT rate and totals.",
    "Save. The invoice is created with status DRAFT.",
  ]);
  m.p(
    "From the invoice detail page you can update the status, record the payment date, and download the invoice as a PDF carrying the company letterhead, bank details and standard conditions.",
  );
  m.table(
    [
      { header: "Status", fraction: 0.22 },
      { header: "Meaning", fraction: 0.78 },
    ],
    [
      ["DRAFT", "Being prepared. Not yet issued."],
      ["SENT", "Issued to the customer and awaiting payment."],
      ["PAID", "Settled in full. Record the payment date when you set this status."],
      ["OVERDUE", "The due date has passed and payment has not been received."],
      ["CANCELLED", "Withdrawn and no longer payable."],
    ],
  );

  m.h3("Expenses");
  m.p(
    "Expenses record money going out. Each entry has a category, an amount and a date, and can optionally be attributed to a supplier and to a project — which is what makes per-project cost reporting possible.",
  );
  m.steps([
    "Open ERP › Finance › Expenses and select Add Expense.",
    "Enter the Category, Amount and Date.",
    "Add a Description, and select the Supplier and Project where relevant.",
    "Save the expense.",
  ]);
  m.p("Use the filters to narrow the list by date range or project before exporting to CSV for a cost review.");

  m.h3("Contracts");
  m.p(
    "Contracts capture an ongoing commercial agreement with a customer — its service description, value and term. Projects can then be linked to a contract so that delivery is tracked against the agreement.",
  );
  m.steps([
    "Open ERP › Finance › Contracts and select Add Contract.",
    "Choose the Customer and describe the Service covered.",
    "Enter the contract Value and the start and end dates.",
    "Save. The contract begins at status PLANNING.",
  ]);
  m.p("Contract statuses are PLANNING, IN_PROGRESS, COMPLETED and CANCELLED. Update the status as the agreement moves through its life.");

  /* 6.2 Procurement */
  m.h2("Procurement");
  m.where("Navigation: ERP › Procurement — tabs for Suppliers, Requisitions and Purchase Orders");

  m.p(
    "Procurement runs as a chain: someone raises a requisition for what is needed, a storekeeper approves it, the approved requisition is converted into a purchase order to a supplier, and goods are receipted against that order as they arrive. Each step is recorded, so you can always see who asked for what and when it was approved.",
  );

  m.h3("Suppliers");
  m.steps([
    "Open ERP › Procurement › Suppliers and select Add Supplier.",
    "Enter the supplier Name, and the contact name, email, phone and address.",
    "Record the agreed Payment Terms.",
    "Save the supplier.",
  ]);
  m.p(
    "Suppliers can be linked to inventory items as the usual source of supply, and to expenses. A supplier with purchase orders against it cannot be deleted.",
  );

  m.h3("Purchase requisitions");
  m.p(
    "A requisition is an internal request to buy something. Any signed-in user can raise one — this is deliberate, so that staff who spot a need do not have to go through someone else to record it.",
  );
  m.steps([
    "Open ERP › Procurement › Requisitions and select New Requisition.",
    "Enter a Requisition Number and, if the purchase is for a job, select the Project.",
    "Set the Needed By date and add any notes explaining the request.",
    "Add a line for each item: description and quantity. Link the line to an existing inventory item where one exists, so that stock is updated automatically when the goods arrive.",
    "Submit. The requisition is created with status SUBMITTED.",
  ]);
  m.p(
    "An administrator or storekeeper then opens the requisition and either approves or rejects it. Every status change is stamped with who made it, when, and any note they added — visible in the status history on the requisition detail page.",
  );
  m.table(
    [
      { header: "Status", fraction: 0.22 },
      { header: "Meaning", fraction: 0.78 },
    ],
    [
      ["SUBMITTED", "Raised and waiting for a decision."],
      ["APPROVED", "Cleared for purchase. It can now be converted into a purchase order."],
      ["REJECTED", "Declined. The note on the rejection explains why."],
      ["CONVERTED", "A purchase order has been raised from it. The requisition is now closed."],
    ],
  );

  m.h3("Converting a requisition into a purchase order");
  m.steps([
    "Open the approved requisition.",
    "Select Convert to Purchase Order.",
    "Choose the Supplier and enter a PO Number.",
    "Set the Expected Date for delivery.",
    "Enter a unit cost for every line. The requisition carried quantities but not prices, so each line needs one.",
    "Confirm. The purchase order is created and the requisition moves to CONVERTED.",
  ]);
  m.note(
    "Every line needs a unit cost",
    "The conversion is refused unless each line has a unit cost greater than zero, and only a requisition at status APPROVED can be converted. If the PO number is already in use the system will tell you so and nothing is created.",
  );

  m.h3("Purchase orders");
  m.p(
    "A purchase order commits the company to buying from a supplier. Orders can be created directly as well as by conversion from a requisition.",
  );
  m.steps([
    "Open ERP › Procurement › Purchase Orders and select Add Purchase Order.",
    "Choose the Supplier and enter a PO Number.",
    "Set the order date and the expected delivery date.",
    "Add the line items with description, quantity and unit cost, linking each to an inventory item where appropriate.",
    "Save. The order begins at status DRAFT.",
    "When the order is issued to the supplier, open it and select Send. The status changes to SENT.",
  ]);
  m.table(
    [
      { header: "Status", fraction: 0.28 },
      { header: "Meaning", fraction: 0.72 },
    ],
    [
      ["DRAFT", "Being prepared. Not yet issued to the supplier."],
      ["SENT", "Issued to the supplier. Goods can now be receipted against it."],
      ["PARTIALLY_RECEIVED", "Some but not all of the ordered quantity has arrived."],
      ["FULLY_RECEIVED", "Every line has been received in full."],
      ["CLOSED", "Finished and archived."],
      ["CANCELLED", "Withdrawn. No further receipts can be recorded."],
    ],
  );

  m.h3("Receiving goods");
  m.p(
    "A goods receipt records what actually arrived. This is the step that raises stock levels, so record receipts promptly and accurately.",
  );
  m.steps([
    "Open the purchase order. It must be at status SENT or PARTIALLY_RECEIVED.",
    "Select Receive Goods.",
    "Enter the quantity received for each line. You may leave a line blank if none of it arrived.",
    "Add a note if there is anything to record about the delivery.",
    "Confirm the receipt.",
  ]);
  m.p("Three things happen at once when you confirm:");
  m.bullets([
    "A goods receipt is recorded against the order, stamped with your name and the date.",
    "For every received line linked to an inventory item, the stock quantity is increased and a stock movement of type IN is written, referencing the PO number.",
    "The order status becomes FULLY_RECEIVED if every line is now complete, or PARTIALLY_RECEIVED if any remains outstanding.",
  ]);
  m.note(
    "You cannot over-receive",
    "The system will not accept a quantity greater than the amount still outstanding on a line, and it counts everything already receipted. If a supplier genuinely delivers more than was ordered, amend the purchase order first, then record the receipt.",
  );

  /* 6.3 Inventory */
  m.h2("Inventory");
  m.where("Navigation: ERP › Inventory");

  m.p(
    "Inventory tracks stock held by the company. Each item has a unique SKU, a name, a unit of measure, a current quantity, a minimum stock level and, optionally, a category, storage location, unit cost and usual supplier.",
  );
  m.steps([
    "Open ERP › Inventory and select Add Item.",
    "Enter the SKU and Name. The SKU must be unique.",
    "Set the Unit of Measure — for example unit, metre or box.",
    "Enter the opening Quantity and the Minimum Stock Level at which the item should be reordered.",
    "Add the Category, Location, Unit Cost and Supplier if known.",
    "Save the item.",
  ]);

  m.h3("Adjusting stock");
  m.p(
    "Stock rises automatically through goods receipts. For anything else — issuing material to a job, a stock count correction, breakage or loss — record a manual adjustment.",
  );
  m.steps([
    "Open ERP › Inventory and find the item.",
    "Select Adjust Stock.",
    "Choose the movement type: IN to add, OUT to remove, or ADJUSTMENT to correct a counting error.",
    "Enter the quantity and a reason. Always give a reason — it is what makes the movement history worth reading.",
    "Confirm the adjustment.",
  ]);
  m.p(
    "Every adjustment writes a stock movement recording the type, quantity, reason, who made it and when. The item's history shows all of its movements, whether from goods receipts or manual adjustments.",
  );
  m.note(
    "Items below minimum stock",
    "Items whose quantity has fallen to or below the minimum stock level are highlighted in the list, so a glance at the page tells you what needs reordering.",
  );

  /* 6.4 HR */
  m.h2("Human Resources");
  m.where("Navigation: ERP › HR — tabs for Overview, Employees, Leave, Attendance and Certifications");

  m.p(
    "The HR area holds the employee register and everything that depends on it. Only administrators and HR officers can make changes here, and the Leave section is not visible to any other role at all.",
  );

  m.h3("Overview");
  m.p(
    "The HR overview summarises headcount, employees currently on leave, leave requests awaiting a decision, and certifications approaching expiry. Use it as the daily starting point for HR work.",
  );

  m.h3("Employees");
  m.p(
    "The employee record is the foundation for leave, attendance, certifications, project assignments and technician allocations. Create it before anything else about a person can be recorded.",
  );
  m.steps([
    "Open ERP › HR › Employees and select Add Employee.",
    "Enter the Employee Code, First Name and Last Name. The employee code must be unique.",
    "Complete the personal details: national ID, date of birth, gender, address, and contact email and phone.",
    "Record the emergency contact name, phone and relationship.",
    "Set the employment details: position, department, hire date, contract type and job grade.",
    "Add the probation end date and contract end date where they apply.",
    "Enter the payroll details — basic salary, bank name and account number — if you are responsible for them.",
    "Optionally link the employee to a system user account, so their sign-in is tied to their personnel record.",
    "Save the employee.",
  ]);
  m.p(
    "Open an employee from the list to see the full profile alongside their leave balances, attendance, certifications and assignments. Filter the list by department or employment status, and export the results to CSV.",
  );
  m.table(
    [
      { header: "Employment status", fraction: 0.24 },
      { header: "Meaning", fraction: 0.76 },
    ],
    [
      ["ACTIVE", "Currently employed and available for work."],
      ["ON_LEAVE", "Away on approved leave. The system sets this automatically while leave is running."],
      ["TERMINATED", "No longer employed. Record the exit date and reason on the profile."],
    ],
  );
  m.p(
    "Contract types available are PERMANENT, FIXED_TERM, CASUAL, INTERN and CONSULTANT.",
  );

  m.h3("Leave — types");
  m.p(
    "Leave types define what staff may take and how much of it. Set these up before recording any leave.",
  );
  m.steps([
    "Open ERP › HR › Leave and select the Leave Types tab.",
    "If you are starting from scratch, select Seed Defaults to create a standard Mauritian set: Annual (22 days), Sick (15), Maternity (98), Paternity (5) and Unpaid.",
    "To add your own, select Add Leave Type and enter a unique Code and Name.",
    "Set Days Per Year, whether the leave is Paid, and whether it Requires Documents such as a medical certificate.",
    "Save. Types can be deactivated later rather than deleted, which keeps historical records intact.",
  ]);
  m.note(
    "Seeding only works once",
    "Seed Defaults is refused if any leave type already exists, so it cannot overwrite entitlements you have already configured. Entitlement figures remain fully editable after seeding.",
  );

  m.h3("Leave — balances");
  m.p(
    "Each employee has a balance per leave type per year, made up of the days they are entitled to, any days carried over from the previous year, and the days already used.",
  );
  m.steps([
    "Open ERP › HR › Leave and select the Balances tab.",
    "Choose the year you are working with.",
    "Select Initialize Balances to create balances for all active employees from the entitlement on each leave type.",
    "Adjust any individual balance where a person's entitlement differs, or to enter carried-over days.",
  ]);

  m.h3("Leave — requests");
  m.steps([
    "Open ERP › HR › Leave and select the Requests tab.",
    "Select New Request.",
    "Choose the Employee and the Leave Type.",
    "Enter the start and end dates. The system counts the working days between them, Monday to Friday, and shows the total.",
    "Tick Half Day if the request is for half a day only.",
    "Enter the reason and save. The request is created with status PENDING.",
  ]);
  m.p("To decide a request, open it and select Approve or Reject, adding a review note. What follows depends on your decision:");
  m.bullets([
    "Approving deducts the days from the employee's balance for that leave type and year, and sets the employee to ON_LEAVE for the period.",
    "Approval is refused if the request exceeds the available balance. The message shows how many days are actually available.",
    "Rejecting leaves the balance untouched and records your note against the request.",
    "Cancelling an already-approved request returns the days to the balance.",
  ]);
  m.table(
    [
      { header: "Request status", fraction: 0.22 },
      { header: "Meaning", fraction: 0.78 },
    ],
    [
      ["PENDING", "Submitted and awaiting a decision."],
      ["APPROVED", "Granted. Days have been deducted from the balance."],
      ["REJECTED", "Declined. No days deducted."],
      ["CANCELLED", "Withdrawn. Any days already deducted have been returned."],
    ],
  );

  m.h3("Attendance");
  m.p(
    "Attendance is recorded per employee per day, with at most one record for any employee on any date. Clock times are stored as plain wall-clock values because the business runs in a single time zone, so there are no time-zone surprises.",
  );
  m.steps([
    "Open ERP › HR › Attendance.",
    "Use the Daily Register tab and select the date you are recording.",
    "For each employee set the status, and enter the clock-in and clock-out times and any break minutes.",
    "Save. Hours worked and overtime are calculated from the times and break you entered.",
  ]);
  m.p(
    "Use the bulk entry option to mark a whole group at once — for example a public holiday or a rest day. The Timesheet tab summarises hours and overtime by employee across a date range and exports to CSV for payroll.",
  );
  m.table(
    [
      { header: "Attendance status", fraction: 0.26 },
      { header: "Meaning", fraction: 0.74 },
    ],
    [
      ["PRESENT", "At work as normal."],
      ["LATE", "At work but arrived after the expected start."],
      ["ABSENT", "Not at work and not on approved leave."],
      ["ON_LEAVE", "Away on approved leave."],
      ["PUBLIC_HOLIDAY", "A public holiday — not a working day."],
      ["REST_DAY", "A scheduled non-working day."],
    ],
  );

  m.h3("Certifications");
  m.p(
    "Certifications track the qualifications your technicians must hold, and warn you before they lapse — which matters when a certificate is a condition of being allowed on a customer's site.",
  );
  m.steps([
    "Open ERP › HR › Certifications and select Add Certification.",
    "Choose the Employee and enter the certification Name.",
    "Record the category, issuing body and certificate number.",
    "Enter the issue date and, importantly, the expiry date.",
    "Attach the scanned certificate from the document library if it has been uploaded.",
    "Save.",
  ]);
  m.p(
    "The page highlights certifications that have expired or are close to expiring, so renewals can be arranged in good time. Filter by employee or by expiry window and export the result to CSV.",
  );

  /* 6.5 Projects */
  m.h2("Projects");
  m.where("Navigation: ERP › Projects");

  m.p(
    "A project is a unit of delivered work. It ties together the customer, the governing contract, the budget, the manager, the assigned staff, and everything that flows from the job — invoices, expenses, requisitions and work orders.",
  );
  m.steps([
    "Open ERP › Projects and select Add Project.",
    "Enter the project Name and Description.",
    "Select the Customer and, where one applies, the Contract.",
    "Choose the Service Category: ELECTRICAL, ELV_SECURITY, MECHANICAL, PLUMBING, SAFETY or OTHER.",
    "Set the start and end dates and the Budget.",
    "Assign a project Manager from the employee register.",
    "Save. The project begins at status QUOTED.",
  ]);

  m.h3("Managing a project");
  m.p("Open a project from the list to reach its detail page, where you can:");
  m.bullets([
    "Change its status, adding a note explaining the change. Every change is kept in the status history with the date and the person who made it.",
    "Assign employees to the project and give each a role on the job.",
    "Remove an assignment when someone leaves the team.",
    "See the invoices, expenses, requisitions and work orders raised against the project.",
  ]);
  m.table(
    [
      { header: "Project status", fraction: 0.24 },
      { header: "Meaning", fraction: 0.76 },
    ],
    [
      ["QUOTED", "Priced but not yet won. This is where every project starts."],
      ["APPROVED", "Won and authorised, but work has not begun."],
      ["IN_PROGRESS", "Work is under way."],
      ["ON_HOLD", "Paused. Record the reason in the status note."],
      ["COMPLETED", "Work finished. Final invoicing may still be outstanding."],
      ["CLOSED", "Finished, invoiced and settled."],
      ["CANCELLED", "Abandoned before completion."],
    ],
  );

  /* 6.6 Documents */
  m.h2("Documents");
  m.where("Navigation: ERP › Documents");

  m.p(
    "The document library stores files centrally so that they are not scattered across personal drives and email. Documents can be linked to a project or a customer, which is what makes them findable later.",
  );
  m.steps([
    "Open ERP › Documents and select Upload Document.",
    "Give the document a clear Title — this is what people will search on.",
    "Choose the Category: CONTRACT, INVOICE, HR, PROJECT or GENERAL.",
    "Link it to a Project or Customer where relevant.",
    "Select the file and upload it.",
  ]);
  m.p(
    "Select a document in the list to download it. Filter by category, project or customer to narrow a long list. Each entry records the file name, type, size, who uploaded it and when.",
  );
  m.note(
    "Documents and certifications",
    "A document in the library can be attached to an employee's certification record. Upload the scanned certificate here first, then link it from ERP › HR › Certifications.",
  );

  /* ---------------- 7. Operations ---------------- */
  m.h1("Technet Operations");

  m.p(
    "Technet Operations covers field service. It follows the natural shape of the work: a job is planned as a work order, technicians record what they did each day, and the formal, customer-signed account of an intervention is captured as an intervention report.",
  );
  m.where("Navigation: Operations — tabs for Work Orders, Daily Reports and Intervention Reports");

  m.h2("Work orders");
  m.p(
    "A work order is the instruction to carry out a job for a customer on a given date, with named technicians assigned to it.",
  );
  m.steps([
    "Open Operations › Work Orders and select Add Work Order.",
    "Enter a unique Work Order Number and a Title describing the job.",
    "Select the Customer, and the Project if the job belongs to one.",
    "Choose the Job Category — see the table below.",
    "Set the Scheduled Date.",
    "Describe the work to be done.",
    "Assign one or more technicians from the employee register.",
    "Save. The work order is created with status SCHEDULED.",
  ]);
  m.table(
    [
      { header: "Job category", fraction: 0.34 },
      { header: "Used for", fraction: 0.66 },
    ],
    [
      ["INSTALLATION", "Installing new equipment or systems."],
      ["START_UP_COMMISSIONING", "Bringing newly installed equipment into service."],
      ["OUTDOOR_REPAIR", "Repair work carried out on the customer's site."],
      ["WORKSHOP_REPAIR", "Repair work carried out at Technet's workshop."],
      ["SERVICING", "Routine servicing visits."],
      ["MAINTENANCE_CONTRACT", "Work performed under a maintenance agreement."],
      ["SURVEY", "Site surveys and assessments."],
      ["OTHERS", "Anything that does not fit the categories above."],
    ],
  );
  m.p(
    "Work order statuses are SCHEDULED, IN_PROGRESS, COMPLETED and CANCELLED. Technicians as well as managers can update the status as the job progresses, but only administrators and operations managers can create or delete a work order.",
  );

  m.h2("Daily work reports");
  m.p(
    "A daily report is the short, regular record of what a team did on a given day. It is deliberately lightweight — a summary, the hours, who was there and which work orders were touched.",
  );
  m.steps([
    "Open Operations › Daily Reports and select Add Daily Report.",
    "Set the Date the work was carried out.",
    "Write a Summary of what was done.",
    "Enter the Hours worked.",
    "Select the technicians who were present.",
    "Link the work orders the day's work related to.",
    "Submit. The report is created with status SUBMITTED.",
  ]);
  m.p(
    "An administrator or operations manager then reviews the report and either approves or rejects it, adding a review note. The name of the reviewer and the time of the review are recorded on the report.",
  );

  m.h2("Intervention reports");
  m.p(
    "The intervention report is the formal record of a site visit — what was found, what was done, and the customer's signature confirming it. It is the most detailed form in the system, and the one that most often ends up in front of a customer, so take care over it.",
  );
  m.p(
    "Each report is numbered automatically in the form INT-000001, with the number allocated in sequence when the report is created.",
  );

  m.h3("Completing the form");
  m.p("The form is divided into six panels, completed in order:");
  m.table(
    [
      { header: "Panel", fraction: 0.27 },
      { header: "What to record", fraction: 0.73 },
    ],
    [
      [
        "Customer & Contact",
        "The customer, the date of the visit, and the name, phone and email of the person you dealt with on site. Link the report to its work order if one exists.",
      ],
      [
        "Equipment / System",
        "Optional but valuable: the equipment worked on, its make, model and serial number, and the date it was installed.",
      ],
      [
        "Fault & Work Done",
        "The job category, the type of work, the nature of the intervention and the action taken. Confirm whether the work was completed; if not, explain what remains outstanding.",
      ],
      [
        "Technicians & Time",
        "The technicians who attended and the time in and time out for the visit.",
      ],
      [
        "Warranty & Report",
        "Whether the work is under warranty (YES, NO or UNKNOWN), the technician's report, comments and any additional information.",
      ],
      [
        "Sign & Attach",
        "The customer's signature, captured on screen, together with the name of the person signing. Attach a supporting file if you have one.",
      ],
    ],
  );

  m.h3("Capturing the signature");
  m.steps([
    "Complete every other panel first — the signature confirms what is already on the form.",
    "Hand the device to the customer's representative.",
    "Ask them to sign in the signature box using a finger or stylus.",
    "Select Clear and sign again if the signature is unclear.",
    "Type the name of the person who signed in the field beneath the signature.",
    "Save the report. It is created with status SUBMITTED.",
  ]);

  m.h3("Photographs");
  m.p(
    "Photographs can be attached to a saved report and are classified as either EQUIPMENT — the state of the equipment as found — or WORK_DONE, showing the completed work. Photographs are the fastest way to settle a later question about the condition of equipment on the day, so take them as a matter of routine.",
  );

  m.h3("Review and reminders");
  m.p(
    "An administrator or operations manager reviews each submitted report and approves or rejects it with a note. They can also set a service reminder on the report — MONTHLY, QUARTERLY or SEMI_ANNUAL — which records the date the next service visit falls due, so recurring maintenance is not forgotten.",
  );
  m.note(
    "Once submitted, only managers may edit",
    "A technician can create an intervention report and add photographs to it, but changing a report after submission is restricted to administrators and operations managers. If you spot an error in your own report after submitting it, ask your manager to correct it rather than raising a second report.",
  );

  /* ---------------- 8. Administration ---------------- */
  m.h1("Administration");

  m.p("This chapter is for administrators. The pages it describes are not visible to other roles.");

  m.h2("Managing user accounts");
  m.where("Navigation: Users (administrators only)");

  m.p(
    "Accounts are created by administrators — staff cannot register themselves. Give each person the narrowest role that covers their actual work.",
  );
  m.steps([
    "Open Users.",
    "Select Add User.",
    "Enter the person's Name and Email. The email is their sign-in name and must be unique.",
    "Set an initial Password of at least eight characters.",
    "Choose the Role. Chapter 5 describes what each role can do.",
    "Save, then tell the user their initial password and ask them to change it at first sign-in via Settings.",
  ]);

  m.h3("Changing a role");
  m.p(
    "Open the user from the list, select the pencil icon and choose the new role. The change takes effect the next time that user signs in, so ask them to sign out and back in if the new permissions are needed immediately.",
  );

  m.h3("Removing an account");
  m.p(
    "Deleting a user removes their ability to sign in. Records they created — requisitions, reports, stock movements, uploaded documents — remain in the system, because deleting them would destroy the audit trail. If someone is only away temporarily, change their password rather than deleting the account.",
  );
  m.note(
    "Keep at least two administrators",
    "Make sure more than one person holds the ADMIN role. Only an administrator can create users or change roles, so a single administrator who loses access leaves nobody able to restore it.",
  );

  m.h2("Linking users to employees");
  m.p(
    "A user account and an employee record are separate things: the account is how somebody signs in, the employee record is their personnel file. Linking the two — from the employee record in ERP › HR › Employees — connects a person's sign-in to their leave, attendance and assignments. Not everyone needs both: a technician who never signs in still needs an employee record, and a system account may exist without one.",
  );

  /* ---------------- 9. Reference ---------------- */
  m.h1("Reference");

  m.h2("Status quick reference");
  m.table(
    [
      { header: "Record", fraction: 0.24 },
      { header: "Available statuses", fraction: 0.76 },
    ],
    [
      ["Quotation", "DRAFT · SENT · ACCEPTED · REJECTED · EXPIRED"],
      ["Invoice", "DRAFT · SENT · PAID · OVERDUE · CANCELLED"],
      ["Contract", "PLANNING · IN_PROGRESS · COMPLETED · CANCELLED"],
      ["Requisition", "SUBMITTED · APPROVED · REJECTED · CONVERTED"],
      ["Purchase order", "DRAFT · SENT · PARTIALLY_RECEIVED · FULLY_RECEIVED · CLOSED · CANCELLED"],
      ["Stock movement", "IN · OUT · ADJUSTMENT"],
      ["Project", "QUOTED · APPROVED · IN_PROGRESS · ON_HOLD · COMPLETED · CLOSED · CANCELLED"],
      ["Employment", "ACTIVE · ON_LEAVE · TERMINATED"],
      ["Leave request", "PENDING · APPROVED · REJECTED · CANCELLED"],
      ["Attendance", "PRESENT · LATE · ABSENT · ON_LEAVE · PUBLIC_HOLIDAY · REST_DAY"],
      ["Work order", "SCHEDULED · IN_PROGRESS · COMPLETED · CANCELLED"],
      ["Daily / intervention report", "SUBMITTED · APPROVED · REJECTED"],
    ],
  );

  m.h2("Glossary");
  m.table(
    [
      { header: "Term", fraction: 0.24 },
      { header: "Meaning", fraction: 0.76 },
    ],
    [
      ["BRN", "Business Registration Number, recorded against customers for invoicing."],
      ["Contract", "An ongoing commercial agreement with a customer, against which projects are delivered."],
      ["Goods receipt", "The record of what physically arrived against a purchase order. Raises stock levels."],
      ["Intervention report", "The signed, formal record of a site visit: what was found and what was done."],
      ["Line item", "A single priced row on a quotation, invoice or purchase order."],
      ["Purchase order (PO)", "A commitment to buy from a supplier at agreed prices."],
      ["Requisition", "An internal request to buy something, raised before a purchase order exists."],
      ["Role", "The single permission level attached to a user account."],
      ["SKU", "The unique code identifying an inventory item."],
      ["Stock movement", "A logged change in the quantity of an inventory item, in or out."],
      ["VAT", "Value Added Tax, applied at 15% by default on quotations and invoices."],
      ["Work order", "The instruction to carry out a specific job for a customer on a given date."],
    ],
  );

  m.h2("Common questions");

  m.h3("I cannot see a button described in this manual.");
  m.p(
    "Your role does not permit that action. Check Chapter 5 for who can do what, and ask an administrator if you believe your role is wrong.",
  );

  m.h3("The system returned me to the sign-in page.");
  m.p(
    "Your eight-hour session has expired. Sign in again and carry on. Any form you had open but had not saved will need to be re-entered, so save long forms as you go.",
  );

  m.h3("I cannot delete a record.");
  m.p(
    "Records that other records depend on are protected. A customer with invoices, a supplier with purchase orders, or an inventory item with movement history cannot be deleted. This is intentional: removing them would break the history. Where a record is simply no longer current, mark it inactive or set an appropriate status instead.",
  );

  m.h3("My reset email has not arrived.");
  m.p(
    "Check the spam folder first, and check that you used the email address the account was created with. Reset links last one hour; if longer has passed, request a new one. After five requests in fifteen minutes further attempts are refused for a while — wait, then try again.",
  );

  m.h3("Stock does not match what is on the shelf.");
  m.p(
    "Record an ADJUSTMENT against the item with a clear reason. Check the movement history first: an unreceipted delivery or an unrecorded issue to a job is the usual explanation, and correcting that is better than adjusting the total.",
  );

  m.h3("A leave request cannot be approved.");
  m.p(
    "The request exceeds the employee's available balance for that leave type and year. The message shows how many days remain. Either amend the request to fit, or adjust the balance in ERP › HR › Leave › Balances if the entitlement itself is wrong.",
  );

  m.h2("Getting help");
  m.p(
    "For access problems, new accounts and role changes, contact your system administrator. For questions about how a business process should work, speak to the manager responsible for that area — finance, procurement, HR or operations. For faults in the system itself, report them to your administrator with the page you were on, what you were trying to do, and the exact wording of any error message.",
  );
  m.p(`${COMPANY.name} · ${COMPANY.addressLines.join(", ")} · Tel ${COMPANY.tel} · ${COMPANY.email}`);
}

/* ------------------------------------------------------------------ *
 * Passes
 * ------------------------------------------------------------------ */

function measurePass(): TocEntry[] {
  const m = new Manual(0);
  const sink = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  m.doc.pipe(sink);
  m.cover();
  writeBody(m);
  m.doc.end();
  return m.toc;
}

function tocPageCount(entries: TocEntry[]): number {
  // Mirrors the layout arithmetic in Manual.renderToc.
  const usable = 841.89 - MARGIN * 2 - 46; // A4 height in points
  let pages = 1;
  let y = 0;
  for (const entry of entries) {
    const h = entry.level === 1 ? 23 : 15.5;
    if (y + h > usable) {
      pages += 1;
      y = 0;
    }
    y += h;
  }
  return pages;
}

function main() {
  const pages = tocPageCount(measurePass());

  const m = new Manual(pages);
  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  const stream = createWriteStream(OUT_PATH);
  m.doc.pipe(stream);

  m.cover();
  const reserved = m.reserveTocPages();
  writeBody(m);
  m.renderToc(reserved);
  m.footers();

  m.doc.flushPages();
  m.doc.end();

  stream.on("finish", () => {
    console.log(`User manual written to ${OUT_PATH}`);
  });
}

main();
