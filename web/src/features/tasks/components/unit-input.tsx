/** 오른쪽에 단위가 붙은 숫자 입력 */
export function UnitInput({ id, value, unit, onChange }: { id: string; value: number; unit: string; onChange?: (v: number) => void }) {
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-md border border-input transition-colors focus-within:border-foreground/25 focus-within:ring-2 focus-within:ring-foreground/5">
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[13px] outline-none"
      />
      <span className="px-2.5 text-xs text-muted-foreground">{unit}</span>
    </div>
  )
}
