import logging
import sys
import re
from pathlib import Path
from backend.app.config import settings

LOG_FILE = Path(settings.log_file_path)

# Sensitive patterns to mask in logs
SENSITIVE_PATTERNS = [
    (re.compile(r"(ghp_[a-zA-Z0-9]{36})"), "[MASKED_GH_TOKEN]"),
    (re.compile(r"(github_pat_[a-zA-Z0-9_]{82})"), "[MASKED_GH_PAT]"),
    (re.compile(r"(AIzaSy[a-zA-Z0-9_\-]{33})"), "[MASKED_GOOGLE_KEY]"),
    (re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]+"), r"\1[MASKED_BEARER]"),
    (re.compile(r"(SMTP_APP_PASSWORD\s*[:=]\s*)[^\s,]+"), r"\1[MASKED_PASSWORD]"),
]

class MaskingFormatter(logging.Formatter):
    """Custom formatter to sanitize secrets from log output."""
    def format(self, record: logging.LogRecord) -> str:
        orig = super().format(record)
        sanitized = orig
        for pattern, repl in SENSITIVE_PATTERNS:
            sanitized = pattern.sub(repl, sanitized)
        return sanitized

def setup_logger(name: str = "pr_chronicler") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Avoid duplicate handlers if setup is called multiple times
    if logger.handlers:
        return logger

    # Formatting: Timestamp | Level | Logger | Message
    log_format = "%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s"
    formatter = MaskingFormatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")

    # 1. Terminal / stdout handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. File handler (pr_chronicler.log)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"Warning: Could not configure file logger at {LOG_FILE}: {e}", file=sys.stderr)

    return logger

logger = setup_logger("pr_chronicler")
