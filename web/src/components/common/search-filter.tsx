import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { SearchInput } from "./search-input"

export type FilterOption<T extends string> = {
  value: T
  label: string
  /** Grey count after the label */
  count?: number
}

/** Search field with a compact filter select on its right (list panels such as Models and Environments) */
export function SearchFilter<T extends string>({
  search,
  onSearch,
  placeholder,
  filterLabel,
  filter,
  onFilter,
  options,
  className,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  /** Accessible name of the filter select */
  filterLabel: string
  filter: T
  onFilter: (value: T) => void
  options: readonly FilterOption<T>[]
  className?: string
}) {
  const current = options.find((o) => o.value === filter)
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SearchInput
        className="min-w-0 flex-1"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <Select value={filter} onValueChange={(v) => v && onFilter(v as T)}>
        <SelectTrigger
          aria-label={filterLabel}
          className="h-8 max-w-40 shrink-0 gap-1.5 border-transparent bg-muted text-[13px] shadow-none"
        >
          <SelectValue>
            <span className="truncate">{current?.label}</span>
            {current?.count !== undefined && <span className="text-muted-foreground tabular-nums">{current.count}</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-[13px]">
              <span className="flex-1 truncate">{o.label}</span>
              {o.count !== undefined && <span className="text-muted-foreground tabular-nums">{o.count}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
