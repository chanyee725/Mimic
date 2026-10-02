import { useSearchParams } from "react-router-dom"
import { LuCable, LuCpu, LuHardDrive, LuInfo, LuKeyboard, LuPlug, LuRadioTower, LuBell, LuWarehouse } from "react-icons/lu"
import type { IconType } from "react-icons"

import { Page, Panel } from "@/components/app/page"
import { cn } from "@/lib/utils"

import { ConnectionSection } from "./components/connection-section"
import { IntegrationsSection } from "./components/integrations-section"
import { NotificationsSection } from "./components/notifications-section"
import { RecordingSection } from "./components/recording-section"
import { AboutSection, ShortcutsSection } from "./components/shortcuts-section"
import { StationSection } from "./components/station-section"
import { StorageSection } from "./components/storage-section"
import { TrainingSection } from "./components/training-section"

type Section = { id: string; label: string; icon: IconType; description: string; render: () => React.ReactNode }

const SECTIONS: Section[] = [
  {
    id: "integrations",
    label: "Integrations",
    icon: LuPlug,
    description: "Hugging Face, RunPod, Weights & Biases 계정을 연결합니다.",
    render: () => <IntegrationsSection />,
  },
  {
    id: "storage",
    label: "Storage",
    icon: LuHardDrive,
    description: "녹화 · 데이터셋 · 모델 저장 위치와 정리 규칙입니다.",
    render: () => <StorageSection />,
  },
  {
    id: "connection",
    label: "Connection",
    icon: LuCable,
    description: "백엔드 API, 로봇 데이터, 카메라 영상 연결입니다.",
    render: () => <ConnectionSection />,
  },
  {
    id: "recording",
    label: "Recording",
    icon: LuRadioTower,
    description: "녹화 기본값과 LeRobot 변환 설정입니다.",
    render: () => <RecordingSection />,
  },
  { id: "training", label: "Training", icon: LuCpu, description: "학습 · 시뮬레이션 기본값입니다.", render: () => <TrainingSection /> },
  {
    id: "notifications",
    label: "Notifications",
    icon: LuBell,
    description: "학습 · pod · 디스크 알림을 Slack 으로 받습니다.",
    render: () => <NotificationsSection />,
  },
  {
    id: "station",
    label: "Station",
    icon: LuWarehouse,
    description: "스테이션 정보와 작업자 ID 입니다.",
    render: () => <StationSection />,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: LuKeyboard,
    description: "Capture · Review · Evaluate 단축키입니다.",
    render: () => <ShortcutsSection />,
  },
  { id: "about", label: "About", icon: LuInfo, description: "앱과 백엔드 버전입니다.", render: () => <AboutSection /> },
]

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const current = SECTIONS.find((s) => s.id === params.get("section")) ?? SECTIONS[0]

  return (
    <Page fit title="Settings" description="스테이션, 저장소, 외부 서비스 연결을 설정합니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <Panel className="h-fit p-2">
          <nav aria-label="Settings sections">
            <ul className="grid gap-0.5">
              {SECTIONS.map((s) => {
                const on = s.id === current.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => setParams({ section: s.id }, { replace: true })}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                        on && "bg-accent font-medium text-foreground hover:bg-accent",
                      )}
                    >
                      <s.icon className="size-[15px] shrink-0 stroke-[1.75]" aria-hidden />
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </Panel>

        {/* key 로 섹션이 바뀔 때 편집 중이던 값을 버린다 */}
        <div key={current.id} className="grid min-h-0 content-start gap-3 overflow-y-auto pb-1">
          <div className="grid gap-0.5">
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <p className="text-[13px] text-muted-foreground">{current.description}</p>
          </div>
          <div className="max-w-3xl">{current.render()}</div>
        </div>
      </div>
    </Page>
  )
}
