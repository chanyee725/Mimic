import { Route, Routes } from "react-router-dom"

import { AppLayout } from "@/app/layout"
import { PlaceholderPage } from "@/app/placeholder"
import { CapturePage } from "@/features/capture/page"
import { ConvertPage } from "@/features/convert/page"
import { DashboardPage } from "@/features/dashboard/page"
import { DevicesPage } from "@/features/devices/page"
import { SessionsPage } from "@/features/sessions/page"
import { TasksPage } from "@/features/tasks/page"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:taskId" element={<TasksPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="capture" element={<CapturePage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="convert" element={<ConvertPage />} />
        <Route path="datasets" element={<PlaceholderPage group="Data" title="Datasets" />} />
        <Route path="training" element={<PlaceholderPage title="Training" />} />
        <Route path="simulation" element={<PlaceholderPage group="Train & Evaluate" title="Simulation" />} />
        <Route path="settings" element={<PlaceholderPage group="System" title="Settings" />} />
      </Route>
    </Routes>
  )
}
