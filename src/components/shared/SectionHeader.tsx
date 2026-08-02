export function SectionHeader({
  id,
  title,
  blurb,
}: {
  id: string
  title: string
  blurb: string
}) {
  return (
    <div id={id} className="scroll-mt-16 border-b border-pj-faint pb-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl tracking-[0.3em]">{title}</h2>
        <span className="pj-dim flex-1 overflow-hidden text-xs">
          {'─'.repeat(120)}
        </span>
      </div>
      <p className="pj-dim mt-2 max-w-2xl text-sm leading-relaxed">{blurb}</p>
    </div>
  )
}
