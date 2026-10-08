import { useState } from "react"
import { LuBox, LuFlaskConical, LuTrash2 } from "react-icons/lu"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { DetailList } from "@/components/common/detail-list"
import { LinkButton } from "@/components/common/link-button"
import { ErrorNote } from "@/components/common/query-state"
import { EnvThumb } from "@/components/robot/env-thumb"
import { ApiError } from "@/api/client"
import { useRigs } from "@/api/rigs"
import { useDeleteSimEnv, useOpenSimEnv } from "@/api/simulation"
import { useTasks } from "@/api/tasks"
import type { SimEnv } from "@/domain/simulation"
import { formatDateTime } from "@/lib/format"

import { evalHref, formatKB } from "../lib"
import { EnvFiles } from "./env-files"
import { EnvRobots } from "./env-robots"
import { IsaacStatus } from "./isaac-status"

/** Tasks named in a 409 from DELETE (details.tasks), appended to the message */
function deleteError(error: unknown) {
  if (!(error instanceof ApiError)) return error
  const tasks = error.details.tasks
  return Array.isArray(tasks) && tasks.length ? `${error.message} (${tasks.join(", ")})` : error
}

/** Right-hand environment detail: script, robot tags, tasks using it, files and actions */
export function EnvDetail({ env, onDeleted }: { env: SimEnv; onDeleted: () => void }) {
  // Tasks recorded in this environment (picked under World on the Tasks page)
  const tasks = (useTasks().data ?? []).filter((t) => t.envId === env.id)
  const rigs = useRigs().data ?? []
  const open = useOpenSimEnv()
  const remove = useDeleteSimEnv()
  const [confirming, setConfirming] = useState(false)
  const details = [
    {
      k: "Rigs",
      v: env.rigIds.length ? (
        env.rigIds.map((id) => rigs.find((r) => r.id === id)?.name ?? id).join(", ")
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
    },
    { k: "Script", v: <span className="font-mono">{env.script}</span> },
    { k: "Size", v: formatKB(env.sizeKB) },
    {
      k: "Tasks",
      v: tasks.length ? (
        <span className="flex flex-wrap justify-end gap-x-2">
          {tasks.map((t) => (
            <Link key={t.id} to={`/tasks/${t.id}`} className="hover:underline">
              {t.name}
            </Link>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
    },
    { k: "Registered", v: formatDateTime(env.registeredAt) },
    { k: "Updated", v: formatDateTime(env.updatedAt) },
  ]

  return (
    <Panel className="min-h-0 gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-80 items-start gap-4">
          <EnvThumb env={env} className="w-32" />
          <div className="grid min-w-0 gap-1">
            <h2 className="truncate text-lg font-semibold">{env.name}</h2>
            <p className="truncate font-mono text-xs text-muted-foreground" title={env.path}>
              {env.path}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <span className="text-[13px] text-muted-foreground">파일을 지웁니다.</span>
              <Button
                variant="outline"
                size="sm"
                className="text-bad hover:text-bad"
                disabled={remove.isPending}
                onClick={() => remove.mutate(env.id, { onSuccess: onDeleted })}
              >
                {remove.isPending ? "Deleting…" : "Delete"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={open.isPending} onClick={() => open.mutate(env.id)}>
                <LuBox />
                {open.isPending ? "Opening…" : "Open in Isaac Sim"}
              </Button>
              <LinkButton to={evalHref(env.id)} size="sm">
                <LuFlaskConical />
                Evaluate a model here
              </LinkButton>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete environment"
                title="Delete"
                className="text-muted-foreground"
                onClick={() => {
                  remove.reset()
                  setConfirming(true)
                }}
              >
                <LuTrash2 />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-1">
        <IsaacStatus envId={env.id} />
        <ErrorNote error={open.error} />
        <ErrorNote error={deleteError(remove.error)} />
      </div>

      <EnvRobots env={env} />
      <section className="grid content-start gap-2">
        <h3 className="text-sm font-semibold">Details</h3>
        <DetailList rows={details} bordered />
      </section>
      {env.files.length > 1 && <EnvFiles env={env} />}
    </Panel>
  )
}
