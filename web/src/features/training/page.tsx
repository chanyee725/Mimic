import { Page } from "@/components/app/page"

import { JobsPanel } from "./components/jobs-panel"
import { StartTraining } from "./components/start-training"

export function TrainingPage() {
  return (
    <Page
      fit
      title="Training"
      description="SmolVLA 를 로컬 GPU 나 RunPod 에서 학습합니다. Job 을 누르면 loss 와 checkpoint 를 볼 수 있습니다."
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <JobsPanel />
        <StartTraining />
      </div>
    </Page>
  )
}
