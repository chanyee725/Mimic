import type { IconType } from "react-icons"
import {
  LuBox,
  LuBrain,
  LuCable,
  LuClipboardCheck,
  LuCpu,
  LuDatabase,
  LuFlaskConical,
  LuLayoutDashboard,
  LuListChecks,
  LuRadioTower,
  LuRepeat,
  LuSlidersHorizontal,
} from "react-icons/lu"

import { listTasks } from "@/api/tasks"

export const APP_NAME = "VLA Data Pipeline"

export type NavItem = {
  to: string
  label: string
  icon: IconType
  /** "rec" dot, or a function returning a count (read when the sidebar renders) */
  badge?: "rec" | (() => number)
}
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: "Collect",
    items: [
      { to: "/", label: "Dashboard", icon: LuLayoutDashboard },
      { to: "/tasks", label: "Tasks", icon: LuListChecks, badge: () => listTasks().length },
      { to: "/rigs", label: "Rigs", icon: LuCable },
      { to: "/capture", label: "Capture", icon: LuRadioTower, badge: "rec" },
    ],
  },
  {
    label: "Data",
    items: [
      { to: "/review", label: "Review", icon: LuClipboardCheck },
      { to: "/convert", label: "Convert", icon: LuRepeat },
      { to: "/datasets", label: "Datasets", icon: LuDatabase },
    ],
  },
  {
    label: "Train & Evaluate",
    items: [
      { to: "/training", label: "Training", icon: LuCpu },
      { to: "/models", label: "Models", icon: LuBrain },
      { to: "/evaluate", label: "Evaluate", icon: LuFlaskConical },
      { to: "/simulation", label: "Simulation", icon: LuBox },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: LuSlidersHorizontal }],
  },
]
