import { useAuth } from './context/AuthContext'

function DashboardHome() {
  const { user } = useAuth()

  return (
    <>
      <h1>Overview</h1>
      <p>Welcome back, {user?.name || user?.email}. Dashboard modules will go here.</p>
    </>
  )
}

export default DashboardHome
