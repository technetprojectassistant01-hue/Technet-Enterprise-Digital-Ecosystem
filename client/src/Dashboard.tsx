import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import './Dashboard.css'

const NAV_ITEMS = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'Employees', to: '/dashboard/employees' },
  { label: 'Projects', to: '/dashboard/projects' },
  { label: 'Reports', to: '/dashboard/reports' },
]

function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">Technet ERP</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'}>
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <NavLink to="/dashboard/users">User Management</NavLink>
          )}
          <NavLink to="/dashboard/settings">Settings</NavLink>
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <span />
          <div className="user-info">
            <span className="name">{user?.name || user?.email}</span>
            <span className="role">{user?.role}</span>
            <button type="button" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Dashboard
