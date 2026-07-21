import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { Customer } from '../lib/api'

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    api.listCustomers().then(({ customers }) => setCustomers(customers))
  }, [])

  return customers
}
