import { LuSearch } from "react-icons/lu"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** 돋보기 아이콘이 붙은 회색 검색 칸 */
export function SearchInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("relative", className)}>
      <LuSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" className="h-8 border-transparent bg-muted pl-8 text-[13px]" {...props} />
    </div>
  )
}
