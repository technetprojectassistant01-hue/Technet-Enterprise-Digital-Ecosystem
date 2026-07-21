import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { Employee } from '../lib/api'

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    api.listEmployees().then(({ employees }) => setEmployees(employees))
  }, [])

  return employees
}
