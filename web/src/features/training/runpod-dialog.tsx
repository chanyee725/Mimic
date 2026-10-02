import { useState } from "react"

import { Segmented } from "@/components/app/segmented"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { RUNPOD_DEFAULTS, RUNPOD_REGIONS, RUNPOD_VOLUMES, type RunPodOptions } from "@/dummy/training"
import { formatRate, formatUsd } from "@/lib/format"

import { runpodRate } from "./jobs"

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_14rem] items-center gap-4 py-2.5">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-[13px]">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex justify-end">{children}</div>
    </div>
  )
}

/** RunPod pod 설정 모달 */
export function RunPodDialog({
  open,
  onOpenChange,
  gpu,
  basePrice,
  options,
  onSave,
  communityOk = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  gpu: string
  basePrice: number
  options: RunPodOptions
  onSave: (o: RunPodOptions) => void
  /** 고른 GPU 를 Community cloud 에서도 빌릴 수 있는지 */
  communityOk?: boolean
}) {
  const [draft, setDraft] = useState(options)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setDraft(options)
  }
  const set = <K extends keyof RunPodOptions>(k: K, v: RunPodOptions[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const rate = runpodRate(basePrice, draft)
  const capHours = draft.budget ? Math.min(draft.maxHours || Infinity, draft.budget / rate) : draft.maxHours

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>RunPod options</DialogTitle>
          <DialogDescription>{gpu} pod 를 어떻게 빌릴지 정합니다. 요금은 예시 값입니다.</DialogDescription>
        </DialogHeader>

        <div className="-mx-4 min-h-0 divide-y overflow-y-auto px-4">
          <section className="py-1.5">
            <h3 className="pt-1 text-xs font-medium text-muted-foreground">Pod</h3>
            <Row
              label="Cloud"
              hint={
                communityOk ? "Community 는 개인 호스트라 더 싸지만 성능 편차가 있습니다" : `${gpu} 는 Secure cloud 에서만 빌릴 수 있습니다`
              }
            >
              <Segmented
                role="radiogroup"
                fill
                label="Cloud"
                value={draft.cloud}
                onChange={(v) => set("cloud", v)}
                options={[
                  { value: "secure", label: "Secure" },
                  ...(communityOk ? [{ value: "community" as const, label: "Community" }] : []),
                ]}
              />
            </Row>
            <Row label="Pricing" hint="Spot 은 절반 가격이지만 중간에 회수될 수 있습니다. 마지막 checkpoint 에서 이어 학습합니다">
              <Segmented
                role="radiogroup"
                fill
                label="Pricing"
                value={draft.pricing}
                onChange={(v) => set("pricing", v)}
                options={[
                  { value: "on-demand", label: "On-demand" },
                  { value: "spot", label: "Spot" },
                ]}
              />
            </Row>
            <Row label="GPU count">
              <Segmented
                role="radiogroup"
                fill
                label="GPU count"
                value={draft.gpuCount}
                onChange={(v) => set("gpuCount", v)}
                options={[
                  { value: 1, label: "1" },
                  { value: 2, label: "2" },
                  { value: 4, label: "4" },
                ]}
              />
            </Row>
            <Row label="Region">
              <Select value={draft.region} onValueChange={(v) => v && set("region", v as string)}>
                <SelectTrigger className="h-8 w-full text-[13px]">
                  <SelectValue>{(v: string) => (v === "any" ? "Any available" : v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RUNPOD_REGIONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-[13px]">
                      {r === "any" ? "Any available" : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </section>

          <section className="py-1.5">
            <h3 className="pt-1 text-xs font-medium text-muted-foreground">Time and cost</h3>
            <Row label="Max runtime" hint="이 시간이 지나면 마지막 checkpoint 를 저장하고 멈춥니다. 0 이면 제한 없음">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-24 text-right text-[13px] tabular-nums"
                  inputMode="decimal"
                  value={draft.maxHours}
                  onChange={(e) => set("maxHours", Number(e.target.value) || 0)}
                  aria-label="Max runtime in hours"
                />
                <span className="text-xs text-muted-foreground">hours</span>
              </div>
            </Row>
            <Row label="Budget cap" hint="누적 비용이 넘으면 멈춥니다. 0 이면 제한 없음">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  className="h-8 w-24 text-right text-[13px] tabular-nums"
                  inputMode="decimal"
                  value={draft.budget}
                  onChange={(e) => set("budget", Number(e.target.value) || 0)}
                  aria-label="Budget cap in USD"
                />
              </div>
            </Row>
          </section>

          <section className="py-1.5">
            <h3 className="pt-1 text-xs font-medium text-muted-foreground">Storage</h3>
            <Row label="Container disk">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-24 text-right text-[13px] tabular-nums"
                  inputMode="numeric"
                  value={draft.diskGB}
                  onChange={(e) => set("diskGB", Number(e.target.value) || 0)}
                  aria-label="Container disk in GB"
                />
                <span className="text-xs text-muted-foreground">GB</span>
              </div>
            </Row>
            <Row label="Network volume" hint={RUNPOD_VOLUMES.find((v) => v.id === draft.volume)?.note}>
              <Select value={draft.volume} onValueChange={(v) => v && set("volume", v as string)}>
                <SelectTrigger className="h-8 w-full text-[13px]">
                  <SelectValue>{(v: string) => RUNPOD_VOLUMES.find((x) => x.id === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RUNPOD_VOLUMES.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-[13px]">
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </section>

          <section className="py-1.5">
            <h3 className="pt-1 text-xs font-medium text-muted-foreground">When training ends</h3>
            <Row label="Terminate pod" hint="끝나면 바로 꺼서 요금이 더 나가지 않게 합니다">
              <Switch checked={draft.terminateOnFinish} onCheckedChange={(v) => set("terminateOnFinish", v)} />
            </Row>
            <Row label="Push last checkpoint to HF Hub" hint="private 저장소로 올립니다">
              <Switch checked={draft.pushToHub} onCheckedChange={(v) => set("pushToHub", v)} />
            </Row>
          </section>
        </div>

        <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2.5 text-[13px] tabular-nums">
          <span>
            {formatRate(rate)}
            <span className="text-muted-foreground">
              {" "}
              ({draft.gpuCount} × {gpu})
            </span>
          </span>
          <span className="text-muted-foreground">
            {capHours ? (
              <>
                max <span className="text-foreground">{formatUsd(rate * capHours)}</span> for {capHours.toFixed(1)} h
              </>
            ) : (
              "no limit"
            )}
          </span>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setDraft(RUNPOD_DEFAULTS)}>
            Reset
          </Button>
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={() => {
                onSave(draft)
                onOpenChange(false)
              }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
