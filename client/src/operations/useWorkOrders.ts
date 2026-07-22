import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { WorkOrder } from '../lib/api'

export function useWorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])

  useEffect(() => {
    api.listWorkOrders().then(({ workOrders }) => setWorkOrders(workOrders))
  }, [])

  return workOrders
}
