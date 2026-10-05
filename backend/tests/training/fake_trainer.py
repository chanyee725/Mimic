"""Stand-in for lerobot-train in tests: prints its tqdm / metric / checkpoint lines and writes
the checkpoint folders, quickly. Options: --steps, --log_freq, --save_freq, --output_dir;
FAKE_TRAINER_FAIL=1 exits with an error, FAKE_TRAINER_SLOW=1 sleeps between steps."""

import os
import sys
import time
from pathlib import Path

args = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
steps = int(args.get("steps", 20))
log_freq = int(args.get("log_freq", 5))
save_freq = int(args.get("save_freq", 10))
out = Path(args["output_dir"])
delay = 0.2 if os.environ.get("FAKE_TRAINER_SLOW") else 0.0

if os.environ.get("FAKE_TRAINER_FAIL"):
    print("Traceback (most recent call last):", flush=True)
    print("torch.OutOfMemoryError: CUDA out of memory.", flush=True)
    sys.exit(1)

for step in range(1, steps + 1):
    time.sleep(delay)
    pct = int(step / steps * 100)
    sys.stdout.write(f"\rTraining: {pct:3d}%|##| {step}/{steps} [00:01<00:02,  4.00step/s]")
    if step % log_freq == 0:
        loss = 1.0 / step
        print(
            f"INFO ot_train.py:641 step:{step} smpl:{step * 4} ep:0 epch:0.{step:02d} "
            f"loss:{loss:.3f} grdn:1.500 lr:1.0e-04 updt_s:0.200 data_s:0.002 smp/s:20 mem_gb:2.12",
            flush=True,
        )
    if step % save_freq == 0 or step == steps:
        print(f"INFO ot_train.py:687 Checkpoint policy after step {step}", flush=True)
        d = out / "checkpoints" / f"{step:06d}" / "pretrained_model"
        d.mkdir(parents=True)
        (d / "config.json").write_text("{}")
        (d / "model.safetensors").write_bytes(b"\0" * 50_000)
        last = out / "checkpoints" / "last"
        last.unlink(missing_ok=True)
        last.symlink_to(f"{step:06d}")
print("INFO ot_train.py:770 End of training", flush=True)
