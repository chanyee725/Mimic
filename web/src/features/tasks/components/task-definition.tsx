import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { useRigs } from "@/api/rigs"
import { rigDefaults } from "@/domain/rig"
import type { Task } from "@/domain/task"

import { rateOptions } from "../lib"
import { Field } from "./field"
import { Info } from "./info"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { SimpleSelect } from "./simple-select"
import { TaskWorldSection } from "./task-world"
import { UnitInput } from "./unit-input"

type Props = {
  task: Task
  onChange: (patch: Partial<Task>) => void
}

export function TaskDefinition({ task, onChange }: Props) {
  const rigs = useRigs()
  const rig = rigs.data?.find((r) => r.id === task.rigId)

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
        {rigs.isError ? (
          <ErrorNote error={rigs.error} onRetry={() => void rigs.refetch()} />
        ) : !rigs.data ? (
          <LoadingNote />
        ) : rigs.data.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">등록된 Rig 가 없습니다. config/rigs 에 rig 파일을 추가하세요.</p>
        ) : !rig ? (
          <p className="text-[13px] text-bad">Rig &quot;{task.rigId}&quot; 를 찾을 수 없습니다.</p>
        ) : (
          <>
            {/* Changing the rig also loads its master/slave, rate and camera defaults. The label repeats the section title, so it is hidden */}
            <div>
              <Label htmlFor="t-rig" className="sr-only">
                Rig
              </Label>
              <SimpleSelect
                id="t-rig"
                value={rig.id}
                options={rigs.data.map((r) => ({ value: r.id, label: r.name }))}
                onChange={(id) => {
                  const next = rigs.data.find((r) => r.id === id)
                  if (next) onChange(rigDefaults(next))
                }}
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
          </>
        )}
      </SettingsSection>

      <TaskWorldSection task={task} onChange={onChange} />

      <SettingsSection title="Recording">
        <div className="grid gap-3 @lg:grid-cols-3">
          <Field label="Action rate" htmlFor="r-action">
            <SimpleSelect
              id="r-action"
              value={String(task.actionHz)}
              options={rateOptions(rig?.actionHzOptions ?? [task.actionHz], "Hz")}
              onChange={(v) => onChange({ actionHz: Number(v) })}
            />
          </Field>
          <Field label="Video rate" htmlFor="r-video">
            <SimpleSelect
              id="r-video"
              value={String(task.videoFps)}
              options={rateOptions(rig?.videoFpsOptions ?? [task.videoFps], "fps")}
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
