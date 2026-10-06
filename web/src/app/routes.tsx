import { Navigate, Route, Routes, useParams } from "react-router-dom"

import { AppLayout } from "@/app/layout"
import { CapturePage } from "@/features/capture/page"
import { ConvertPage } from "@/features/convert/page"
import { DashboardPage } from "@/features/dashboard/page"
import { DatasetsPage } from "@/features/datasets/page"
import { EnvironmentsPage } from "@/features/environments/page"
import { MergePage } from "@/features/merge/page"
import { ReviewPage } from "@/features/review/page"
import { RigsPage } from "@/features/rigs/page"
import { TasksPage } from "@/features/tasks/page"
import { EvaluatePage } from "@/features/evaluate/page"
import { SimJobPage } from "@/features/evaluate/sim-job-page"
import { ModelsPage } from "@/features/models/page"
import { SettingsPage } from "@/features/settings/page"
import { JobPage } from "@/features/training/job-page"
import { TrainingPage } from "@/features/training/page"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:taskId" element={<TasksPage />} />
        <Route path="rigs" element={<RigsPage />} />
        <Route path="devices" element={<Navigate to="/rigs" replace />} />
        <Route path="capture" element={<CapturePage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="convert" element={<ConvertPage />} />
        <Route path="datasets" element={<DatasetsPage />} />
        <Route path="merge" element={<MergePage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="training/:jobId" element={<JobPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="evaluate" element={<EvaluatePage />} />
        <Route path="evaluate/sim/:jobId" element={<SimJobPage />} />
        <Route path="environments" element={<EnvironmentsPage />} />
        {/* Simulation was split into Environments and the Isaac Sim target of Evaluate */}
        <Route path="simulation" element={<Navigate to="/environments" replace />} />
        <Route path="simulation/:jobId" element={<SimJobRedirect />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

function SimJobRedirect() {
  const { jobId } = useParams()
  return <Navigate to={`/evaluate/sim/${jobId}`} replace />
}
