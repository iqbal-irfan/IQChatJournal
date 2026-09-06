# IQChatJournal Launcher
# Starts the existing watcher without changing project structure.

import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
WATCHER = PROJECT_ROOT / "src" / "test_watcher.py"


def main():
    print("=" * 60)
    print("IQChatJournal")
    print("=" * 60)
    print()

    if not WATCHER.exists():
        print("[ERROR] Watcher not found:")
        print(WATCHER)
        input("\nPress Enter to exit...")
        return 1

    print("[OK] Project root:")
    print(PROJECT_ROOT)
    print()

    print("[OK] Starting watcher:")
    print(WATCHER)
    print()
    print("=" * 60)

    try:
        result = subprocess.run(
            [sys.executable, str(WATCHER)],
            cwd=str(PROJECT_ROOT)
        )
        return result.returncode

    except KeyboardInterrupt:
        print("\nIQChatJournal stopped.")
        return 0

    except Exception as error:
        print("\n[ERROR] Could not start watcher:")
        print(error)
        input("\nPress Enter to exit...")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())