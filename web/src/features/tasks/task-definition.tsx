import { LuPlus } from "react-icons/lu"

import { SettingsGroup, SettingsSection } from "@/components/app/settings-section"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ALIGNMENT_MODES } from "@/dummy/convert"
import { SO101_JOINTS } from "@/dummy/robot"
import type { Alignment, Outcome, Task } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

const ROBOTS = ["SO-101 Follower", "SO-101 Bimanual"]
const TELEOPS = ["SO-101 Leader", "Data Glove (R)", "Keyboard / Gamepad"]
const OUTCOME_TONE: Record<Outcome, Tone> = { success: "ok", fail: "bad", partial: "warn" }

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

function UnitInput({
  id,
  value,
  unit,
  locked,
  onChange,
}: {
  id: string
  value: number
  unit: string
  locked?: boolean
  onChange?: (v: number) => void
}) {
  return (
    <div
      className={cn(
        "flex h-9 items-center overflow-hidden rounded-md border border-input",
        locked && "bg-muted",
      )}
    >
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        readOnly={locked}
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

const asOptions = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))

export function TaskDefinition({ task, onChange }: Props) {
  const setVariant = (i: number, v: string) =>
    onChange({ variants: task.variants.map((x, k) => (k === i ? v : x)) })
  const setSubtask = (i: number, patch: Partial<Task["subtasks"][number]>) =>
    onChange({ subtasks: task.subtasks.map((s, k) => (k === i ? { ...s, ...patch } : s)) })

  return (
    <SettingsGroup className="-mx-5 rounded-none border-x-0 border-b-0">
      <SettingsSection
        title="General"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Task name" htmlFor="t-name">
            <Input id="t-name" className="h-9" value={task.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <Field label="Task ID" htmlFor="t-id">
            <Input id="t-id" className="h-9 bg-muted font-mono text-[13px]" value={task.id} readOnly />
          </Field>
        </div>
        <Field label="Language instruction" htmlFor="t-instr">
          <Textarea
            id="t-instr"
            rows={2}
            value={task.instruction}
            onChange={(e) => onChange({ instruction: e.target.value })}
          />
        </Field>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">Variants</span>
          <div className="divide-y rounded-md border">
            {task.variants.map((v, i) => (
              <input
                key={i}
                aria-label={`Variant ${i + 1}`}
                value={v}
                onChange={(e) => setVariant(i, e.target.value)}
                className="w-full bg-transparent px-3 py-2 text-sm outline-none focus-visible:bg-muted/50"
              />
            ))}
            <button
              type="button"
              onClick={() => onChange({ variants: [...task.variants, ""] })}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px] text-muted-foreground hover:text-foreground"
            >
              <LuPlus className="size-3.5" />
              Add variant
            </button>
          </div>
        </div>
        <Field label="Tags" htmlFor="t-tags">
          <Input
            id="t-tags"
            className="h-9"
            value={task.tags.join(", ")}
            onChange={(e) => onChange({ tags: e.target.value.split(",").map((s) => s.trim()) })}
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Robot & sensors"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Robot" htmlFor="t-robot">
            <SimpleSelect id="t-robot" value={task.robot} options={asOptions(ROBOTS)} onChange={(robot) => onChange({ robot })} />
          </Field>
          <Field label="Teleop" htmlFor="t-teleop">
            <SimpleSelect id="t-teleop" value={task.teleop} options={asOptions(TELEOPS)} onChange={(teleop) => onChange({ teleop })} />
          </Field>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">
            Action space <span className="font-normal text-muted-foreground">· {SO101_JOINTS.length} DoF</span>
          </span>
          <span className="font-mono text-xs leading-relaxed text-muted-foreground">{SO101_JOINTS.join(" · ")}</span>
        </div>
        <div className="divide-y rounded-md border">
          {task.sensors.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 px-3 py-2.5">
              <div className="grid flex-1 gap-0.5">
                <span className="text-sm">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.spec}</span>
              </div>
              <Switch
                aria-label={s.name}
                checked={s.enabled}
                onCheckedChange={(enabled) =>
                  onChange({ sensors: task.sensors.map((x, k) => (k === i ? { ...x, enabled } : x)) })
                }
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Recording"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Action rate" htmlFor="r-action">
            <UnitInput id="r-action" value={task.actionHz} unit="Hz" locked />
          </Field>
          <Field label="Video rate" htmlFor="r-video">
            <UnitInput id="r-video" value={task.videoFps} unit="fps" locked />
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

      <SettingsSection
        title="Labels & success"
      >
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">Outcome</span>
          <div className="flex flex-wrap gap-4">
            {task.outcomes.map((o) => (
              <StatusDot key={o.value} tone={OUTCOME_TONE[o.value]}>
                {o.value}
                <Kbd className="ml-1 font-mono">{o.key}</Kbd>
              </StatusDot>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium">Subtask segments</span>
          <div className="divide-y rounded-md border">
            {task.subtasks.map((s, i) => (
              <div key={i} className="grid h-9 grid-cols-[28px_96px_minmax(0,1fr)] items-center px-3">
                <Kbd className="font-mono">{s.key}</Kbd>
                <input
                  aria-label={`Subtask ${s.key} name`}
                  value={s.name}
                  onChange={(e) => setSubtask(i, { name: e.target.value })}
                  className="bg-transparent font-mono text-[13px] outline-none"
                />
                <input
                  aria-label={`Subtask ${s.key} description`}
                  value={s.description}
                  onChange={(e) => setSubtask(i, { description: e.target.value })}
                  className="bg-transparent text-[13px] text-muted-foreground outline-none"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  subtasks: [...task.subtasks, { key: String(task.subtasks.length + 1), name: "", description: "" }],
                })
              }
              className="flex h-9 w-full items-center gap-1.5 px-3 text-left text-[13px] text-muted-foreground hover:text-foreground"
            >
              <LuPlus className="size-3.5" />
              Add segment
            </button>
          </div>
        </div>
        <Field label="Success criteria" htmlFor="t-crit">
          <Textarea
            id="t-crit"
            rows={2}
            value={task.successCriteria}
            onChange={(e) => onChange({ successCriteria: e.target.value })}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Output">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="repo_id" htmlFor="o-repo">
            <Input
              id="o-repo"
              className="h-9 font-mono text-[13px]"
              value={task.repoId}
              onChange={(e) => onChange({ repoId: e.target.value })}
            />
          </Field>
          <Field label="Alignment" htmlFor="o-align">
            <SimpleSelect
              id="o-align"
              value={task.alignment}
              options={ALIGNMENT_MODES.map((m) => ({ value: m.id, label: m.title }))}
              onChange={(v) => onChange({ alignment: v as Alignment })}
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
