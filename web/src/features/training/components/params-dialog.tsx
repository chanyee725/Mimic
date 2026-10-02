import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useDraftOnOpen } from "@/hooks/use-draft-on-open"
import { cn } from "@/lib/utils"

import { PARAM_GROUPS, overrideFlags, trainCommand, type Overrides, type Param, type ParamValue } from "../lib"

function ParamField({ param, value, onChange }: { param: Param; value: ParamValue; onChange: (v: ParamValue) => void }) {
  const changed = value !== param.default
  const id = `p-${param.key}`
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 py-2">
      <label htmlFor={id} className="grid min-w-0 gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px]">
          {param.label}
          {changed && <span className="size-1.5 rounded-full bg-info" aria-label="changed" />}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          --{param.key}
          {param.hint && `, ${param.hint}`}
        </span>
      </label>
      {typeof param.default === "boolean" ? (
        <Switch id={id} className="justify-self-end" checked={value as boolean} onCheckedChange={(v) => onChange(v)} />
      ) : (
        <Input
          id={id}
          className={cn("h-8 text-right text-[13px] tabular-nums", changed && "border-info/50")}
          value={String(value)}
          inputMode={typeof param.default === "number" ? "numeric" : "decimal"}
          placeholder={String(param.default)}
          onChange={(e) => {
            const raw = e.target.value
            onChange(typeof param.default === "number" && raw.trim() !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : raw)
          }}
        />
      )}
    </div>
  )
}

/** 학습 파라미터 모달. 바꾼 값만 overrides 로 돌려준다 */
export function ParamsDialog({
  open,
  onOpenChange,
  overrides,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  overrides: Overrides
  onSave: (o: Overrides) => void
}) {
  // 열 때마다 저장된 값에서 시작한다
  const [draft, setDraft] = useDraftOnOpen<Overrides>(open, overrides)

  const valueOf = (p: Param) => (p.key in draft ? draft[p.key] : p.default)
  const flags = overrideFlags(draft)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Training parameters</DialogTitle>
          <DialogDescription>바꾸지 않은 값은 SmolVLA 기본값으로 학습합니다.</DialogDescription>
        </DialogHeader>

        <div className="-mx-4 min-h-0 overflow-y-auto px-4">
          {PARAM_GROUPS.map((g) => (
            <section key={g.title} className="border-b py-2 last:border-b-0">
              <h3 className="pt-1 text-xs font-medium text-muted-foreground">{g.title}</h3>
              <div className="divide-y">
                {g.params.map((p) => (
                  <ParamField key={p.key} param={p} value={valueOf(p)} onChange={(v) => setDraft((d) => ({ ...d, [p.key]: v }))} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Command</span>
          <pre className="max-h-24 overflow-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
            {trainCommand("<dataset>", flags)}
          </pre>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <Button variant="ghost" size="sm" disabled={flags.length === 0} onClick={() => setDraft({})}>
            Reset to defaults
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
