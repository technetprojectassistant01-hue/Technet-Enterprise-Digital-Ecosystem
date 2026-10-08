import ExcelJS from "exceljs";
import { COMPANY } from "../pdf/company";
import { LOGO_LOCKUP_BASE64 } from "../pdf/assets/logo";
import { MAURITIUS_OFFSET_MINUTES } from "../overtime";
import type { StaffAttendancePdfInput } from "../pdf/staffAttendancePdf";

/**
 * The team attendance report as an Excel workbook (management, 2026-10-03: "if you had added it on
 * the Excel, it would have taken with the header footer completely"). Same data as the PDF
 * (routes/siteAttendance.ts loadTeamReport), three sheets:
 *   Monthly Report - one row per person in the office AiFace machine's layout, then the visits to
 *                    check before pay
 *   Daily Report   - one row per person per day, In1/Out1..In3/Out3 as on the AiFace report
 *   Register       - one row per visit, typed vs recorded, with GPS places
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

/** The register's Verified / Unverified / Flagged badge - same rule as verificationState() in
 * client/src/lib/siteAttendance.ts. */
function verification(v: StaffAttendancePdfInput["visits"][number]): string {
  const anomalies = v.anomalies ?? [];
  if (anomalies.some((a) => (a.status === "OPEN" || a.status === "CONFIRMED_VIOLATION") && a.severity !== "LOW")) return "Flagged";
  const jobWithSite = !!v.workOrder && v.workOrder.siteLat !== null && v.workOrder.siteLng !== null;
  if (v.knownPlace || jobWithSite || anomalies.some((a) => a.status === "GENUINE")) return v.knownPlace ? `Verified · ${v.knownPlace.name}` : "Verified";
  return "Unverified";
}

/** Typed vs recorded time 15+ minutes apart, as "+22m" / "−15m" - the screen's Time Flag. */
function timeGap(declared: string | null, recorded: Date | null): string {
  const m = declared ? /^(\d{1,2}):(\d{2})$/.exec(declared) : null;
  if (!m || !recorded) return "";
  const rec = new Date(recorded.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000);
  const gap = rec.getUTCHours() * 60 + rec.getUTCMinutes() - (Number(m[1]) * 60 + Number(m[2]));
  return Math.abs(gap) < 15 ? "" : `${gap > 0 ? "+" : "−"}${Math.abs(gap)}m`;
}

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

  const hrs = (minutes: number | null) => (minutes === null ? "—" : Math.round((minutes / 60) * 10) / 10);
  const weekday = (d: string) => WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];

  // ---- Monthly Report: the office AiFace attendance machine's layout (2026-10-08)
  const summary = workbook.addWorksheet("Monthly Report");
  const sCols = [
    { header: "Staff Code", width: 8 },
    { header: "Name", width: 24 },
    { header: "Department", width: 14 },
    { header: "Should (Days)", width: 8 },
    { header: "Actual (Days)", width: 8 },
    { header: "Actual (Hrs)", width: 8 },
    { header: "Absence (Days)", width: 9 },
    { header: "Absence (Hrs)", width: 9 },
    { header: "Late (Times)", width: 8 },
    { header: "Late (Mins)", width: 8 },
    { header: "Leave Early (Times)", width: 9 },
    { header: "Leave Early (Mins)", width: 9 },
    { header: "Holiday (Days)", width: 8 },
    { header: "Holiday (Hrs)", width: 8 },
    { header: "Leave (Days)", width: 8 },
    { header: "Leave (Hrs)", width: 8 },
    { header: "Overtime (Hrs)", width: 9 },
    { header: "Overtime Approved (Hrs)", width: 10 },
    { header: "Days with no check-in", width: 50 },
  ];
  sCols.forEach((c, i) => (summary.getColumn(i + 1).width = c.width));
  letterhead(summary, logoId, period, sCols.length);
  const sHeaderRow = 6;
  summary.getRow(sHeaderRow).values = sCols.map((c) => c.header);
  styleHeader(summary.getRow(sHeaderRow));
  let r = sHeaderRow + 1;
  for (const t of input.technicians ?? []) {
    const daily = t.shouldDays !== null;
    const row = summary.getRow(r++);
    row.values = [
      t.code ?? "—",
      t.name,
      t.department ?? "—",
      daily ? t.shouldDays! : "—",
      t.daysCheckedIn,
      hrs(t.minutesRecorded),
      daily ? (t.noCheckInDays?.length ?? 0) : "—",
      daily ? hrs(t.absenceMinutes) : "—",
      t.lateDays,
      t.lateMinutes,
      t.earlyTimes,
      t.earlyMinutes,
      daily ? t.holidayDays : "—",
      daily ? hrs(t.holidayMinutes) : "—",
      daily ? t.leaveDays : "—",
      daily ? hrs(t.leaveMinutes) : "—",
      hrs(t.overtimeMinutes),
      hrs(t.approvedOvertimeMinutes),
      daily ? (t.noCheckInDays ?? []).map((d) => `${weekday(d)} ${dayLabel(d)}`).join(", ") : "",
    ];
    row.getCell(2).font = { bold: true };
    styleBody(row, sCols.length);
    for (let c = 4; c <= 18; c++) row.getCell(c).alignment = { horizontal: "center", vertical: "top" };
  }
  r += 1;
  summary.getCell(r, 1).value =
    "Should = working days (Monday to Saturday, excluding public holidays) from the day the person was hired or had a login. Actual = days and hours checked in by the app. Absence = working days with no check-in, no approved leave and no HR excuse (Staff Technicians only). Late from 08:30 and Leave Early before the end of the shift, by the time the app recorded. Hours are shift hours: 08:00-17:00 weekdays, 08:00-13:00 Saturday.";
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
    wHeader.values = ["Staff Code", "Name", "Date", "Open for", "Overtime that day", "Overtime status", "Action"];
    styleHeader(wHeader);
    for (const w of input.warnings) {
      const t = input.technicians?.find((x) => x.employeeId === w.employeeId);
      const row = summary.getRow(r++);
      row.values = [
        t?.code ?? "—",
        w.name,
        dayLabel(w.day),
        span(w.openMinutes),
        w.overtime ? span(w.overtime.minutes) : "—",
        w.overtime ? (w.overtime.status === "APPROVED" ? "Approved" : "Pending") : "—",
        w.overtime ? (w.overtime.status === "APPROVED" ? "Review the approval" : "Check before approving") : "Check the hours",
      ];
      styleBody(row, 7);
    }
  }
  pageSetup(summary, sHeaderRow);

  // ---- Daily Report: one row per person per day, In1/Out1..In3/Out3 as on the AiFace report
  const dailySheet = workbook.addWorksheet("Daily Report");
  const dCols = [
    { header: "Staff Code", width: 8 },
    { header: "Name", width: 22 },
    { header: "Date", width: 16 },
    { header: "Shift", width: 12 },
    { header: "In1", width: 7 },
    { header: "Out1", width: 10 },
    { header: "In2", width: 7 },
    { header: "Out2", width: 10 },
    { header: "In3", width: 7 },
    { header: "Out3", width: 10 },
    { header: "Actual (Hrs)", width: 8 },
    { header: "Late In (Mins)", width: 8 },
    { header: "Early Out (Mins)", width: 9 },
    { header: "Status", width: 12 },
  ];
  dCols.forEach((c, i) => (dailySheet.getColumn(i + 1).width = c.width));
  letterhead(dailySheet, logoId, period, dCols.length);
  dailySheet.getRow(sHeaderRow).values = dCols.map((c) => c.header);
  styleHeader(dailySheet.getRow(sHeaderRow));
  const STATUS: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LEAVE: "Leave", HOLIDAY: "Holiday", EXCUSED: "Excused", REST: "Rest day" };
  r = sHeaderRow + 1;
  for (const t of input.technicians ?? []) {
    for (const d of t.daily) {
      const out = (i: number) => {
        const pp = d.punches[i];
        if (!pp) return "";
        if (pp.out === null) return "Not out";
        return pp.outNextDay ? `${pp.out} (+1 day)` : pp.out;
      };
      const row = dailySheet.getRow(r++);
      row.values = [
        t.code ?? "—",
        t.name,
        `${weekday(d.day)} ${dayLabel(d.day)}`,
        d.shift ?? "—",
        d.punches[0]?.in ?? "",
        out(0),
        d.punches[1]?.in ?? "",
        out(1),
        d.punches[2]?.in ?? "",
        out(2) + (d.punches.length > 3 ? ` (+${d.punches.length - 3} more)` : ""),
        d.punches.length ? hrs(d.minutes) : "",
        d.lateMinutes || "",
        d.earlyMinutes || "",
        STATUS[d.status],
      ];
      styleBody(row, dCols.length);
      for (let c = 4; c <= 14; c++) row.getCell(c).alignment = { horizontal: "center", vertical: "top" };
      if (d.status === "ABSENT") row.getCell(14).font = { bold: true, color: { argb: RED } };
      if (d.lateMinutes || d.earlyMinutes) for (const c of [12, 13]) row.getCell(c).font = { bold: true, color: { argb: "FF9A3412" } };
    }
  }
  dailySheet.autoFilter = { from: { row: sHeaderRow, column: 1 }, to: { row: sHeaderRow, column: dCols.length } };
  pageSetup(dailySheet, sHeaderRow);

  // ---- Register
  const register = workbook.addWorksheet("Register");
  const cols = [
    { header: "Staff", width: 22 },
    { header: "Date", width: 14 },
    { header: "Work Order", width: 10 },
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
    { header: "Verification", width: 16 },
    { header: "Time Flag (in / out)", width: 12 },
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
      v.workOrder?.workOrderNumber ?? "",
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
      verification(v),
      [timeGap(v.checkInDeclaredTime, v.checkInAt), timeGap(v.checkOutDeclaredTime, v.checkOutAt)].filter(Boolean).join(" / "),
    ];
    styleBody(row, cols.length);
    row.getCell(13).numFmt = "#,##0.00";
    for (const c of [3, 4, 5, 8, 9, 12, 14, 18]) row.getCell(c).alignment = { horizontal: "center", vertical: "top", wrapText: true };
    if (input.late.has(v.id) || overtime || remarks.length) for (const c of [14, 15, 16]) row.getCell(c).font = { bold: true, color: { argb: "FF9A3412" } };
    if (row.getCell(17).value === "Flagged") row.getCell(17).font = { bold: true, color: { argb: RED } };
  }
  if (visits.length === 0) register.getCell(r, 1).value = "No check-ins recorded for this period.";
  register.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: cols.length } };
  pageSetup(register, headerRow);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
