export function Stat({
  label,
  value,
  vein,
}: {
  label: string
  value: string
  vein?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={vein ? 'pj-vein text-[26px]' : 'text-[26px]'}>{value}</span>
      <span className="pj-dim text-[13px] tracking-widest">{label}</span>
    </div>
  )
}
