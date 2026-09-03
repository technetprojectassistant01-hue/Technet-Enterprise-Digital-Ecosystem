import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { INSIGHT_ROLES } from "../lib/roles";

const router = Router();

router.use(requireAuth, requireRole(...INSIGHT_ROLES));

router.get("/summary", async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // "Overdue" as a status is a manual dropdown value nobody is required to set (see
  // invoices.ts) - computing it from dueDate directly means this KPI stays accurate even if
  // nobody ever flips an invoice's status by hand.
  const overdueWhere: Prisma.InvoiceWhereInput = { status: { in: ["SENT", "OVERDUE"] }, dueDate: { lt: now } };

  // Independent read-only aggregates, no cross-table consistency requirement between them
  // (this is a best-effort snapshot dashboard, not a ledger) - run in parallel rather than
  // wrapped in a single $transaction, since Neon's cold-start latency can push a batched
  // transaction of this many queries past Prisma's transaction timeout.
  const [
    monthlyRevenue,
    activeProjects,
    activeWorkOrders,
    overdueInvoiceCount,
    overdueInvoiceSum,
    openMaintenanceRequests,
    techniciansOnSite,
    inventoryItems,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { status: "PAID", paidAt: { gte: startOfMonth } },
    }),
    prisma.project.count({ where: { status: "IN_PROGRESS" } }),
    prisma.workOrder.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "WAITING_FOR_PARTS", "REOPENED"] } } }),
    prisma.invoice.count({ where: overdueWhere }),
    prisma.invoice.aggregate({ _sum: { total: true }, where: overdueWhere }),
    prisma.maintenanceRequest.count({ where: { status: { in: ["SUBMITTED", "SCHEDULED"] } } }),
    // Office check-ins (no linked work order) shouldn't count as "on site" here.
    prisma.siteAttendance.count({ where: { checkOutAt: null } }),
    prisma.inventoryItem.findMany({ select: { quantity: true, minStockLevel: true } }),
  ]);

  const lowStockItems = inventoryItems.filter((item) => item.quantity <= item.minStockLevel).length;

  res.json({
    summary: {
      monthlyRevenue: Number(monthlyRevenue._sum.total ?? 0),
      activeProjects,
      activeWorkOrders,
      overdueInvoices: {
        count: overdueInvoiceCount,
        total: Number(overdueInvoiceSum._sum.total ?? 0),
      },
      openMaintenanceRequests,
      lowStockItems,
      techniciansOnSite,
      generatedAt: now.toISOString(),
    },
  });
});

export default router;
