#!/usr/bin/env python3
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest

if __name__ == "__main__":
    print("Executing OpenSource PR Chronicler automated test suite...")
    ret = pytest.main(["backend/tests", "-v"])
    sys.exit(ret)
