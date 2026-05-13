from pathlib import Path
import sys


# Allow running the backend from the `backend/` directory while still importing
# shared modules that live at the repository root, such as `src/`.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_repo_root_str = str(_REPO_ROOT)
if _repo_root_str not in sys.path:
    sys.path.insert(0, _repo_root_str)
