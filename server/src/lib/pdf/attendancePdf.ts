import PDFDocument from "pdfkit";
import { drawFooterBanner, drawLetterhead, registerBrandFonts, type Money } from "./shared";
import { MAURITIUS_OFFSET_MINUTES } from "../overtime";

const GRID = "#5fb8c9";
const PALE = "#daeef3";

export interface AttendancePdfVisit {
  id: string;
  checkInAt: Date;
  checkInDeclaredTime: string | null;
  checkInNote: string | null;
  checkInSite: string | null;
  checkInTransportCost: Money | null;
  checkOutAt: Date | null;
  checkOutDeclaredTime: string | null;
  checkOutNote: string | null;
  checkOutSite: string | null;
  checkOutTransportCost: Money | null;
  checkOutByManager: boolean;
}

export interface AttendancePdfInput {
  employee: { firstName: string; lastName: string; employeeCode: string; position: string | null; department: string | null };
  /** First and last Mauritius day of the report, "YYYY-MM-DD". */
  from: string;
  to: string;
  /** Who validated it and when; null prints the report as DRAFT. */
  validation: { by: string; at: Date } | null;
  visits: AttendancePdfVisit[];
  /** Minutes late, keyed by visit id (the day's first check-in). */
  late: Map<string, number>;
  /** HR-approved overtime minutes, keyed by visit id (the day's last check-in). */
  overtime: Map<string, number>;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of a timestamp in Mauritius (UTC+4, no daylight saving). */
function local(date: Date) {
  const d = new Date(date.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay(), hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
}

function clock(date: Date): string {
  const l = local(date);
  return `${String(l.hours).padStart(2, "0")}:${String(l.minutes).padStart(2, "0")}`;
}

/** The time as the technician typed it, else the recorded time — same rule as the screen. */
function shownTime(declared: string | null, recorded: Date | null): string {
  if (declared) return declared;
  return recorded ? clock(recorded) : "—";
}

function span(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

function transport(v: AttendancePdfVisit): number {
  return Number(v.checkInTransportCost ?? 0) + Number(v.checkOutTransportCost ?? 0);
}

/** A large, faint diagonal "DRAFT" across the page, drawn over the content. */
function drawDraftWatermark(doc: PDFKit.PDFDocument) {
  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save();
  doc.rotate(-40, { origin: [cx, cy] });
  doc
    .font("Body-Bold")
    .fontSize(150)
    .fillColor("#dc2626")
    .fillOpacity(0.13)
    .text("DRAFT", cx - 300, cy - 75, { width: 600, align: "center", lineBreak: false });
  doc.restore();
  doc.fillOpacity(1).fillColor("#000000");
  doc.page.margins.bottom = savedBottom;
}

/**
 * A printable attendance sheet for one employee over a date range — the technician's own "My Attendance"
 * export. Same letterhead and pale-blue table style as the quotation PDF. Like the screen it comes
 * from, it carries only what the person entered plus the recorded times: no coordinates and no
 * location-match flags (CLAUDE.md §7a). Overtime is shown only once HR has approved it.
 */
export function generateAttendancePdf(input: AttendancePdfInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  registerBrandFonts(doc);
  doc.font("Body");

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  // Leave room above the footer banner for page numbers.
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 20;

  drawLetterhead(doc);

  const dayLabel = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    // Short month names so a two-date period fits its box.
    return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  };
  const period = input.from === input.to ? dayLabel(input.from) : `${dayLabel(input.from)} – ${dayLabel(input.to)}`;

  // Title bar
  const titleY = doc.y;
  doc.rect(left, titleY, width, 28).fillAndStroke(PALE, GRID);
  doc.fillColor("#000000").font("Body-Bold").fontSize(15).text("ATTENDANCE REPORT", left, titleY + 7, { width, align: "center" });
  doc.y = titleY + 28;

  // Employee details — two label/value pairs per row.
  const e = input.employee;
  const now = new Date();
  const stamp = (date: Date) => `${local(date).day} ${MONTHS[local(date).month]} ${local(date).year}, ${clock(date)}`;
  const generated = stamp(now);
  const details: [string, string, string, string][] = [
    ["Employee", `${e.firstName} ${e.lastName}`, "Employee No.", e.employeeCode],
    ["Position", e.position || "—", "Department", e.department || "—"],
    ["Period", period, "Generated", generated],
  ];
  const labelW = width * 0.16;
  const valueW = width * 0.34;
  for (const [l1, v1, l2, v2] of details) {
    const y = doc.y;
    const h = 20;
    const cells: [number, number, string, boolean][] = [
      [left, labelW, l1, true],
      [left + labelW, valueW, v1, false],
      [left + labelW + valueW, labelW, l2, true],
      [left + 2 * labelW + valueW, valueW, v2, false],
    ];
    for (const [x, w, text, bold] of cells) {
      if (bold) doc.rect(x, y, w, h).fill(PALE);
      doc.rect(x, y, w, h).strokeColor(GRID).lineWidth(0.75).stroke();
      doc.fillColor("#000000").font(bold ? "Body-Bold" : "Body").fontSize(10).text(text, x + 6, y + 5, { width: w - 12, lineBreak: false, ellipsis: true });
    }
    doc.y = y + h;
  }

  // Validation status, right under the details.
  {
    const y = doc.y;
    const h = 22;
    const validated = input.validation;
    doc.rect(left, y, width, h).fill(validated ? "#dcfce7" : "#fee2e2");
    doc.rect(left, y, width, h).strokeColor(GRID).lineWidth(0.75).stroke();
    doc
      .fillColor(validated ? "#166534" : "#991b1b")
      .font("Body-Bold")
      .fontSize(10.5)
      .text(
        validated
          ? `VALIDATED by ${validated.by} on ${stamp(validated.at)}`
          : "DRAFT — not yet validated by Admin/HR. Not valid as an official record.",
        left,
        y + 5.5,
        { width, align: "center" },
      );
    doc.fillColor("#000000");
    doc.y = y + h;
  }

  // Summary
  const visits = [...input.visits].sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime());
  const days = new Set(visits.map((v) => { const l = local(v.checkInAt); return `${l.year}-${l.month}-${l.day}`; })).size;
  const workedMinutes = visits.reduce((s, v) => (v.checkOutAt ? s + (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60000 : s), 0);
  const overtimeMinutes = [...input.overtime.values()].reduce((a, b) => a + b, 0);
  const totalTransport = visits.reduce((s, v) => s + transport(v), 0);
  const summary: [string, string][] = [
    ["Days Present", String(days)],
    ["Hours Recorded", span(workedMinutes)],
    ["Days Late", String(input.late.size)],
    ["Approved Overtime", span(overtimeMinutes)],
    ["Transport (MUR)", totalTransport.toFixed(2)],
  ];
  doc.y += 12;
  const sumY = doc.y;
  const sumW = width / summary.length;
  summary.forEach(([label, value], i) => {
    const x = left + i * sumW;
    doc.rect(x, sumY, sumW, 16).fill(PALE);
    doc.rect(x, sumY, sumW, 40).strokeColor(GRID).lineWidth(0.75).stroke();
    doc.fillColor("#000000").font("Body-Bold").fontSize(8.5).text(label.toUpperCase(), x, sumY + 4, { width: sumW, align: "center" });
    doc.font("Body-Bold").fontSize(13).text(value, x, sumY + 20, { width: sumW, align: "center" });
  });
  doc.y = sumY + 40 + 14;

  // Register table
  const cols = [
    { title: "Date", w: 0.12, align: "left" as const },
    { title: "Time In", w: 0.09, align: "center" as const },
    { title: "Time Out", w: 0.09, align: "center" as const },
    { title: "Hours", w: 0.08, align: "center" as const },
    { title: "Site / Location", w: 0.34, align: "left" as const },
    { title: "Transport\n(MUR)", w: 0.11, align: "right" as const },
    { title: "Remarks", w: 0.17, align: "left" as const },
  ];
  const colW = cols.map((c) => c.w * width);
  const colX = colW.reduce<number[]>((xs, w, i) => [...xs, xs[i] + w], [left]);
  const FONT = 9;

  function headerRow() {
    const y = doc.y;
    const h = 26;
    doc.rect(left, y, width, h).fill(PALE);
    doc.fillColor("#000000").font("Body-Bold").fontSize(FONT);
    cols.forEach((c, i) => {
      const twoLines = c.title.includes("\n");
      doc.text(c.title, colX[i] + 4, y + (twoLines ? 3 : 8), { width: colW[i] - 8, align: c.align === "right" ? "center" : c.align === "left" ? "left" : "center" });
    });
    grid(y, y + h);
    doc.moveTo(left, y).lineTo(right, y).stroke();
    doc.moveTo(left, y + h).lineTo(right, y + h).stroke();
    doc.y = y + h;
  }

  function grid(y0: number, y1: number) {
    doc.strokeColor(GRID).lineWidth(0.75);
    for (const x of colX) doc.moveTo(x, y0).lineTo(x, y1).stroke();
  }

  headerRow();

  if (visits.length === 0) {
    const y = doc.y;
    doc.font("Body-Italic").fontSize(10).fillColor("#555555").text("No check-ins recorded for this period.", left, y + 8, { width, align: "center" });
    doc.fillColor("#000000");
    doc.rect(left, y, width, 30).strokeColor(GRID).stroke();
    doc.y = y + 30;
  }

  for (const v of visits) {
    const l = local(v.checkInAt);
    const date = `${WEEKDAYS[l.weekday]} ${String(l.day).padStart(2, "0")} ${MONTHS[l.month].slice(0, 3)}`;
    const hours = v.checkOutAt ? span((v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60000) : "—";

    const place: string[] = [];
    const inPlace = [v.checkInSite, v.checkInNote].filter(Boolean).join(" — ");
    if (inPlace) place.push(inPlace);
    const outPlace = [v.checkOutSite, v.checkOutNote].filter(Boolean).join(" — ");
    if (outPlace && outPlace !== inPlace && !v.checkOutByManager) place.push(`Left from: ${outPlace}`);

    const remarks: string[] = [];
    if (input.late.has(v.id)) remarks.push(`Late ${span(input.late.get(v.id)!)}`);
    if (input.overtime.has(v.id)) remarks.push(`Overtime ${span(input.overtime.get(v.id)!)}`);
    if (!v.checkOutAt) remarks.push("Not checked out");
    if (v.checkOutByManager) remarks.push("Closed by manager");

    const cells = [
      date,
      shownTime(v.checkInDeclaredTime, v.checkInAt),
      v.checkOutAt ? shownTime(v.checkOutDeclaredTime, v.checkOutAt) : "—",
      hours,
      place.join("\n") || "—",
      transport(v).toFixed(2),
      remarks.join("\n"),
    ];

    doc.font("Body").fontSize(FONT);
    const rowH = Math.max(...cells.map((text, i) => doc.heightOfString(text, { width: colW[i] - 8 }))) + 8;
    if (doc.y + rowH > bottomLimit) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      headerRow();
    }
    const y = doc.y;
    cells.forEach((text, i) => {
      const isRemark = i === cols.length - 1;
      doc.font(isRemark ? "Body-Bold" : "Body").fontSize(FONT).fillColor(isRemark ? "#9a3412" : "#000000");
      doc.text(text, colX[i] + 4, y + 4, { width: colW[i] - 8, align: cols[i].align });
    });
    doc.fillColor("#000000");
    grid(y, y + rowH);
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).stroke();
    doc.y = y + rowH;
  }

  // Notes and signatures
  const notes =
    "Times are as entered by the employee at check-in and check-out. Working hours: Monday–Friday 08:00–17:00, " +
    "Saturday 08:00–13:00. Overtime is shown only once approved by HR.";
  doc.font("Body-Italic").fontSize(8);
  const notesH = doc.heightOfString(notes, { width });
  if (doc.y + 14 + notesH + 90 > bottomLimit) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
  doc.y += 10;
  doc.fillColor("#444444").text(notes, left, doc.y, { width });
  doc.fillColor("#000000");

  const sigY = doc.y + 50;
  const sigW = (width - 40) / 2;
  const signatures = ["Employee Signature", "Supervisor / HR Signature"];
  signatures.forEach((label, i) => {
    const x = left + i * (sigW + 40);
    doc.moveTo(x, sigY).lineTo(x + sigW, sigY).strokeColor("#000000").lineWidth(0.75).stroke();
    doc.font("Body-Bold").fontSize(9).text(label, x, sigY + 4, { width: sigW });
    doc.font("Body").fontSize(9).text("Date: ____________________", x, sigY + 18, { width: sigW });
  });

  // Footer on every page: branded banner + page number, and the DRAFT watermark when unvalidated.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (!input.validation) drawDraftWatermark(doc);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Body")
      .fontSize(8)
      .fillColor("#555555")
      .text(`${e.firstName} ${e.lastName} — ${period} — Page ${i - range.start + 1} of ${range.count}`, left, doc.page.height - 40, { width, align: "center", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
    drawFooterBanner(doc);
  }

  doc.end();
  return doc;
}
