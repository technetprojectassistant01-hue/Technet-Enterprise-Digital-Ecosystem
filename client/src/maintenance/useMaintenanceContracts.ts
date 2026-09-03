import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import type { MaintenanceContract } from '../lib/api'

/** Every contract, expired and cancelled ones included - right for filters and history views. */
export function useMaintenanceContracts() {
  const [contracts, setContracts] = useState<MaintenanceContract[]>([])

  useEffect(() => {
    api.listMaintenanceContracts().then(({ contracts }) => setContracts(contracts))
  }, [])

  return contracts
}

/**
 * Only contracts a visit can still be booked against. Note this filters on the stored status,
 * which nothing updates automatically - a contract whose expiryDate has passed stays ACTIVE
 * until somebody changes it, so it will still appear here.
 */
export function useSchedulableContracts() {
  const contracts = useMaintenanceContracts()
  return useMemo(() => contracts.filter((c) => c.status === 'ACTIVE'), [contracts])
}
