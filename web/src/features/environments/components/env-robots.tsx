import { Checkbox } from "@/components/ui/checkbox"
import { ErrorNote } from "@/components/common/query-state"
import { useSetEnvRobots, useSimRobots } from "@/api/simulation"
import type { SimEnv } from "@/domain/simulation"

/** Robot tags of an environment: one checkbox per robot USD, saved on change */
export function EnvRobots({ env }: { env: SimEnv }) {
  const robots = useSimRobots()
  const save = useSetEnvRobots()
  // Tags whose robot USD is gone stay listed so they can be cleared
  const ids = [...new Set([...(robots.data ?? []).map((r) => r.id), ...env.robots])].sort()
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...env.robots, id] : env.robots.filter((r) => r !== id)
    save.mutate({ id: env.id, robots: next })
  }

  return (
    <section className="grid content-start gap-2">
      <h3 className="text-sm font-semibold">Robots</h3>
      <p className="text-xs text-muted-foreground">
        체크한 로봇의 Rig 에서만 이 환경을 씁니다. 아무것도 체크하지 않으면 모든 Rig 에서 쓰고, Isaac Sim 에서 열 때는 첫 번째 로봇을
        놓습니다.
      </p>
      {robots.isPending ? null : ids.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          <span className="font-mono">data/sims/robots/</span> 에 로봇 USD 가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {ids.map((id) => (
            <li key={id}>
              <label className="flex items-center gap-2 text-[13px]">
                <Checkbox checked={env.robots.includes(id)} disabled={save.isPending} onCheckedChange={(on) => toggle(id, on === true)} />
                <span className="font-mono">{id}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <ErrorNote error={robots.error ?? save.error} />
    </section>
  )
}
