import { TradingProvider } from './context/TradingContext'
import { AppShell } from './components/AppShell'

export function App() {
  return (
    <TradingProvider>
      <AppShell />
    </TradingProvider>
  )
}
