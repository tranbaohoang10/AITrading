import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { brand } from './brand'

document.title = brand.name

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
