import { useAuth } from './context/AuthContext'
import './Dashboard.css'

const NAV_ITEMS = ['Overview', 'Employees', 'Projects', 'Reports', 'Settings']

function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">Technet ERP</div>
        <nav>
          {NAV_ITEMS.map((item, i) => (
            <a key={item} className={i === 0 ? 'active' : ''} href="#">
              {item}
            </a>
          ))}
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
          <h1>Overview</h1>
          <p>Welcome back, {user?.name || user?.email}. Dashboard modules will go here.</p>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
