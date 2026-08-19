import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { INSIGHT_ROLES } from "../lib/roles";

const router = Router();

router.use(requireAuth, requireRole(...INSIGHT_ROLES));

router.get("/summary", async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
    prisma.workOrder.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.invoice.aggregate({ _sum: { total: true }, where: { status: "OVERDUE" } }),
    prisma.maintenanceRequest.count({ where: { status: { in: ["SUBMITTED", "SCHEDULED"] } } }),
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
