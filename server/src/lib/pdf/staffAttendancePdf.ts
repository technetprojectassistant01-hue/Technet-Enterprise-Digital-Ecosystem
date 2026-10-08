import PDFDocument from "pdfkit";
import { drawFooterBanner, drawLetterhead, registerBrandFonts, type Money } from "./shared";
import { MAURITIUS_OFFSET_MINUTES } from "../overtime";
import type { PayWarning, TechnicianSummary } from "../attendanceSummary";

const GRID = "#5fb8c9";
const PALE = "#daeef3";
/** The same orange the on-screen table uses for the entered/recorded split. */
const BAND_TEXT = "#c2410c";
const BAND_FILL = "#ffedd5";

export interface StaffAttendancePdfVisit {
  id: string;
  employeeId: string;
  employeeName: string;
  checkInAt: Date;
  checkInDeclaredTime: string | null;
  checkInNote: string | null;
  checkInSite: string | null;
  checkInLat: Money | null;
  checkInLng: Money | null;
  /** Reverse-geocoded place name for checkInLat/Lng - see reverseGeocodeCached(). */
  checkInPlace: string | null;
  checkInTransportCost: Money | null;
  checkOutAt: Date | null;
  checkOutDeclaredTime: string | null;
  checkOutNote: string | null;
  checkOutSite: string | null;
  checkOutLat: Money | null;
  checkOutLng: Money | null;
  /** Mirrors checkInPlace. */
  checkOutPlace: string | null;
  checkOutTransportCost: Money | null;
  checkOutByManager: boolean;
  /** Closed by the app at closing time (lib/autoCheckout.ts). */
  checkOutAutomatic?: boolean;
}

export interface StaffAttendancePdfInput {
  /** First and last Mauritius day of the report, "YYYY-MM-DD". */
  from: string;
  to: string;
  visits: StaffAttendancePdfVisit[];
  /** Minutes late, keyed by visit id (each employee-day's first check-in). */
  late: Map<string, number>;
  /** HR-approved overtime minutes, keyed by visit id (each employee-day's last check-in). */
  approvedOvertime: Map<string, number>;
  /** Calculated overtime still awaiting a decision, keyed the same way. */
  pendingOvertime: Map<string, number>;
  /**
   * One row per person (2026-10-03): days checked in, working days with no check-in, hours, late,
   * overtime - printed before the register so the report reads without counting rows. Optional.
   */
  technicians?: TechnicianSummary[];
  /** Visits open over 12 hours, printed as "check before using these figures for pay". */
  warnings?: (PayWarning & { name: string })[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function local(date: Date) {
  const d = new Date(date.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay(), hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
}

function clock(date: Date): string {
  const l = local(date);
  return `${String(l.hours).padStart(2, "0")}:${String(l.minutes).padStart(2, "0")}`;
}

function shownTime(declared: string | null, recorded: Date | null): string {
  if (declared) return declared;
  return recorded ? clock(recorded) : "—";
}

function span(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

/** First comma-segment only, and capped - the narrow GPS columns can't afford a full Nominatim
 * address, and the raw coordinates on the line below stay the source of truth regardless. */
function shortPlace(place: string | null): string | null {
  if (!place) return null;
  const first = place.split(",")[0]?.trim() || place;
  return first.length > 26 ? `${first.slice(0, 25)}…` : first;
}

function coords(lat: Money | null, lng: Money | null, place: string | null = null): string {
  if (lat === null || lng === null) return "—";
  const coordLine = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
  const short = shortPlace(place);
  return short ? `${short}\n${coordLine}` : coordLine;
}

/**
 * The whole team's attendance register over a date range — the admin's export of the Staff
 * Attendance table on the landing page. Landscape, because unlike the employee's own report this
 * one prints both halves side by side: what each person entered against what the app recorded,
 * GPS included. That comparison is the reason the screen exists, so the export keeps it.
 *
 * Deliberately not the same document as `attendancePdf.ts`: that one is a single employee's
 * official sheet, carries HR's validation state and DRAFT watermark, and shows no coordinates at
 * all (CLAUDE.md §7a). This is an internal management listing and has no validation concept.
 */
export function generateStaffAttendancePdf(input: StaffAttendancePdfInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });
  registerBrandFonts(doc);
  doc.font("Body");

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 20;

  drawLetterhead(doc);

  const dayLabel = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  };
  const period = input.from === input.to ? dayLabel(input.from) : `${dayLabel(input.from)} – ${dayLabel(input.to)}`;
  const now = new Date();
  const generated = `${local(now).day} ${MONTHS[local(now).month]} ${local(now).year}, ${clock(now)}`;

  // Title bar
  const titleY = doc.y;
  doc.rect(left, titleY, width, 26).fillAndStroke(PALE, GRID);
  doc.fillColor("#000000").font("Body-Bold").fontSize(14).text("STAFF ATTENDANCE REGISTER", left, titleY + 6, { width, align: "center" });
  doc.y = titleY + 26;

  // Period / generated line
  {
    const y = doc.y;
    const h = 18;
    doc.rect(left, y, width, h).strokeColor(GRID).lineWidth(0.75).stroke();
    doc.fillColor("#000000").font("Body-Bold").fontSize(9).text(`Period: ${period}`, left + 6, y + 5, { width: width / 2 - 12 });
    doc.font("Body").fontSize(9).text(`Generated: ${generated}`, left + width / 2, y + 5, { width: width / 2 - 6, align: "right" });
    doc.y = y + h;
  }

  const visits = [...input.visits].sort((a, b) => {
    const nameDiff = a.employeeName.localeCompare(b.employeeName);
    if (nameDiff !== 0) return nameDiff;
    return a.checkInAt.getTime() - b.checkInAt.getTime();
  });

  // Summary
  const people = new Set(visits.map((v) => v.employeeId)).size;
  const days = new Set(visits.map((v) => { const l = local(v.checkInAt); return `${v.employeeId}|${l.year}-${l.month}-${l.day}`; })).size;
  const workedMinutes = visits.reduce((s, v) => (v.checkOutAt ? s + (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60000 : s), 0);
  const transportTotal = visits.reduce((s, v) => s + Number(v.checkInTransportCost ?? 0) + Number(v.checkOutTransportCost ?? 0), 0);
  const summary: [string, string][] = [
    ["Staff", String(people)],
    ["Employee-Days", String(days)],
    ["Hours Recorded", span(workedMinutes)],
    ["Days Late", String(input.late.size)],
    ["Approved Overtime", span([...input.approvedOvertime.values()].reduce((a, b) => a + b, 0))],
    ["Transport (MUR)", transportTotal.toFixed(2)],
  ];
  doc.y += 10;
  const sumY = doc.y;
  const sumW = width / summary.length;
  summary.forEach(([label, value], i) => {
    const x = left + i * sumW;
    doc.rect(x, sumY, sumW, 15).fill(PALE);
    doc.rect(x, sumY, sumW, 36).strokeColor(GRID).lineWidth(0.75).stroke();
    doc.fillColor("#000000").font("Body-Bold").fontSize(8).text(label.toUpperCase(), x, sumY + 4, { width: sumW, align: "center" });
    doc.font("Body-Bold").fontSize(12).text(value, x, sumY + 18, { width: sumW, align: "center" });
  });
  doc.y = sumY + 36 + 12;

  const fullDay = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
  };
  const ensure = (h: number) => {
    if (doc.y + h > bottomLimit) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  };
  const sectionTitle = (text: string, color = "#0d5c70") => {
    ensure(40);
    doc.font("Body-Bold").fontSize(11).fillColor(color).text(text, left, doc.y, { width });
    doc.fillColor("#000000");
    doc.y += 4;
  };
  const labelled = (label: string, body: string) => {
    doc.font("Body").fontSize(8.5);
    ensure(doc.heightOfString(`${label} ${body}`, { width }) + 4);
    doc.font("Body-Bold").fontSize(8.5).fillColor("#000000").text(`${label} `, left, doc.y, { width, continued: true }).font("Body").text(body);
    doc.y += 3;
  };

  /** A bordered table that breaks across pages, repeating its header. */
  const table = (cols: { title: string; w: number }[], rows: { cells: string[]; fill?: string; bold?: boolean }[], fontSize = 7.5) => {
    const total = cols.reduce((a, c) => a + c.w, 0);
    const w = cols.map((c) => (c.w / total) * width);
    const x = w.reduce<number[]>((xs, cw, i) => [...xs, xs[i] + cw], [left]);
    const draw = (cells: string[], header: boolean, fill?: string, bold = false) => {
      doc.font(header ? "Body-Bold" : "Body").fontSize(fontSize);
      const h = Math.max(...cells.map((c, i) => doc.heightOfString(c, { width: w[i] - 4 }))) + 7;
      const y = doc.y;
      cells.forEach((c, i) => {
        doc.rect(x[i], y, w[i], h).fillAndStroke(header ? PALE : fill ?? "#ffffff", GRID);
        doc.fillColor("#000000").font(header || (bold && i < 2) ? "Body-Bold" : "Body").fontSize(fontSize)
          .text(c, x[i] + 2, y + 3.5, { width: w[i] - 4, align: i === 1 && !header ? "left" : "center" });
      });
      doc.y = y + h;
      return h;
    };
    const headerCells = cols.map((c) => c.title);
    doc.font("Body-Bold").fontSize(fontSize);
    ensure(Math.max(...headerCells.map((c, i) => doc.heightOfString(c, { width: w[i] - 4 }))) + 30);
    draw(headerCells, true);
    for (const r of rows) {
      doc.font("Body").fontSize(fontSize);
      const h = Math.max(...r.cells.map((c, i) => doc.heightOfString(c, { width: w[i] - 4 }))) + 7;
      if (doc.y + h > bottomLimit) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        draw(headerCells, true);
      }
      draw(r.cells, false, r.fill, r.bold);
    }
  };
  const hrs = (minutes: number | null) => (minutes === null ? "—" : (minutes / 60).toFixed(1));
  const num = (n: number | null) => (n === null ? "—" : String(n));

  if (input.technicians?.length) {
    // The office AiFace attendance machine's Monthly Report layout (management, 2026-10-08).
    sectionTitle("MONTHLY REPORT");
    table(
      [
        { title: "Staff Code", w: 5 },
        { title: "Name", w: 12 },
        { title: "Department", w: 8 },
        { title: "Should (Days)", w: 5 },
        { title: "Actual (Days)", w: 5 },
        { title: "Actual (Hrs)", w: 5 },
        { title: "Absence (Days)", w: 5.5 },
        { title: "Absence (Hrs)", w: 5.5 },
        { title: "Late (Times)", w: 5 },
        { title: "Late (Mins)", w: 5 },
        { title: "Leave Early (Times)", w: 6 },
        { title: "Leave Early (Mins)", w: 6 },
        { title: "Holiday (Days)", w: 5.5 },
        { title: "Leave (Days)", w: 5 },
        { title: "Leave (Hrs)", w: 5 },
        { title: "Overtime (Hrs)", w: 6 },
        { title: "Overtime Approved (Hrs)", w: 6.5 },
      ],
      input.technicians.map((t) => ({
        cells: [
          t.code ?? "—",
          t.name,
          t.department ?? "—",
          num(t.shouldDays),
          String(t.daysCheckedIn),
          hrs(t.minutesRecorded),
          t.shouldDays === null ? "—" : String(t.noCheckInDays?.length ?? 0),
          t.shouldDays === null ? "—" : hrs(t.absenceMinutes),
          String(t.lateDays),
          String(t.lateMinutes),
          String(t.earlyTimes),
          String(t.earlyMinutes),
          t.shouldDays === null ? "—" : String(t.holidayDays),
          t.shouldDays === null ? "—" : String(t.leaveDays),
          t.shouldDays === null ? "—" : hrs(t.leaveMinutes),
          hrs(t.overtimeMinutes),
          hrs(t.approvedOvertimeMinutes),
        ],
        bold: true,
        fill: t.daysCheckedIn === 0 && t.shouldDays !== null ? "#fdf1f1" : undefined,
      })),
    );
    doc.font("Body-Italic").fontSize(7.5).fillColor("#444444")
      .text("Should = working days (Monday to Saturday, excluding public holidays) from the day the person was hired or had a login. Actual = days and hours checked in by the app. Absence = working days with no check-in, no approved leave and no HR excuse (Staff Technicians only). Late from 08:30 and Leave Early before the end of the shift, both by the time the app recorded. Hours are shift hours: 08:00-17:00 weekdays, 08:00-13:00 Saturday.", left, doc.y + 3, { width });
    doc.fillColor("#000000");
    doc.y += 12;

    sectionTitle("DAILY REPORT");
    const STATUS: Record<string, string> = { PRESENT: "", ABSENT: "Absent", LEAVE: "Leave", HOLIDAY: "Holiday", EXCUSED: "Excused", REST: "Rest day" };
    const pair = (pp?: { in: string; out: string | null; outNextDay: boolean }) =>
      pp ? `${pp.in} / ${pp.out === null ? "Not out" : pp.out + (pp.outNextDay ? " (+1 day)" : "")}` : "";
    for (const t of input.technicians) {
      if (!t.daily.length) continue;
      ensure(50);
      doc.font("Body-Bold").fontSize(9.5).fillColor("#000000").text(`${t.name}${t.code ? ` (${t.code})` : ""}`, left, doc.y, { width });
      doc.y += 2;
      table(
        [
          { title: "Date", w: 9 },
          { title: "Shift", w: 9 },
          { title: "In1 / Out1", w: 11 },
          { title: "In2 / Out2", w: 11 },
          { title: "In3 / Out3", w: 11 },
          { title: "Actual (Hrs)", w: 7 },
          { title: "Late In (Mins)", w: 7 },
          { title: "Early Out (Mins)", w: 7 },
          { title: "Status", w: 9 },
        ],
        t.daily.map((r) => ({
          cells: [
            fullDay(r.day),
            r.shift ?? "—",
            pair(r.punches[0]),
            pair(r.punches[1]),
            pair(r.punches[2]) + (r.punches.length > 3 ? ` (+${r.punches.length - 3} more)` : ""),
            r.punches.length ? hrs(r.minutes) : "",
            r.lateMinutes ? String(r.lateMinutes) : "",
            r.earlyMinutes ? String(r.earlyMinutes) : "",
            STATUS[r.status],
          ],
          fill: r.status === "ABSENT" ? "#fdf1f1" : r.status === "REST" ? "#f5f5f5" : undefined,
        })),
      );
      doc.y += 8;
    }
  }

  if (input.warnings?.length) {
    sectionTitle("CHECK BEFORE USING THESE FIGURES FOR PAY", "#b42318");
    doc.font("Body").fontSize(8.5).fillColor("#000000")
      .text("These visits stayed open more than 12 hours, which usually means the check-out was done late (often the next morning). Their hours, and overtime calculated from them, are likely overstated.", left, doc.y, { width });
    doc.y += 4;
    for (const w of input.warnings) {
      const ot = w.overtime ? ` — overtime ${span(w.overtime.minutes)} ${w.overtime.status === "APPROVED" ? "ALREADY APPROVED, review it" : "pending, check before approving"}` : "";
      labelled(`${w.name}, ${fullDay(w.day)}:`, `open ${span(w.openMinutes)}${ot}`);
    }
    doc.y += 8;
  }

  if (input.technicians?.length || input.warnings?.length) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }

  const cols = [
    { title: "Staff", w: 0.105, align: "left" as const },
    { title: "Date", w: 0.09, align: "left" as const },
    { title: "In", w: 0.06, align: "center" as const },
    { title: "Out", w: 0.06, align: "center" as const },
    { title: "Location In", w: 0.13, align: "left" as const },
    { title: "Location Out", w: 0.13, align: "left" as const },
    { title: "In", w: 0.06, align: "center" as const },
    { title: "Out", w: 0.06, align: "center" as const },
    { title: "GPS In", w: 0.1, align: "center" as const },
    { title: "GPS Out", w: 0.1, align: "center" as const },
    { title: "Remarks", w: 0.105, align: "left" as const },
  ];
  const colW = cols.map((c) => c.w * width);
  const colX = colW.reduce<number[]>((xs, w, i) => [...xs, xs[i] + w], [left]);
  const FONT = 7.5;
  /** Columns 2-5 are what the person entered, 6-9 what the app recorded. */
  const ENTERED = [2, 5] as const;
  const RECORDED = [6, 9] as const;

  function grid(y0: number, y1: number) {
    doc.strokeColor(GRID).lineWidth(0.75);
    for (const x of colX) doc.moveTo(x, y0).lineTo(x, y1).stroke();
    doc.moveTo(right, y0).lineTo(right, y1).stroke();
  }

  /** The orange band naming the two halves, so a printed row can't be misread. */
  function bandRow() {
    const y = doc.y;
    const h = 14;
    const spans: [readonly [number, number], string][] = [
      [ENTERED, "AS ENTERED BY STAFF"],
      [RECORDED, "RECORDED BY THE APP"],
    ];
    for (const [[a, b], label] of spans) {
      const x = colX[a];
      const w = colX[b + 1] - x;
      doc.rect(x, y, w, h).fill(BAND_FILL);
      doc.rect(x, y, w, h).strokeColor(GRID).lineWidth(0.75).stroke();
      doc.fillColor(BAND_TEXT).font("Body-Bold").fontSize(7.5).text(label, x, y + 4, { width: w, align: "center" });
    }
    doc.fillColor("#000000");
    doc.y = y + h;
  }

  function headerRow() {
    bandRow();
    const y = doc.y;
    const h = 18;
    doc.rect(left, y, width, h).fill(PALE);
    doc.fillColor("#000000").font("Body-Bold").fontSize(FONT);
    cols.forEach((c, i) => {
      doc.text(c.title, colX[i] + 3, y + 5.5, { width: colW[i] - 6, align: c.align === "left" ? "left" : "center", lineBreak: false });
    });
    grid(y, y + h);
    doc.moveTo(left, y).lineTo(right, y).stroke();
    doc.moveTo(left, y + h).lineTo(right, y + h).stroke();
    doc.y = y + h;
  }

  headerRow();

  if (visits.length === 0) {
    const y = doc.y;
    doc.font("Body-Italic").fontSize(10).fillColor("#555555").text("No check-ins recorded for this period.", left, y + 9, { width, align: "center" });
    doc.fillColor("#000000");
    doc.rect(left, y, width, 30).strokeColor(GRID).stroke();
    doc.y = y + 30;
  }

  let previousName: string | null = null;
  for (const v of visits) {
    const l = local(v.checkInAt);
    const date = `${WEEKDAYS[l.weekday]} ${String(l.day).padStart(2, "0")} ${MONTHS[l.month].slice(0, 3)}`;

    const remarks: string[] = [];
    if (input.late.has(v.id)) remarks.push(`Late ${span(input.late.get(v.id)!)}`);
    if (input.approvedOvertime.has(v.id)) remarks.push(`Overtime ${span(input.approvedOvertime.get(v.id)!)} (approved)`);
    else if (input.pendingOvertime.has(v.id)) remarks.push(`Overtime ${span(input.pendingOvertime.get(v.id)!)} (pending)`);
    if (!v.checkOutAt) remarks.push("Not checked out");
    if (v.checkOutByManager) remarks.push("Closed by manager");
    if (v.checkOutAutomatic) remarks.push("Checked out automatically");

    // The name prints once per person, so a long register reads as blocks rather than repetition.
    const sameAsAbove = v.employeeName === previousName;
    const cells = [
      sameAsAbove ? "" : v.employeeName,
      date,
      shownTime(v.checkInDeclaredTime, v.checkInAt),
      v.checkOutAt ? shownTime(v.checkOutDeclaredTime, v.checkOutAt) : "—",
      [v.checkInSite, v.checkInNote].filter(Boolean).join(" — ") || "—",
      [v.checkOutSite, v.checkOutNote].filter(Boolean).join(" — ") || "—",
      clock(v.checkInAt),
      v.checkOutAt ? clock(v.checkOutAt) : "—",
      coords(v.checkInLat, v.checkInLng, v.checkInPlace),
      coords(v.checkOutLat, v.checkOutLng, v.checkOutPlace),
      remarks.join("\n"),
    ];

    doc.font("Body").fontSize(FONT);
    const rowH = Math.max(14, ...cells.map((text, i) => doc.heightOfString(text, { width: colW[i] - 6 }))) + 7;
    if (doc.y + rowH > bottomLimit) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      headerRow();
      previousName = null;
      cells[0] = v.employeeName;
    }
    const y = doc.y;
    cells.forEach((text, i) => {
      const isRemark = i === cols.length - 1;
      const isName = i === 0;
      doc.font(isRemark || isName ? "Body-Bold" : "Body").fontSize(FONT).fillColor(isRemark ? "#9a3412" : "#000000");
      doc.text(text, colX[i] + 3, y + 3.5, { width: colW[i] - 6, align: cols[i].align });
    });
    doc.fillColor("#000000");
    grid(y, y + rowH);
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).stroke();
    doc.y = y + rowH;
    previousName = v.employeeName;
  }

  const notes =
    "\"As entered by staff\" is what the employee typed at check-in and check-out; \"recorded by the app\" is the server " +
    "timestamp and GPS fix taken at the same moment. Working hours: Monday–Friday 08:00–17:00, Saturday 08:00–13:00. " +
    "Overtime is marked approved only once Admin/HR has approved it.";
  doc.font("Body-Italic").fontSize(7.5);
  const notesH = doc.heightOfString(notes, { width });
  if (doc.y + 12 + notesH > bottomLimit) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
  doc.y += 10;
  doc.fillColor("#444444").text(notes, left, doc.y, { width });
  doc.fillColor("#000000");

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Body")
      .fontSize(8)
      .fillColor("#555555")
      .text(`Staff Attendance — ${period} — Page ${i - range.start + 1} of ${range.count}`, left, doc.page.height - 38, { width, align: "center", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
    drawFooterBanner(doc);
  }

  doc.end();
  return doc;
}
