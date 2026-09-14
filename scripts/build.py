"""Render and verify the standalone playbook without adjacent repositories."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def main():
    os.chdir(ROOT)
    for name in ["tmp", "cache"]:
        (ROOT / ".work" / name).mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["TMPDIR"] = str(ROOT / ".work/tmp")
    env["XDG_CACHE_HOME"] = str(ROOT / ".work/cache")
    quarto = env.get("QUARTO_BIN", "quarto")
    if not shutil.which(quarto):
        raise SystemExit("Quarto is required. Install version 1.10.18 or set QUARTO_BIN.")
    subprocess.run([quarto, "render", ".", "--to", "html"], env=env, check=True)
    subprocess.run([sys.executable, "scripts/prepare.py"], check=True)
    subprocess.run([sys.executable, "scripts/check.py"], check=True)


if __name__ == "__main__":
    main()
