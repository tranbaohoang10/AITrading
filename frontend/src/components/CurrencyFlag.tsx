const stars = (positions: number[][], color: string, radius = 2) => positions.map(([horizontal, vertical], index) => <path key={index} fill={color} transform={`translate(${horizontal} ${vertical}) scale(${radius})`} d="M0-1 .224-.309 .951-.309 .363 .118 .588 .809 0 .382-.588 .809-.363 .118-.951-.309-.224-.309Z" />)

function UnionJack() {
  return <><rect width="30" height="20" fill="#012169" /><path d="m0 0 30 20m0-20L0 20" stroke="white" strokeWidth="5" /><path d="m0 0 30 20m0-20L0 20" stroke="#c8102e" strokeWidth="2" /><path d="M15 0v20M0 10h30" stroke="white" strokeWidth="7" /><path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="4" /></>
}

export function CurrencyFlag({ currency }: { currency: string }) {
  return <svg aria-hidden="true" viewBox="0 0 30 20" width="24" height="16" className="rounded-sm" data-currency={currency}>
    {currency === 'EUR' && <><rect width="30" height="20" fill="#003399" />{stars(Array.from({ length: 12 }, (_, index) => [15 + 6 * Math.sin(index * Math.PI / 6), 10 - 6 * Math.cos(index * Math.PI / 6)]), '#ffcc00', 1.4)}</>}
    {currency === 'USD' && <><rect width="30" height="20" fill="white" />{Array.from({ length: 7 }, (_, index) => <rect key={index} y={index * 40 / 13} width="30" height={20 / 13} fill="#b22234" />)}<rect width="13" height={140 / 13} fill="#3c3b6e" />{stars(Array.from({ length: 20 }, (_, index) => [1.5 + index % 5 * 2.5, 1.5 + Math.floor(index / 5) * 2.5]), 'white', .7)}</>}
    {currency === 'GBP' && <UnionJack />}
    {currency === 'JPY' && <><rect width="30" height="20" fill="white" /><circle cx="15" cy="10" r="6" fill="#bc002d" /></>}
    {currency === 'CHF' && <><rect width="30" height="20" fill="#d52b1e" /><path d="M15 4v12M9 10h12" stroke="white" strokeWidth="4" /></>}
    {currency === 'CAD' && <><rect width="30" height="20" fill="white" /><path d="M0 0h7v20H0zm23 0h7v20h-7z" fill="#d80621" /><path d="m15 3 2 4 2-1-1 5 3-2 1 3-6 3v3h-2v-3l-6-3 1-3 3 2-1-5 2 1z" fill="#d80621" /></>}
    {(currency === 'AUD' || currency === 'NZD') && <><rect width="30" height="20" fill="#012169" /><g transform="scale(.5)"><UnionJack /></g>{stars([[23, 5], [19, 10], [26, 10], [23, 16]], 'white', currency === 'NZD' ? 2 : 1.8)}{currency === 'NZD' ? stars([[23, 5], [19, 10], [26, 10], [23, 16]], '#c8102e', 1.2) : stars([[8, 15], [25, 13]], 'white', 2)}</>}
  </svg>
}
