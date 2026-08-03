import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { MaintenanceContract } from '../lib/api'

export function useMaintenanceContracts() {
  const [contracts, setContracts] = useState<MaintenanceContract[]>([])

  useEffect(() => {
    api.listMaintenanceContracts().then(({ contracts }) => setContracts(contracts))
  }, [])

  return contracts
}
