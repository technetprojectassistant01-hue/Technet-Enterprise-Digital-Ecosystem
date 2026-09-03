import { useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import type { Employee } from '../lib/api'

/**
 * Every employee on file, including terminated ones. Right for filter dropdowns and HR views,
 * where looking up somebody who has since left is the whole point - a departed employee's
 * certifications, past leave, or final timesheet.
 *
 * For a picker that assigns future work, use useAssignableEmployees() instead.
 */
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    api.listEmployees().then(({ employees }) => setEmployees(employees))
  }, [])

  return employees
}

/** ON_LEAVE staff are still employed and can be scheduled for later; TERMINATED ones cannot. */
export function isAssignable(employee: Employee): boolean {
  return employee.employmentStatus !== 'TERMINATED'
}

/**
 * Only employees who can still be given work. Use this for any picker that assigns somebody to
 * something - work order technicians, project members and managers, maintenance visits, report
 * technicians. Plain useEmployees() lists terminated staff too, which let a departed employee be
 * assigned to next week's job with nothing to flag it.
 */
export function useAssignableEmployees() {
  const employees = useEmployees()
  return useMemo(() => employees.filter(isAssignable), [employees])
}
