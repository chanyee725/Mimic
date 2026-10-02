import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** 값 ↔ 표시 이름이 다른 선택 상자 */
export function ChoiceSelect<T extends string | number>({
  id,
  value,
  options,
  onChange,
}: {
  id?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => v !== null && onChange(options.find((o) => String(o.value) === v)!.value)}>
      <SelectTrigger id={id} className="h-8 w-full text-[13px]">
        <SelectValue>{(v: string) => options.find((o) => String(o.value) === v)?.label ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={String(o.value)} value={String(o.value)} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
