import { Page } from "@/components/layout/page-layout"

import { EnvironmentsView } from "./components/environments-view"

export function EnvironmentsPage() {
  return (
    <Page fit title="Environments" description="직접 만든 Isaac Sim 환경을 폴더에 등록해 두고, Rig 와 Evaluate 에서 씁니다.">
      <EnvironmentsView />
    </Page>
  )
}
