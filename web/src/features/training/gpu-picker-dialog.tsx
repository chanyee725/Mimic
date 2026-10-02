import { useState } from "react"

import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RUNPOD_GPUS, type GpuStock, type RunPodGpu } from "@/dummy/training"
import { formatRate } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tier = "all" | "small" | "mid" | "large"
const TIERS: { id: Tier; label: string; fits: (g: RunPodGpu) => boolean }[] = [
  { id: "all", label: "All", fits: () => true },
  { id: "small", label: "≤ 24 GB", fits: (g) => g.vramGB <= 24 },
  { id: "mid", label: "32–48 GB", fits: (g) => g.vramGB > 24 && g.vramGB <= 48 },
  { id: "large", label: "80 GB+", fits: (g) => g.vramGB > 48 },
]

const STOCK: Record<GpuStock, { tone: Tone; label: string }> = {
  high: { tone: "ok", label: "Available" },
  low: { tone: "warn", label: "Low stock" },
  none: { tone: "muted", label: "Unavailable" },
}

/** SmolVLA 를 기본 batch 로 돌리기에 빠듯한 VRAM (대략치) */
const TIGHT_VRAM = 20

/** RunPod GPU 고르기. VRAM 구간으로 거르고 가격순으로 보여준다 */
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
  const [draft, setDraft] = useState(value)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setDraft(value)
  }
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

        <div className="flex rounded-md bg-muted p-0.5" role="tablist" aria-label="VRAM">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tier === t.id}
              onClick={() => setTier(t.id)}
              className={cn(
                "h-7 flex-1 rounded-[5px] text-xs transition-colors",
                tier === t.id ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="ml-1 text-muted-foreground tabular-nums">{RUNPOD_GPUS.filter(t.fits).length}</span>
            </button>
          ))}
        </div>

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
                      <StatusDot tone={STOCK[g.stock].tone} className="text-xs text-muted-foreground">
                        {STOCK[g.stock].label}
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
