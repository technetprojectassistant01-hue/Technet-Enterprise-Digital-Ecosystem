import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import inventoryRouter from "./routes/inventory";
import customersRouter from "./routes/customers";
import invoicesRouter from "./routes/invoices";
import expensesRouter from "./routes/expenses";
import quotationsRouter from "./routes/quotations";
import contractsRouter from "./routes/contracts";
import employeesRouter from "./routes/employees";
import leaveRouter from "./routes/leave";
import attendanceRouter from "./routes/attendance";
import certificationsRouter, { trainingRouter } from "./routes/certifications";
import projectsRouter from "./routes/projects";
import suppliersRouter from "./routes/suppliers";
import requisitionsRouter from "./routes/requisitions";
import purchaseOrdersRouter from "./routes/purchaseOrders";
import workOrdersRouter from "./routes/workOrders";
import dailyReportsRouter from "./routes/dailyReports";
import interventionReportsRouter from "./routes/interventionReports";
import documentsRouter from "./routes/documents";
import assetsRouter from "./routes/assets";
import maintenanceContractsRouter from "./routes/maintenanceContracts";
import maintenanceRequestsRouter from "./routes/maintenanceRequests";
import maintenanceSchedulesRouter from "./routes/maintenanceSchedules";
import payrollRouter from "./routes/payroll";
import siteAttendanceRouter from "./routes/siteAttendance";
import insightRouter from "./routes/insight";
import { requireAuth, requireRole } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 4000;

// Railway (and most PaaS hosts) sit behind a reverse proxy, so req.ip is the
// proxy's address unless this is set - needed for rate limiting to key on
// the real client IP instead of limiting everyone together.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/customers", customersRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/quotations", quotationsRouter);
app.use("/api/contracts", contractsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/certifications", certificationsRouter);
app.use("/api/training", trainingRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/requisitions", requisitionsRouter);
app.use("/api/purchase-orders", purchaseOrdersRouter);
app.use("/api/work-orders", workOrdersRouter);
app.use("/api/daily-reports", dailyReportsRouter);
app.use("/api/intervention-reports", interventionReportsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/maintenance-assets", assetsRouter);
app.use("/api/maintenance-contracts", maintenanceContractsRouter);
app.use("/api/maintenance-requests", maintenanceRequestsRouter);
app.use("/api/maintenance-schedules", maintenanceSchedulesRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/site-attendance", siteAttendanceRouter);
app.use("/api/insight", insightRouter);

app.get("/api/admin/ping", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.json({ ok: true, message: "You have admin access" });
});

app.use("/api", notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
