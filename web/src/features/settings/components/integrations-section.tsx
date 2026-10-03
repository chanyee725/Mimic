import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { useTrainingConfig } from "@/api/training"
import { formatUsd } from "@/lib/format"

import { useSettingsDraft } from "../hooks/use-draft"
import { ChoiceSelect } from "./choice-select"
import { ConnStatus } from "./conn-status"
import { SectionPending } from "./section-pending"
import { SaveBar } from "./save-bar"
import { SecretField } from "./secret-field"
import { SettingRow } from "./setting-row"

export function IntegrationsSection() {
  const { query, server, draft, set, saveBar } = useSettingsDraft("integrations")
  const runpodConfig = useTrainingConfig().data?.runpod
  if (!draft || !server) return <SectionPending query={query} />
  const { hf, runpod, wandb } = draft
  // Keep the saved value selectable while the RunPod catalogue loads
  const regions = runpodConfig?.regions ?? [runpod.region]
  const volumes = runpodConfig?.volumes ?? [{ id: runpod.volume, label: runpod.volume }]

  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Hugging Face">
        <SettingRow label="Status">
          <ConnStatus target="hf" state={server.hf.state} detail={`as ${server.hf.namespace}`} canTest={server.hf.token.set} />
        </SettingRow>
        <SettingRow label="Access token" hint="데이터셋 · 모델을 올리려면 write 권한이 필요합니다" htmlFor="hf-token">
          <SecretField id="hf-token" name="hf_token" secret={server.hf.token} placeholder="hf_…" />
        </SettingRow>
        <SettingRow label="Namespace" hint="저장소를 만들 org 또는 계정" htmlFor="hf-ns">
          <Input
            id="hf-ns"
            className="h-8 text-[13px]"
            value={hf.namespace}
            onChange={(e) => set("hf", { ...hf, namespace: e.target.value })}
          />
        </SettingRow>
        <SettingRow label="Upload as private" htmlFor="hf-private">
          <Switch id="hf-private" checked={hf.privateByDefault} onCheckedChange={(v) => set("hf", { ...hf, privateByDefault: v })} />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="RunPod">
        <SettingRow label="Status">
          <ConnStatus
            target="runpod"
            state={server.runpod.state}
            detail={`${formatUsd(server.runpod.spentThisMonth)} this month`}
            canTest={server.runpod.apiKey.set}
          />
        </SettingRow>
        <SettingRow label="API key" htmlFor="rp-key">
          <SecretField id="rp-key" name="runpod_api_key" secret={server.runpod.apiKey} placeholder="rpa_…" />
        </SettingRow>
        <SettingRow label="Default region" htmlFor="rp-region">
          <ChoiceSelect
            id="rp-region"
            value={runpod.region}
            options={regions.map((r) => ({ value: r, label: r === "any" ? "Any available" : r }))}
            onChange={(region) => set("runpod", { ...runpod, region })}
          />
        </SettingRow>
        <SettingRow label="Default network volume" htmlFor="rp-vol">
          <ChoiceSelect
            id="rp-vol"
            value={runpod.volume}
            options={volumes.map((v) => ({ value: v.id, label: v.label }))}
            onChange={(volume) => set("runpod", { ...runpod, volume })}
          />
        </SettingRow>
        <SettingRow label="Monthly budget" hint="80% 를 넘으면 알리고, 다 쓰면 새 pod 를 띄우지 않습니다" htmlFor="rp-budget">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            id="rp-budget"
            className="h-8 w-28 text-right text-[13px] tabular-nums"
            inputMode="decimal"
            value={runpod.monthlyBudget}
            onChange={(e) => set("runpod", { ...runpod, monthlyBudget: Number(e.target.value) || 0 })}
          />
        </SettingRow>
        <SettingRow label="Idle pod alert" hint="학습이 끝났는데 pod 가 이만큼 켜져 있으면 알립니다" htmlFor="rp-idle">
          <Input
            id="rp-idle"
            className="h-8 w-20 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            value={runpod.idleAlertMin}
            onChange={(e) => set("runpod", { ...runpod, idleAlertMin: Number(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">min</span>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Weights & Biases">
        <SettingRow label="Status">
          <ConnStatus target="wandb" state={server.wandb.state} canTest={server.wandb.apiKey.set} />
        </SettingRow>
        <SettingRow label="API key" htmlFor="wb-key">
          <SecretField id="wb-key" name="wandb_api_key" secret={server.wandb.apiKey} placeholder="40-character key" />
        </SettingRow>
        <SettingRow label="Project" htmlFor="wb-project">
          <Input
            id="wb-project"
            className="h-8 text-[13px]"
            value={wandb.project}
            onChange={(e) => set("wandb", { ...wandb, project: e.target.value })}
          />
        </SettingRow>
        <SettingRow label="Log new trainings by default" htmlFor="wb-default">
          <Switch
            id="wb-default"
            checked={wandb.enableByDefault}
            disabled={!server.wandb.apiKey.set}
            onCheckedChange={(v) => set("wandb", { ...wandb, enableByDefault: v })}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar {...saveBar} />
    </SettingsGroup>
  )
}
