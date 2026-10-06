import { LuBell, LuBox, LuInfo, LuKeyboard, LuPlug } from "react-icons/lu"
import type { IconType } from "react-icons"

import { AboutSection } from "./components/about-section"
import { IntegrationsSection } from "./components/integrations-section"
import { IsaacSection } from "./components/isaac-section"
import { NotificationsSection } from "./components/notifications-section"
import { ShortcutsSection } from "./components/shortcuts-section"

/** `description` is the one line under the section title: what the section is for */
type Section = { id: string; label: string; description: string; icon: IconType; render: () => React.ReactNode }

/** Settings sections, in left-nav order; an unknown `?section=` falls back to the first */
export const SECTIONS: Section[] = [
  {
    id: "integrations",
    label: "Integrations",
    description: "데이터셋과 모델을 올릴 Hugging Face, 클라우드 학습에 쓸 RunPod 계정을 연결합니다.",
    icon: LuPlug,
    render: () => <IntegrationsSection />,
  },
  {
    id: "isaac",
    label: "Isaac Sim",
    description: "시뮬레이션을 돌릴 Isaac Sim 서버와 실행 방식을 정합니다.",
    icon: LuBox,
    render: () => <IsaacSection />,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "학습이 끝나거나 디스크가 찰 때 Slack 으로 알립니다.",
    icon: LuBell,
    render: () => <NotificationsSection />,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    description: "Capture, Review, Evaluate 화면에서 쓰는 키입니다.",
    icon: LuKeyboard,
    render: () => <ShortcutsSection />,
  },
  {
    id: "about",
    label: "About",
    description: "백엔드 구성 요소의 버전과 스테이션 디스크 사용량입니다.",
    icon: LuInfo,
    render: () => <AboutSection />,
  },
]

/** Old `?section=` ids that still open their section */
export const SECTION_ALIASES: Record<string, string> = { connection: "isaac" }
