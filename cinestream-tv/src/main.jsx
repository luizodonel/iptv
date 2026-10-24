import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSecurityProtection } from './services/securityService'
import { initGoogleCast } from './services/castService'

// Inicializa a proteção de código e inicializa o Google Cast SDK para transmissão na TV
initSecurityProtection();
initGoogleCast();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

