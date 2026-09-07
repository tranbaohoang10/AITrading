import { TradingProvider } from './context/TradingContext'
import { AppShell } from './components/AppShell'
import { ReplayHost } from './replay/ReplayHost'

export function App() {
  return (
    <TradingProvider>
      <ReplayHost><AppShell /></ReplayHost>
    </TradingProvider>
  )
}
