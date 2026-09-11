import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ToastProvider } from './dashboard/ToastContext.tsx'
import { ConfirmProvider } from './dashboard/ConfirmContext.tsx'
import { initInstallSupport } from './lib/installPrompt'
import { registerServiceWorker } from './lib/pushNotifications'

// Before rendering: the install prompt event can fire almost immediately. The service worker is
// registered on every page (login and portal included), so the app is saved for offline use from
// the very first visit rather than only after signing in.
initInstallSupport()
void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
