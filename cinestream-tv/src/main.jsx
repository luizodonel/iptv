import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSecurityProtection } from './services/securityService'

// Inicializa a proteção de código e bloqueio de DevTools/F12 desde o primeiro ciclo
initSecurityProtection();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

