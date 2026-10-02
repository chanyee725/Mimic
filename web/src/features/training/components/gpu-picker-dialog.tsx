import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Segmented } from "@/components/app/segmented"
import { StatusDot } from "@/components/app/status-dot"
import { RUNPOD_GPUS } from "@/dummy/training"
import { useDraftOnOpen } from "@/hooks/use-draft-on-open"
import { formatRate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { GPU_STOCK, TIERS, TIGHT_VRAM, type Tier } from "../lib"

/** RunPod GPU picker. Filters by VRAM tier and sorts by price */
export function GpuPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onSelect: (name: string) => void
}) {
  const [tier, setTier] = useState<Tier>("all")
  const [draft, setDraft] = useDraftOnOpen(open, value)
  const rows = RUNPOD_GPUS.filter(TIERS.find((t) => t.id === tier)!.fits).sort((a, b) => a.pricePerHr - b.pricePerHr)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(40rem,85svh)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a GPU</DialogTitle>
          <DialogDescription>
            Secure cloud on-demand 요금 기준이며 예시 값입니다. Community · Spot 할인은 RunPod options 에서 정합니다.
          </DialogDescription>
        </DialogHeader>

        <Segmented
          label="VRAM"
          fill
          value={tier}
          onChange={setTier}
          options={TIERS.map((t) => ({ value: t.id, label: t.label, count: RUNPOD_GPUS.filter(t.fits).length }))}
        />

        <div className="min-h-0 overflow-y-auto rounded-md border">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-normal">GPU</th>
                <th className="px-3 py-2 text-right font-normal">VRAM</th>
                <th className="px-3 py-2 text-right font-normal">Price</th>
                <th className="px-3 py-2 font-normal">Community</th>
                <th className="px-3 py-2 font-normal">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y" role="radiogroup" aria-label="GPU">
              {rows.map((g) => {
                const on = g.name === draft
                const off = g.stock === "none"
                return (
                  <tr
                    key={g.name}
                    role="radio"
                    aria-checked={on}
                    aria-disabled={off}
                    tabIndex={off ? -1 : 0}
                    onClick={() => !off && setDraft(g.name)}
                    onKeyDown={(e) => {
                      if (!off && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        setDraft(g.name)
                      }
                    }}
                    className={cn(
                      "cursor-pointer transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60",
                      on && "bg-accent hover:bg-accent",
                      off && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2.5">
                        <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-full border", on && "border-foreground")}>
                          {on && <span className="size-1.5 rounded-full bg-foreground" />}
                        </span>
                        <span className="grid">
                          <span className="font-medium">{g.name}</span>
                          {g.vramGB < TIGHT_VRAM && (
                            <span className="text-[11px] text-muted-foreground">batch size 를 줄여야 할 수 있음</span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.vramGB} GB</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRate(g.pricePerHr)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{g.community ? "Yes" : "—"}</td>
                    <td className="px-3 py-2">
                      <StatusDot tone={GPU_STOCK[g.stock].tone} className="text-xs text-muted-foreground">
                        {GPU_STOCK[g.stock].label}
                      </StatusDot>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={() => {
              onSelect(draft)
              onOpenChange(false)
            }}
          >
            Use {draft}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
