# sim

Isaac Sim 5.1.0 환경과 실행기를 두는 곳입니다. 시뮬레이션은 **데이터 수집**(Isaac Sim Task)과 **평가**에 쓰고, 이 스테이션이나 시뮬레이션 서버에서 돕니다.

```
sim/
  pyproject.toml   Isaac Sim 5.1.0 (Python 3.11) — `uv sync` 로 sim/.venv 에 설치
  runner/
    server.py      Isaac Sim 서버: 앱을 띄우고 끄며 환경 장면을 엽니다 (표준 라이브러리만 사용)
    app.py         Isaac Sim 앱: server.py 가 window / headless 로 실행
  examples/        예제 환경의 장면 파일 (에셋은 scripts/fetch-sim-example.sh 로 받음)
  envs/            환경 (USD 장면). 저장소에는 비어 있습니다
    <env-id>.usd   USD 파일 하나가 환경 하나 (.usd / .usda / .usdc / .usdz)
    <env-id>/      또는 폴더: scene.usd (없으면 하나뿐인 USD 파일) + 하위 asset
    <rig-id>/      Rig id 이름의 폴더: 그 Rig 전용 환경들 (안의 규칙은 같음)
```

## 설치

```sh
cd sim && uv sync     # Isaac Sim 5.1.0 (약 16 GB). 실행기는 NVIDIA EULA 에 동의한 것으로 Isaac Sim 을 띄웁니다
```

최소 사양은 RTX 4080 (VRAM 16 GB), RAM 32 GB 입니다. 그보다 낮은 GPU 에서도 단순한 장면은 열리지만, 카메라 여러 대를 쓰는 평가는 어려울 수 있습니다.

## 실행 방식

Settings → Connection → **Isaac Sim** 에서 고릅니다.

- **This station:** 백엔드가 필요할 때 `127.0.0.1:8211` 에 서버를 띄웁니다. 백엔드를 재시작해도 서버는 남아 있고, 앱은 Environments 화면의 **Stop** 으로 끕니다.
- **Remote server:** 시뮬레이션 서버에 이 저장소를 받고 `cd sim && uv sync` 한 뒤 아래처럼 띄워 두고, Server URL 에 `http://<서버>:8211` 을 적습니다. 환경을 열 때 USD 파일(폴더면 폴더 전체)을 서버로 보내므로 서버에 `envs/` 를 맞춰 둘 필요는 없습니다.

  ```sh
  sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0 --port 8211
  ```

- **Display:** Window 는 Isaac Sim 창을 띄우고, Headless 는 화면 없이 돌립니다. 원격 서버에서 Window 를 고르면 서버 화면에 창이 뜹니다.
- **Window 모드 도구:** 가벼운 기본 구성에 Physics UI 를 더해 띄웁니다. 관절은 **Window → Physics → Physics Authoring Toolbar** 의 Physics Inspector 로 움직입니다. Full 구성(`isaacsim.exp.full.kit`)은 `SimulationApp` 으로 띄우면 죽어서 쓰지 않습니다.
- **Physics:** 물리 연산(PhysX) 장치입니다. 기본값은 GPU 이고, 바꾸면 앱이 다시 시작됩니다. 렌더링은 항상 NVIDIA GPU 에서 합니다.
- **첫 실행:** 처음 장면을 열 때 RTX 셰이더를 컴파일하느라 1~3분 걸리고 CPU 를 많이 씁니다. 캐시(`sim/.venv/.../isaacsim/kit/cache`)가 생긴 뒤에는 20초 안팎으로 열립니다.

Environments 화면에서 환경을 고르고 **Open in Isaac Sim** 을 누르면 그 환경의 USD 장면이 열립니다. 로그와 받은 환경은 `~/.cache/mimic-sim/` 에 있습니다.

## 환경 추가

예제로 시작하려면 SO-101 이 테이블 위 큐브를 마주 보는 장면을 받으세요 ([examples/so101_lift_cube](examples/so101_lift_cube/README.md), LeIsaac 에셋, Apache-2.0).

```sh
scripts/fetch-sim-example.sh     # data/envs/so101-kit/so101_lift_cube/ (약 28 MB)
```

- 환경은 USD 장면 하나입니다. 매니페스트(`env.yaml`)나 성공 판정 스크립트는 없습니다.
- `.usd` / `.usda` / `.usdc` / `.usdz` 파일을 환경 폴더(`data/envs/`)에 직접 복사한 뒤 Environments 화면에서 **Rescan** 하면 목록에 나타납니다 (id 는 파일 이름).
- 하위 asset 이 있는 장면은 `data/envs/<env-id>/` 폴더에 `scene.usd` 와 asset 을 넣고 **Rescan** 합니다.
- `_` 나 `.` 로 시작하는 파일과 폴더는 스캔하지 않습니다. 폴더 위치는 환경 변수 `VLA_SIM_ENVS_DIR` (기본값 `data/envs`, 데이터 폴더 아래라 git 에 올라가지 않습니다).
- Task 가 쓰고 있는 환경은 지울 수 없습니다.
- Rig 별로 나누려면 `data/envs/<rig-id>/` 폴더(예: `data/envs/so101-kit/`)에 넣습니다. 그 환경은 해당 Rig 의 Task 와 모델에만 쓸 수 있고, 최상위에 둔 환경은 모든 Rig 에서 씁니다.
- 썸네일: USD 파일 옆에 같은 이름의 이미지(`table.usda` → `table.png`, jpg / webp 도 가능)를 두거나, 폴더 환경이면 안에 `thumbnail.png` 를 둡니다.
- 스캔 규칙과 서버 API: [docs/api/simulation.md](../docs/api/simulation.md)

## Task 환경 선택 (데이터 수집)

Rig 는 실제 장비 하나로 씁니다. Tasks 에서 **Isaac Sim** 태그를 고르고 Environments 에 등록된 환경 하나를 고르면, 그 환경이 Task 에 저장됩니다 (YAML `env: <env-id>`).

- 실제 리더 팔이 환경 안의 팔로워를 움직이고, Capture, Review, Datasets 흐름을 그대로 씁니다. 녹화에는 환경 id (`simEnv`) 가 붙습니다.
- Isaac Sim 연결(브리지)은 아직 없어서, Isaac Sim Task 의 Capture 는 지금은 503 을 돌려줍니다.
- Environments 화면은 환경 관리(Rescan, 열기, 삭제)만 합니다. 평가는 Evaluate 화면에서 대상을 **Isaac Sim** 으로 고릅니다.
