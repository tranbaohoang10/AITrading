export function PlaceholderView({ title }: { title: string }) {
  return (
    <section aria-label={title} data-testid="placeholder-view" className="grid h-full min-h-[360px] place-items-center p-6 text-center">
      <div className="max-w-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-sm border border-slate-700 bg-slate-900 text-xl" aria-hidden="true">◇</span><h2 className="mt-4 text-lg font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">This navigation destination is reserved for a future approved module.</p></div>
    </section>
  )
}
