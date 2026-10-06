import { LuBox, LuFlaskConical } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { DetailList } from "@/components/common/detail-list"
import { LinkButton } from "@/components/common/link-button"
import { ErrorNote } from "@/components/common/query-state"
import { StatusDot } from "@/components/common/status-dot"
import { useEnvCompat, useOpenSimEnv } from "@/api/simulation"
import { useTask } from "@/api/tasks"
import type { SimEnv } from "@/domain/simulation"
import { formatDateTime } from "@/lib/format"

import { ENV_STATE, evalHref } from "../lib"
import { EnvCompatList } from "./env-compat-list"
import { EnvFiles, EnvManifest } from "./env-manifest"
import { IsaacStatus } from "./isaac-status"

/** Right-hand environment detail: summary, compatible models, files and env.yaml */
export function EnvDetail({ env }: { env: SimEnv }) {
  const state = ENV_STATE[env.state]
  const task = useTask(env.taskId ?? undefined).data
  const compat = useEnvCompat(env.id)
  const open = useOpenSimEnv()
  const invalid = env.state === "invalid"
  const canEval = !invalid && !!compat.data?.some((m) => m.usable)
  const details = [
    { k: "Task", v: env.taskId ? (task?.name ?? env.taskId) : <span className="text-muted-foreground">Not linked</span> },
    { k: "Cameras", v: env.cameras.join(", ") },
    { k: "Action size", v: env.actionDim },
    { k: "Time limit", v: `${env.maxSeconds} s per episode` },
    {
      k: "Matched to rig",
      v: env.calibrated ? "Yes" : <StatusDot tone="warn">No</StatusDot>,
    },
    { k: "Registered", v: formatDateTime(env.registeredAt) },
    { k: "Updated", v: formatDateTime(env.updatedAt) },
  ]

  return (
    <Panel className="min-h-0 gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="flex min-w-0 items-center gap-3 text-lg font-semibold">
            <span className="truncate">{env.name}</span>
            <StatusDot tone={state.tone} className="shrink-0 text-[13px] font-normal">
              {state.label}
            </StatusDot>
          </h2>
          <p className="truncate font-mono text-xs text-muted-foreground" title={env.path}>
            {env.path}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={invalid || open.isPending}
            title={invalid ? "Environment failed to load" : "Isaac Sim 에서 이 환경의 scene.usd 를 엽니다"}
            onClick={() => open.mutate(env.id)}
          >
            <LuBox />
            {open.isPending ? "Opening…" : "Open in Isaac Sim"}
          </Button>
          <LinkButton
            to={evalHref(env.id)}
            size="sm"
            disabled={!canEval}
            title={canEval ? undefined : invalid ? "Environment failed to load" : "No compatible model"}
          >
            <LuFlaskConical />
            Evaluate a model here
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-1">
        <IsaacStatus envId={env.id} />
        <ErrorNote error={open.error} />
      </div>

      {env.description && <p className="text-[13px] text-muted-foreground">{env.description}</p>}

      {invalid && (
        <div className="grid gap-1 rounded-md bg-bad-muted px-3 py-2.5 text-[13px]">
          <span className="font-mono text-xs text-bad">{env.error ?? "Environment failed to load"}</span>
          <span className="text-muted-foreground">폴더 안의 env.yaml 이나 빠진 파일을 고친 뒤 Rescan 하면 다시 불러옵니다.</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">Details</h3>
          <DetailList rows={details} bordered />
        </section>
        <EnvFiles env={env} />
      </div>

      <EnvCompatList env={env} query={compat} />
      <EnvManifest env={env} />
    </Panel>
  )
}
