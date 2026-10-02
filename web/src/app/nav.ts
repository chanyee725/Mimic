import type { IconType } from "react-icons"
import {
  LuBox,
  LuCable,
  LuCpu,
  LuDatabase,
  LuLayoutDashboard,
  LuListChecks,
  LuRadioTower,
  LuRepeat,
  LuSlidersHorizontal,
} from "react-icons/lu"

import { TASKS } from "@/dummy/tasks"

export const APP_NAME = "VLA Data Pipeline"

export type NavItem = {
  to: string
  label: string
  icon: IconType
  badge?: "rec" | number
}
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: "Collect",
    items: [
      { to: "/", label: "Dashboard", icon: LuLayoutDashboard },
      { to: "/tasks", label: "Tasks", icon: LuListChecks, badge: TASKS.length },
      { to: "/devices", label: "Devices", icon: LuCable },
      { to: "/capture", label: "Capture", icon: LuRadioTower, badge: "rec" },
    ],
  },
  {
    label: "Data",
    items: [
      { to: "/convert", label: "Convert", icon: LuRepeat },
      { to: "/datasets", label: "Datasets", icon: LuDatabase },
    ],
  },
  {
    label: "Train & Evaluate",
    items: [
      { to: "/training", label: "Training", icon: LuCpu },
      { to: "/simulation", label: "Simulation", icon: LuBox },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: LuSlidersHorizontal }],
  },
]
