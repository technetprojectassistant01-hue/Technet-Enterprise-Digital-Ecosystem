import ExcelJS from "exceljs";
import { COMPANY } from "../pdf/company";
import { LOGO_LOCKUP_BASE64 } from "../pdf/assets/logo";
import { MAURITIUS_OFFSET_MINUTES } from "../overtime";
import type { StaffAttendancePdfInput } from "../pdf/staffAttendancePdf";

/**
 * The team attendance report as an Excel workbook (management, 2026-10-03: "if you had added it on
 * the Excel, it would have taken with the header footer completely"). Same data as the PDF
 * (routes/siteAttendance.ts loadTeamReport), two sheets:
 *   Summary  - one row per person, then the visits to check before pay
 *   Register - one row per visit, typed vs recorded
 * Each sheet starts with the letterhead (logo, company name, address, title, period) and carries a
 * printed header/footer (company, title, print date, page x of y), so "Print to PDF" from Excel
 * looks like a company document. Excel can't repeat a picture in a printed header from this
 * library, so the logo prints on the first page and the text header on every page.
 */

const PALE = "FFDAEEF3";
const GRID = "FF5FB8C9";
const NAVY = "FF0D5C70";
const RED = "FFB42318";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function local(date: Date) {
  const d = new Date(date.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000);
  return { iso: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), clock: d.toISOString().slice(11, 16) };
}
const dayLabel = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const span = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const shortPlace = (place: string | null) => (place ? place.split(",")[0].trim() : "");

const TITLE = "Staff Attendance Report";

function letterhead(sheet: ExcelJS.Worksheet, logoId: number, period: string, lastCol: number) {
  sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 78, height: 78 } });
  for (const r of [1, 2, 3, 4]) sheet.getRow(r).height = 20;
  const right = (row: number, text: string, font: Partial<ExcelJS.Font>) => {
    sheet.mergeCells(row, 3, row, lastCol);
    const cell = sheet.getCell(row, 3);
    cell.value = text;
    cell.font = { name: "Calibri", ...font };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  };
  right(1, COMPANY.name, { bold: true, size: 14 });
  right(2, `${COMPANY.addressLines.join(", ")}  ·  Tel ${COMPANY.tel}  ·  ${COMPANY.email}`, { size: 9, color: { argb: "FF555555" } });
  right(3, TITLE.toUpperCase(), { bold: true, size: 13, color: { argb: NAVY } });
  right(4, `Period: ${period}`, { size: 10 });
}

function pageSetup(sheet: ExcelJS.Worksheet, headerRow: number) {
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${headerRow}:${headerRow}`,
    margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 },
  };
  sheet.headerFooter = {
    oddHeader: `&L&"Calibri,Bold"${COMPANY.name}&C&"Calibri,Bold"${TITLE}&RPrinted &D`,
    oddFooter: `&L${COMPANY.addressLines.join(", ")}  ·  ${COMPANY.website}&RPage &P of &N`,
  };
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 30;
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALE } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin", color: { argb: GRID } }, bottom: { style: "thin", color: { argb: GRID } }, left: { style: "thin", color: { argb: GRID } }, right: { style: "thin", color: { argb: GRID } } };
  });
}

function styleBody(row: ExcelJS.Row, columns: number) {
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.font = { name: "Calibri", size: 10, ...(cell.font ?? {}) };
    cell.alignment = { vertical: "top", wrapText: true, ...(cell.alignment ?? {}) };
    cell.border = { bottom: { style: "hair", color: { argb: GRID } }, left: { style: "hair", color: { argb: GRID } }, right: { style: "hair", color: { argb: GRID } } };
  }
}

export async function generateStaffAttendanceXlsx(input: StaffAttendancePdfInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = COMPANY.name;
  workbook.created = new Date();
  const logoId = workbook.addImage({ base64: LOGO_LOCKUP_BASE64, extension: "png" });
  const period = input.from === input.to ? dayLabel(input.from) : `${dayLabel(input.from)} – ${dayLabel(input.to)}`;

  // ---- Summary
  const summary = workbook.addWorksheet("Summary");
  const sCols = [
    { header: "Name", width: 26 },
    { header: "Days checked in", width: 11 },
    { header: "Working days with no check-in", width: 14 },
    { header: "First check-in", width: 13 },
    { header: "Last check-in", width: 13 },
    { header: "Hours recorded", width: 12 },
    { header: "Late days", width: 9 },
    { header: "Late (total)", width: 11 },
    { header: "Overtime calculated", width: 12 },
    { header: "Overtime approved", width: 12 },
    { header: "Not checked out", width: 10 },
    { header: "Days with no check-in", width: 60 },
  ];
  sCols.forEach((c, i) => (summary.getColumn(i + 1).width = c.width));
  letterhead(summary, logoId, period, sCols.length);
  const sHeaderRow = 6;
  summary.getRow(sHeaderRow).values = sCols.map((c) => c.header);
  styleHeader(summary.getRow(sHeaderRow));
  let r = sHeaderRow + 1;
  for (const t of input.technicians ?? []) {
    const row = summary.getRow(r++);
    row.values = [
      t.name,
      t.daysCheckedIn,
      t.noCheckInDays === null ? "—" : t.noCheckInDays.length,
      t.firstCheckIn ? dayLabel(t.firstCheckIn) : "—",
      t.lastCheckIn ? dayLabel(t.lastCheckIn) : "—",
      t.minutesRecorded ? span(t.minutesRecorded) : "—",
      t.lateDays,
      t.lateMinutes ? span(t.lateMinutes) : "—",
      t.overtimeMinutes ? span(t.overtimeMinutes) : "—",
      t.approvedOvertimeMinutes ? span(t.approvedOvertimeMinutes) : "—",
      t.openVisits,
      t.noCheckInDays === null ? "" : t.noCheckInDays.map((d) => `${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${dayLabel(d)}`).join(", "),
    ];
    row.getCell(1).font = { bold: true };
    styleBody(row, sCols.length);
    for (let c = 2; c <= 11; c++) row.getCell(c).alignment = { horizontal: "center", vertical: "top" };
  }
  r += 1;
  summary.getCell(r, 1).value = "Working days with no check-in: Monday to Saturday, excluding public holidays, approved leave, days HR excused, and days before the person was hired or had a login. Staff Technicians only.";
  summary.getCell(r, 1).font = { italic: true, size: 9, color: { argb: "FF444444" } };
  r += 2;

  if (input.warnings?.length) {
    const title = summary.getCell(r, 1);
    title.value = "CHECK BEFORE USING THESE FIGURES FOR PAY";
    title.font = { bold: true, size: 12, color: { argb: RED } };
    r += 1;
    summary.getCell(r, 1).value = "Visits open more than 12 hours: usually a late check-out (often the next morning), so the hours and any overtime from them are likely overstated.";
    summary.getCell(r, 1).font = { size: 9 };
    r += 1;
    const wHeader = summary.getRow(r++);
    wHeader.values = ["Name", "Date", "Open for", "Overtime that day", "Overtime status", "Action"];
    styleHeader(wHeader);
    for (const w of input.warnings) {
      const row = summary.getRow(r++);
      row.values = [
        w.name,
        dayLabel(w.day),
        span(w.openMinutes),
        w.overtime ? span(w.overtime.minutes) : "—",
        w.overtime ? (w.overtime.status === "APPROVED" ? "Approved" : "Pending") : "—",
        w.overtime ? (w.overtime.status === "APPROVED" ? "Review the approval" : "Check before approving") : "Check the hours",
      ];
      styleBody(row, 6);
    }
  }
  pageSetup(summary, sHeaderRow);

  // ---- Register
  const register = workbook.addWorksheet("Register");
  const cols = [
    { header: "Staff", width: 22 },
    { header: "Date", width: 14 },
    { header: "Time in (typed)", width: 9 },
    { header: "Time out (typed)", width: 9 },
    { header: "Location in (typed)", width: 22 },
    { header: "Location out (typed)", width: 22 },
    { header: "Time in (app)", width: 9 },
    { header: "Time out (app)", width: 12 },
    { header: "GPS place in", width: 22 },
    { header: "GPS place out", width: 22 },
    { header: "Hours", width: 9 },
    { header: "Transport (MUR)", width: 10 },
    { header: "Late", width: 9 },
    { header: "Overtime", width: 16 },
    { header: "Remarks", width: 24 },
  ];
  cols.forEach((c, i) => (register.getColumn(i + 1).width = c.width));
  letterhead(register, logoId, period, cols.length);
  const headerRow = 6;
  register.getRow(headerRow).values = cols.map((c) => c.header);
  styleHeader(register.getRow(headerRow));

  const visits = [...input.visits].sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.checkInAt.getTime() - b.checkInAt.getTime());
  r = headerRow + 1;
  for (const v of visits) {
    const inL = local(v.checkInAt);
    const outL = v.checkOutAt ? local(v.checkOutAt) : null;
    const remarks: string[] = [];
    if (!v.checkOutAt) remarks.push("Not checked out");
    if (v.checkOutByManager) remarks.push("Closed by manager");
    if (v.checkOutAutomatic) remarks.push("Checked out automatically");
    const overtime = input.approvedOvertime.has(v.id)
      ? `${span(input.approvedOvertime.get(v.id)!)} (approved)`
      : input.pendingOvertime.has(v.id)
        ? `${span(input.pendingOvertime.get(v.id)!)} (pending)`
        : "";
    const row = register.getRow(r++);
    row.values = [
      v.employeeName,
      `${WEEKDAYS[inL.weekday]} ${dayLabel(inL.iso)}`,
      v.checkInDeclaredTime ?? inL.clock,
      v.checkOutAt ? (v.checkOutDeclaredTime ?? outL!.clock) : "",
      [v.checkInSite, v.checkInNote].filter(Boolean).join(" — "),
      [v.checkOutSite, v.checkOutNote].filter(Boolean).join(" — "),
      inL.clock,
      outL ? (outL.iso === inL.iso ? outL.clock : `${outL.clock} (${dayLabel(outL.iso)})`) : "",
      shortPlace(v.checkInPlace),
      shortPlace(v.checkOutPlace),
      v.checkOutAt ? span((v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60000) : "",
      Number(v.checkInTransportCost ?? 0) + Number(v.checkOutTransportCost ?? 0),
      input.late.has(v.id) ? span(input.late.get(v.id)!) : "",
      overtime,
      remarks.join(", "),
    ];
    styleBody(row, cols.length);
    row.getCell(12).numFmt = "#,##0.00";
    for (const c of [3, 4, 7, 8, 11, 13]) row.getCell(c).alignment = { horizontal: "center", vertical: "top", wrapText: true };
    if (input.late.has(v.id) || overtime || remarks.length) for (const c of [13, 14, 15]) row.getCell(c).font = { bold: true, color: { argb: "FF9A3412" } };
  }
  if (visits.length === 0) register.getCell(r, 1).value = "No check-ins recorded for this period.";
  register.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: cols.length } };
  pageSetup(register, headerRow);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
