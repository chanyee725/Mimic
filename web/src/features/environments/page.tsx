import { useState } from "react"
import { LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Page } from "@/components/layout/page-layout"
import { useRescanEnvs } from "@/api/simulation"
import { cn } from "@/lib/utils"

import { EnvironmentsView } from "./components/environments-view"

export function EnvironmentsPage() {
  const [selected, setSelected] = useState<string>()
  const rescan = useRescanEnvs()

  return (
    <Page
      fit
      title="Environments"
      description="환경 폴더에 넣어 둔 USD 파일 목록입니다. Task 와 Evaluate 에서 고릅니다."
      actions={
        <Button variant="outline" size="sm" disabled={rescan.isPending} onClick={() => rescan.mutate()}>
          <LuRefreshCw className={cn(rescan.isPending && "animate-spin")} />
          Rescan
        </Button>
      }
    >
      <EnvironmentsView selected={selected} onSelect={setSelected} error={rescan.error} />
    </Page>
  )
}
