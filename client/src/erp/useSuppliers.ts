import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { Supplier } from '../lib/api'

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  useEffect(() => {
    api.listSuppliers().then(({ suppliers }) => setSuppliers(suppliers))
  }, [])

  return suppliers
}
