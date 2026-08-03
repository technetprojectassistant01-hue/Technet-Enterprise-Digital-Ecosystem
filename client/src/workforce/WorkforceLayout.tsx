import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'

const TABS = [{ label: 'Payroll', to: '/dashboard/workforce/payroll' }]

function WorkforceLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Workforce"
        subtitle="Payroll Preparation"
        tabs={TABS}
        searchPlaceholder="Search payroll runs..."
      />
      <Outlet />
    </div>
  )
}

export default WorkforceLayout
