import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getRig, rigDefaults, RIGS } from "@/dummy/rigs"
import type { Task } from "@/dummy/tasks"

type Props = {
  task: Task
  onChange: (patch: Partial<Task>) => void
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
      </Label>
      {children}
    </div>
  )
}

function UnitInput({ id, value, unit, onChange }: { id: string; value: number; unit: string; onChange?: (v: number) => void }) {
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

function SimpleSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue>{options.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Rig 에서 불러온 읽기 전용 값 */
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-[13px]">{children}</span>
    </div>
  )
}

const rateOptions = (xs: number[], unit: string) => xs.map((x) => ({ value: String(x), label: `${x} ${unit}` }))

export function TaskDefinition({ task, onChange }: Props) {
  const rig = getRig(task.rigId)

  return (
    <SettingsGroup className="-mx-5 rounded-none border-x-0 border-b-0">
      <SettingsSection title="General">
        <div className="grid gap-3 @md:grid-cols-2">
          <Field label="Task name" htmlFor="t-name">
            <Input id="t-name" className="h-9" value={task.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <Field label="Task ID" htmlFor="t-id">
            <Input id="t-id" className="h-9 bg-muted font-mono text-[13px]" value={task.id} readOnly />
          </Field>
        </div>
        <Field label="Label" htmlFor="t-instr">
          <Textarea id="t-instr" rows={2} value={task.instruction} onChange={(e) => onChange({ instruction: e.target.value })} />
        </Field>
        <Field label="Tags" htmlFor="t-tags">
          <Input
            id="t-tags"
            className="h-9"
            value={task.tags.join(", ")}
            onChange={(e) => onChange({ tags: e.target.value.split(",").map((s) => s.trim()) })}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Rig">
        {/* Rig 를 바꾸면 Master/Slave, 주기, 카메라 기본값을 함께 불러온다. 라벨은 섹션 제목과 같아 숨긴다 */}
        <div>
          <Label htmlFor="t-rig" className="sr-only">
            Rig
          </Label>
          <SimpleSelect
            id="t-rig"
            value={rig.id}
            options={RIGS.map((r) => ({ value: r.id, label: r.name }))}
            onChange={(id) => onChange(rigDefaults(getRig(id)))}
          />
        </div>
        <div className="grid gap-x-4 gap-y-3 rounded-md bg-muted/50 px-3 py-2.5 @md:grid-cols-3">
          <Info label="Master">{rig.master}</Info>
          <Info label="Slave">{rig.slave}</Info>
          <Info label="Target rate">
            {rig.targetHz.action} Hz · {rig.targetHz.video} fps
          </Info>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">
            Action space <span className="font-normal text-muted-foreground">· {rig.joints.length} DoF</span>
          </span>
          <span className="text-xs leading-relaxed text-muted-foreground">{rig.joints.join(" · ")}</span>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">Cameras</span>
          <div className="divide-y rounded-md border">
            {rig.cameras.map((c) => {
              const on = task.cameras.includes(c.key)
              return (
                <div key={c.key} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {c.feature} · {c.resolution} @{c.fps}
                    </span>
                  </div>
                  <Switch
                    aria-label={c.name}
                    checked={on}
                    onCheckedChange={(checked) =>
                      onChange({ cameras: checked ? [...task.cameras, c.key] : task.cameras.filter((k) => k !== c.key) })
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Recording">
        <div className="grid gap-3 @lg:grid-cols-3">
          <Field label="Action rate" htmlFor="r-action">
            <SimpleSelect
              id="r-action"
              value={String(task.actionHz)}
              options={rateOptions(rig.actionHzOptions, "Hz")}
              onChange={(v) => onChange({ actionHz: Number(v) })}
            />
          </Field>
          <Field label="Video rate" htmlFor="r-video">
            <SimpleSelect
              id="r-video"
              value={String(task.videoFps)}
              options={rateOptions(rig.videoFpsOptions, "fps")}
              onChange={(v) => onChange({ videoFps: Number(v) })}
            />
          </Field>
          <Field label="Target episodes" htmlFor="r-target">
            <UnitInput id="r-target" value={task.targetEpisodes} unit="ep" onChange={(targetEpisodes) => onChange({ targetEpisodes })} />
          </Field>
          <Field label="Episode duration" htmlFor="r-dur">
            <UnitInput id="r-dur" value={task.durationS} unit="s" onChange={(durationS) => onChange({ durationS })} />
          </Field>
          <Field label="Reset time" htmlFor="r-reset">
            <UnitInput id="r-reset" value={task.resetS} unit="s" onChange={(resetS) => onChange({ resetS })} />
          </Field>
          <Field label="Countdown" htmlFor="r-count">
            <UnitInput id="r-count" value={task.countdownS} unit="s" onChange={(countdownS) => onChange({ countdownS })} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Output">
        <div className="grid gap-3">
          <Field label="repo_id" htmlFor="o-repo">
            <Input
              id="o-repo"
              className="h-9 font-mono text-[13px]"
              value={task.repoId}
              onChange={(e) => onChange({ repoId: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <Switch checked={task.pushToHub} onCheckedChange={(pushToHub) => onChange({ pushToHub })} />
          Push to HF Hub as private
        </label>
      </SettingsSection>
    </SettingsGroup>
  )
}
