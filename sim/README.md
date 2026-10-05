# sim

Isaac Sim 5.1.0 평가 환경과 실행기를 두는 곳입니다. 시뮬레이션은 **평가만** 하고, 이 스테이션이나 시뮬레이션 서버에서 돕니다.

```
sim/
  pyproject.toml   Isaac Sim 5.1.0 (Python 3.11) — `uv sync` 로 sim/.venv 에 설치
  runner/
    server.py      Isaac Sim 서버: 앱을 띄우고 끄며 환경 장면을 엽니다 (표준 라이브러리만 사용)
    app.py         Isaac Sim 앱: server.py 가 window / headless 로 실행
  envs/<env-id>/
    env.yaml       매니페스트 (이름, 연결 Task, 카메라, action_dim, 에피소드 시간 제한, 성공 판정)
    scene.usd      Isaac Sim 장면
    success.py     check(state) -> (done, success, reason)
    assets/        (선택) USD 하위 asset
```

## 설치

```sh
cd sim && uv sync     # Isaac Sim 5.1.0 (약 16 GB). 실행기는 NVIDIA EULA 에 동의한 것으로 Isaac Sim 을 띄웁니다
```

최소 사양은 RTX 4080 (VRAM 16 GB), RAM 32 GB 입니다. 그보다 낮은 GPU 에서도 단순한 장면은 열리지만, 카메라 여러 대를 쓰는 평가는 어려울 수 있습니다.

## 실행 방식

Settings → Connection → **Isaac Sim** 에서 고릅니다.

- **This station:** 백엔드가 필요할 때 `127.0.0.1:8211` 에 서버를 띄웁니다. 백엔드를 재시작해도 서버는 남아 있고, 앱은 Simulation 화면의 **Stop** 으로 끕니다.
- **Remote server:** 시뮬레이션 서버에 이 저장소를 받고 `cd sim && uv sync` 한 뒤 아래처럼 띄워 두고, Server URL 에 `http://<서버>:8211` 을 적습니다. 환경을 열 때 폴더를 서버로 보내므로 서버에 `envs/` 를 맞춰 둘 필요는 없습니다.

  ```sh
  sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0 --port 8211
  ```

- **Display:** Window 는 Isaac Sim 창을 띄우고, Headless 는 화면 없이 돌립니다. 원격 서버에서 Window 를 고르면 서버 화면에 창이 뜹니다.

Simulation → Environments 에서 환경을 고르고 **Open in Isaac Sim** 을 누르면 그 환경의 `scene.usd` 가 열립니다. 로그와 받은 환경은 `~/.cache/mimic-sim/` 에 있습니다.

## 환경 추가

- 새 환경은 `envs/_template/` 를 복사해서 만들고, 웹의 Simulation → Environments 에서 **Rescan** 하면 목록에 나타납니다.
- `_` 나 `.` 로 시작하는 폴더는 스캔하지 않습니다.
- 폴더 위치는 환경 변수 `VLA_SIM_ENVS_DIR` (기본값 `sim/envs`).
- 예시 환경의 `scene.usd` 는 빈 자리표시 장면입니다. Isaac Sim 에서 만든 장면으로 바꿔 넣으세요.
- 매니페스트 형식과 서버 API: [docs/api/simulation.md](../docs/api/simulation.md)
- USD 파일이 커지면 Git LFS 로 관리합니다.
