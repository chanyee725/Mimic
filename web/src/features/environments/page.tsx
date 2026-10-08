import { useState } from "react"
import { LuRefreshCw } from "react-icons/lu"
import { useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Page } from "@/components/layout/page-layout"
import { useRescanEnvs, useSimEnvs, useSimRobots, useSimTools } from "@/api/simulation"
import { cn } from "@/lib/utils"

import { AssetsView } from "./components/assets-view"
import { EnvironmentsView } from "./components/environments-view"

type View = "envs" | "robots" | "tools"

const VIEWS: { value: View; label: string }[] = [
  { value: "envs", label: "Environments" },
  { value: "robots", label: "Robots" },
  { value: "tools", label: "Tools" },
]

const DESCRIPTION: Record<View, string> = {
  envs: "환경 폴더에 넣어 둔 환경 스크립트 목록입니다. Task 와 Evaluate 에서 고릅니다.",
  robots: "data/sims/robots/ 의 로봇 USD 입니다. 환경의 로봇 태그로 고르고, 하나만 Isaac Sim 에서 열어 볼 수 있습니다.",
  tools: "data/sims/tools/ 의 로봇 손, 그리퍼 같은 엔드 이펙터 USD 입니다. 하나만 Isaac Sim 에서 열어 볼 수 있습니다.",
}

export function EnvironmentsPage() {
  const [selected, setSelected] = useState<string>()
  const [params, setParams] = useSearchParams()
  const raw = params.get("view")
  const view: View = raw === "robots" || raw === "tools" ? raw : "envs"
  const rescan = useRescanEnvs()
  const counts = { envs: useSimEnvs().data?.length, robots: useSimRobots().data?.length, tools: useSimTools().data?.length }

  return (
    <Page
      fit
      title="Environments"
      description={DESCRIPTION[view]}
      actions={
        <Button variant="outline" size="lg" disabled={rescan.isPending} onClick={() => rescan.mutate()}>
          <LuRefreshCw className={cn(rescan.isPending && "animate-spin")} />
          Rescan
        </Button>
      }
    >
      <Tabs
        value={view}
        onValueChange={(v) => setParams(v === "envs" ? {} : { view: String(v) }, { replace: true })}
        className="min-h-0 flex-1 gap-4"
      >
        <TabsList>
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value} className="gap-1.5 px-3">
              {v.label}
              {counts[v.value] !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{counts[v.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="envs" className="flex min-h-0 flex-col">
          <EnvironmentsView selected={selected} onSelect={setSelected} error={rescan.error} />
        </TabsContent>
        <TabsContent value="robots" className="flex min-h-0 flex-col">
          <AssetsView kind="robot" />
        </TabsContent>
        <TabsContent value="tools" className="flex min-h-0 flex-col">
          <AssetsView kind="tool" />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
