import { Route, Routes } from "react-router-dom"

import { AppLayout } from "@/app/layout"
import { PlaceholderPage } from "@/app/placeholder"
import { DashboardPage } from "@/features/dashboard/page"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tasks" element={<PlaceholderPage title="Tasks" />} />
        <Route path="tasks/:taskId" element={<PlaceholderPage title="Tasks" />} />
        <Route path="devices" element={<PlaceholderPage title="Devices" />} />
        <Route path="capture" element={<PlaceholderPage title="Capture" />} />
        <Route path="sessions" element={<PlaceholderPage title="Sessions" />} />
        <Route path="convert" element={<PlaceholderPage title="Convert" />} />
        <Route path="datasets" element={<PlaceholderPage group="Data" title="Datasets" />} />
        <Route path="training" element={<PlaceholderPage title="Training" />} />
        <Route path="simulation" element={<PlaceholderPage group="Train & Evaluate" title="Simulation" />} />
        <Route path="settings" element={<PlaceholderPage group="System" title="Settings" />} />
      </Route>
    </Routes>
  )
}
