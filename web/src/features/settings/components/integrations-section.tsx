import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { RUNPOD_REGIONS, RUNPOD_VOLUMES } from "@/dummy/training"
import { SETTINGS } from "@/dummy/settings"

import { useDraft } from "../hooks/use-draft"
import { ChoiceSelect } from "./choice-select"
import { ConnStatus } from "./conn-status"
import { SaveBar } from "./save-bar"
import { SecretField } from "./secret-field"
import { SettingRow } from "./setting-row"

export function IntegrationsSection() {
  const { draft, set, dirty, save, reset } = useDraft(SETTINGS.integrations)
  const { hf, runpod, wandb } = draft

  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Hugging Face">
        <SettingRow label="Status">
          <ConnStatus state={hf.token.set ? hf.state : "unknown"} detail={`as ${hf.namespace}`} canTest={hf.token.set} />
        </SettingRow>
        <SettingRow label="Access token" hint="데이터셋 · 모델을 올리려면 write 권한이 필요합니다" htmlFor="hf-token">
          <SecretField id="hf-token" secret={hf.token} placeholder="hf_…" onChange={(token) => set("hf", { ...hf, token })} />
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
            state={runpod.apiKey.set ? runpod.state : "unknown"}
            detail={`$${runpod.spentThisMonth.toFixed(2)} this month`}
            canTest={runpod.apiKey.set}
          />
        </SettingRow>
        <SettingRow label="API key" htmlFor="rp-key">
          <SecretField id="rp-key" secret={runpod.apiKey} placeholder="rpa_…" onChange={(apiKey) => set("runpod", { ...runpod, apiKey })} />
        </SettingRow>
        <SettingRow label="Default region" htmlFor="rp-region">
          <ChoiceSelect
            id="rp-region"
            value={runpod.region}
            options={RUNPOD_REGIONS.map((r) => ({ value: r, label: r === "any" ? "Any available" : r }))}
            onChange={(region) => set("runpod", { ...runpod, region })}
          />
        </SettingRow>
        <SettingRow label="Default network volume" htmlFor="rp-vol">
          <ChoiceSelect
            id="rp-vol"
            value={runpod.volume}
            options={RUNPOD_VOLUMES.map((v) => ({ value: v.id, label: v.label }))}
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
          <ConnStatus state={wandb.apiKey.set ? wandb.state : "unknown"} canTest={wandb.apiKey.set} />
        </SettingRow>
        <SettingRow label="API key" htmlFor="wb-key">
          <SecretField
            id="wb-key"
            secret={wandb.apiKey}
            placeholder="40-character key"
            onChange={(apiKey) => set("wandb", { ...wandb, apiKey })}
          />
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
            disabled={!wandb.apiKey.set}
            onCheckedChange={(v) => set("wandb", { ...wandb, enableByDefault: v })}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar dirty={dirty} onSave={save} onReset={reset} />
    </SettingsGroup>
  )
}
