import { Page, Panel } from "@/components/layout/page-layout"

export function PlaceholderPage({ title }: { group?: string; title: string }) {
  return (
    <Page title={title} description="준비 중인 화면입니다.">
      <Panel>
        <p className="text-sm text-muted-foreground">이 화면은 아직 디자인되지 않았습니다.</p>
      </Panel>
    </Page>
  )
}
