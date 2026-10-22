import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
from backend.app.config import BASE_DIR, settings
from backend.app.schemas import ReflectionRecord, DashboardStats, TrackedRepository

DB_FILE = BASE_DIR / "pr_chronicler.db"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        # Deliveries table for deduplication and webhook auditing
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                delivery_id TEXT PRIMARY KEY,
                event_action TEXT,
                repo_full_name TEXT,
                pr_number INTEGER,
                is_merged INTEGER,
                status TEXT,
                received_at TEXT
            )
        """)

        # PR Reflections table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pr_reflections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                delivery_id TEXT UNIQUE,
                repo_name TEXT,
                repo_owner TEXT,
                pr_number INTEGER,
                pr_title TEXT,
                pr_author TEXT,
                pr_url TEXT,
                merged_at TEXT,
                diff_char_count INTEGER DEFAULT 0,
                linked_issues TEXT DEFAULT '[]',
                issue_details TEXT,
                execution_summary TEXT,
                key_learnings TEXT DEFAULT '[]',
                email_status TEXT DEFAULT 'pending',
                email_error TEXT,
                processing_status TEXT DEFAULT 'processing',
                processing_error TEXT,
                duration_ms INTEGER DEFAULT 0,
                created_at TEXT
            )
        """)

        # Tracked Repositories table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tracked_repositories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_name TEXT UNIQUE NOT NULL,
                repo_owner TEXT NOT NULL,
                repo_url TEXT NOT NULL,
                description TEXT,
                stars_count INTEGER DEFAULT 0,
                webhook_status TEXT DEFAULT 'setup_required',
                created_at TEXT NOT NULL,
                last_event_at TEXT
            )
        """)

        # Auto-seed tracked_repositories from existing pr_reflections if any
        cursor.execute("""
            INSERT OR IGNORE INTO tracked_repositories (repo_name, repo_owner, repo_url, description, webhook_status, created_at, last_event_at)
            SELECT DISTINCT 
                repo_name, 
                repo_owner, 
                'https://github.com/' || repo_name,
                'Discovered from pull request contributions',
                'active',
                MIN(created_at),
                MAX(created_at)
            FROM pr_reflections
            WHERE repo_name IS NOT NULL AND repo_name != ''
            GROUP BY repo_name
        """)
        conn.commit()

def is_delivery_processed(delivery_id: str) -> bool:
    """Check if a delivery ID has already been recorded."""
    if not delivery_id:
        return False
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM webhook_deliveries WHERE delivery_id = ?", (delivery_id,))
        return cursor.fetchone() is not None

def record_delivery(
    delivery_id: str,
    event_action: str,
    repo_full_name: str,
    pr_number: Optional[int],
    is_merged: bool,
    status: str
):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO webhook_deliveries 
            (delivery_id, event_action, repo_full_name, pr_number, is_merged, status, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            delivery_id,
            event_action,
            repo_full_name,
            pr_number,
            1 if is_merged else 0,
            status,
            datetime.utcnow().isoformat() + "Z"
        ))
        conn.commit()

def save_reflection(
    delivery_id: str,
    repo_name: str,
    repo_owner: str,
    pr_number: int,
    pr_title: str,
    pr_author: str,
    pr_url: str,
    merged_at: Optional[str] = None,
    diff_char_count: int = 0,
    linked_issues: Optional[List[str]] = None,
    issue_details: Optional[str] = None,
    execution_summary: Optional[str] = None,
    key_learnings: Optional[List[str]] = None,
    email_status: str = "pending",
    email_error: Optional[str] = None,
    processing_status: str = "completed",
    processing_error: Optional[str] = None,
    duration_ms: int = 0
) -> int:
    linked_issues_json = json.dumps(linked_issues or [])
    key_learnings_json = json.dumps(key_learnings or [])
    created_at = datetime.utcnow().isoformat() + "Z"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO pr_reflections (
                delivery_id, repo_name, repo_owner, pr_number, pr_title, pr_author,
                pr_url, merged_at, diff_char_count, linked_issues, issue_details,
                execution_summary, key_learnings, email_status, email_error,
                processing_status, processing_error, duration_ms, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(delivery_id) DO UPDATE SET
                issue_details=excluded.issue_details,
                execution_summary=excluded.execution_summary,
                key_learnings=excluded.key_learnings,
                email_status=excluded.email_status,
                email_error=excluded.email_error,
                processing_status=excluded.processing_status,
                processing_error=excluded.processing_error,
                duration_ms=excluded.duration_ms
        """, (
            delivery_id, repo_name, repo_owner, pr_number, pr_title, pr_author,
            pr_url, merged_at, diff_char_count, linked_issues_json, issue_details,
            execution_summary, key_learnings_json, email_status, email_error,
            processing_status, processing_error, duration_ms, created_at
        ))
        conn.commit()
        return cursor.lastrowid or 0

def row_to_reflection(row: sqlite3.Row) -> ReflectionRecord:
    try:
        linked_issues = json.loads(row["linked_issues"] or "[]")
    except Exception:
        linked_issues = []
    try:
        key_learnings = json.loads(row["key_learnings"] or "[]")
    except Exception:
        key_learnings = []

    return ReflectionRecord(
        id=row["id"],
        delivery_id=row["delivery_id"] or "",
        repo_name=row["repo_name"] or "",
        repo_owner=row["repo_owner"] or "",
        pr_number=row["pr_number"],
        pr_title=row["pr_title"] or "",
        pr_author=row["pr_author"] or "",
        pr_url=row["pr_url"] or "",
        merged_at=row["merged_at"],
        diff_char_count=row["diff_char_count"] or 0,
        linked_issues=linked_issues,
        issue_details=row["issue_details"],
        execution_summary=row["execution_summary"],
        key_learnings=key_learnings,
        email_status=row["email_status"] or "pending",
        email_error=row["email_error"],
        processing_status=row["processing_status"] or "completed",
        processing_error=row["processing_error"],
        duration_ms=row["duration_ms"] or 0,
        created_at=row["created_at"] or ""
    )

def get_reflections(limit: int = 100, search: Optional[str] = None, status: Optional[str] = None) -> List[ReflectionRecord]:
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM pr_reflections WHERE 1=1"
        params: List[Any] = []

        if search:
            query += " AND (repo_name LIKE ? OR pr_title LIKE ? OR pr_author LIKE ? OR CAST(pr_number AS TEXT) LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term])

        if status:
            query += " AND processing_status = ?"
            params.append(status)

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [row_to_reflection(r) for r in rows]

def get_reflection_by_id(reflection_id: int) -> Optional[ReflectionRecord]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pr_reflections WHERE id = ?", (reflection_id,))
        row = cursor.fetchone()
        return row_to_reflection(row) if row else None

def get_dashboard_stats() -> DashboardStats:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Total processed merged
        cursor.execute("SELECT COUNT(*) FROM pr_reflections WHERE processing_status = 'completed'")
        total_processed_merged = cursor.fetchone()[0]

        # Successfully emailed
        cursor.execute("SELECT COUNT(*) FROM pr_reflections WHERE email_status = 'sent'")
        successfully_emailed = cursor.fetchone()[0]

        # Failed attempts
        cursor.execute("SELECT COUNT(*) FROM pr_reflections WHERE processing_status = 'failed'")
        failed_attempts = cursor.fetchone()[0]

        # Total ignored events
        cursor.execute("SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'ignored'")
        total_ignored_events = cursor.fetchone()[0]

        # Unique repos from both tracked_repositories and pr_reflections
        cursor.execute("""
            SELECT DISTINCT repo FROM (
                SELECT repo_name as repo FROM tracked_repositories WHERE repo_name IS NOT NULL AND repo_name != ''
                UNION
                SELECT repo_name as repo FROM pr_reflections WHERE repo_name IS NOT NULL AND repo_name != ''
            )
        """)
        unique_repos = [r[0] for r in cursor.fetchall()]

        # Last processing time
        cursor.execute("SELECT created_at FROM pr_reflections ORDER BY id DESC LIMIT 1")
        last_row = cursor.fetchone()
        last_processing_time = last_row[0] if last_row else None

    recent_reflections = get_reflections(limit=5)

    return DashboardStats(
        total_processed_merged=total_processed_merged,
        successfully_emailed=successfully_emailed,
        failed_attempts=failed_attempts,
        total_ignored_events=total_ignored_events,
        unique_repos_count=len(unique_repos),
        recent_reflections=recent_reflections,
        unique_repos=unique_repos,
        last_processing_time=last_processing_time
    )

def row_to_tracked_repo(row: sqlite3.Row, contributions_count: int = 0) -> TrackedRepository:
    return TrackedRepository(
        id=row["id"],
        repo_name=row["repo_name"],
        repo_owner=row["repo_owner"],
        repo_url=row["repo_url"],
        description=row["description"],
        stars_count=row["stars_count"] or 0,
        webhook_status=row["webhook_status"] or "setup_required",
        created_at=row["created_at"],
        last_event_at=row["last_event_at"],
        contributions_count=contributions_count
    )

def get_tracked_repositories() -> List[TrackedRepository]:
    """Retrieve all tracked repositories with actual contribution count from reflections."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                t.*,
                (SELECT COUNT(*) FROM pr_reflections p WHERE p.repo_name = t.repo_name) as contributions_count
            FROM tracked_repositories t
            ORDER BY t.id DESC
        """)
        rows = cursor.fetchall()
        return [row_to_tracked_repo(r, contributions_count=r["contributions_count"]) for r in rows]

def get_tracked_repository_by_id(repo_id: int) -> Optional[TrackedRepository]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                t.*,
                (SELECT COUNT(*) FROM pr_reflections p WHERE p.repo_name = t.repo_name) as contributions_count
            FROM tracked_repositories t
            WHERE t.id = ?
        """, (repo_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_tracked_repo(row, contributions_count=row["contributions_count"])

def get_tracked_repository_by_name(repo_name: str) -> Optional[TrackedRepository]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                t.*,
                (SELECT COUNT(*) FROM pr_reflections p WHERE p.repo_name = t.repo_name) as contributions_count
            FROM tracked_repositories t
            WHERE LOWER(t.repo_name) = LOWER(?)
        """, (repo_name.strip(),))
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_tracked_repo(row, contributions_count=row["contributions_count"])

def add_tracked_repository(
    repo_name: str,
    repo_owner: str,
    repo_url: str,
    description: Optional[str] = None,
    stars_count: int = 0,
    webhook_status: str = "setup_required"
) -> TrackedRepository:
    """Store a verified repository into tracked_repositories."""
    created_at = datetime.utcnow().isoformat() + "Z"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tracked_repositories (repo_name, repo_owner, repo_url, description, stars_count, webhook_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            repo_name.strip(),
            repo_owner.strip(),
            repo_url.strip(),
            description,
            stars_count,
            webhook_status,
            created_at
        ))
        conn.commit()
        new_id = cursor.lastrowid

    # Check if there are already contributions
    repo_record = get_tracked_repository_by_id(new_id)
    return repo_record

def delete_tracked_repository(repo_id: int) -> bool:
    """
    Remove a repository from tracked_repositories.
    Does NOT delete historical pr_reflections records.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tracked_repositories WHERE id = ?", (repo_id,))
        conn.commit()
        return cursor.rowcount > 0

def update_repo_webhook_status(repo_name: str, status: str, event_time: Optional[str] = None):
    """Update webhook status when real events are received."""
    event_timestamp = event_time or (datetime.utcnow().isoformat() + "Z")
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE tracked_repositories 
            SET webhook_status = ?, last_event_at = ?
            WHERE LOWER(repo_name) = LOWER(?)
        """, (status, event_timestamp, repo_name.strip()))
        conn.commit()

# Initialize database on module import
init_db()

