import { prisma } from "./prisma";
import { geocodeAddress, MAIN_ISLAND_VIEWBOX } from "./geocode";

/**
 * Spec section 2: "if a job has a client address, geocode it once and store its coordinates on the
 * job". Runs in the background from the attendance poller, a couple of jobs per run - never while a
 * manager is saving a work order: a geocoding failure there once blocked saves (CLAUDE.md §27).
 *
 * Only open jobs with no site yet and never tried before (siteGeocodeAttemptedAt), so a customer
 * address Nominatim can't resolve is tried exactly once. The result is marked
 * siteFromCustomerAddress: one customer often has several sites (§7b), so this may be the office,
 * and FAR_FROM_JOB treats it as weaker evidence (MEDIUM). A manager setting the site on the work
 * order detail page replaces it.
 */
const PER_RUN = 2;

export async function geocodeMissingJobSites(): Promise<number> {
  const jobs = await prisma.workOrder.findMany({
    where: {
      siteLat: null,
      siteGeocodeAttemptedAt: null,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      customer: { address: { not: null } },
    },
    select: { id: true, customer: { select: { address: true } } },
    orderBy: { scheduledDate: "desc" },
    take: PER_RUN,
  });

  let located = 0;
  for (const job of jobs) {
    const address = job.customer.address?.trim();
    let result: Awaited<ReturnType<typeof geocodeAddress>> = null;
    if (address) {
      try {
        result = await geocodeAddress(address, { countryCode: "mu", timeoutMs: 8000, viewbox: MAIN_ISLAND_VIEWBOX });
      } catch {
        result = null;
      }
    }
    await prisma.workOrder.update({
      where: { id: job.id },
      data: result
        ? { siteLat: result.lat, siteLng: result.lng, siteAddress: result.displayName, siteFromCustomerAddress: true, siteGeocodeAttemptedAt: new Date() }
        : { siteGeocodeAttemptedAt: new Date() },
    });
    if (result) located += 1;
  }
  return located;
}
