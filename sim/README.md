# sim

Isaac Sim 평가 환경을 두는 곳입니다. 시뮬레이션은 스테이션의 로컬 RTX 4090 에서 **평가만** 합니다.

```
sim/envs/<env-id>/
  env.yaml      매니페스트 (이름, 연결 Task, 카메라, action_dim, 에피소드 시간 제한, 성공 판정)
  scene.usd     Isaac Sim 장면
  success.py    check(state) -> (done, success, reason)
  assets/       (선택) USD 하위 asset
```

- 새 환경은 `envs/_template/` 를 복사해서 만들고, 웹의 Simulation → Environments 에서 **Rescan** 하면 목록에 나타납니다.
- `_` 나 `.` 로 시작하는 폴더는 스캔하지 않습니다.
- 폴더 위치는 Settings → Training → Environments folder (백엔드 기본값 `sim/envs`, 환경 변수 `VLA_SIM_ENVS_DIR`).
- 매니페스트 형식: [docs/api/simulation.md](../docs/api/simulation.md)
- USD 파일이 커지면 Git LFS 로 관리합니다.
