"""
Database Connection Helper

Simple SQLite connection for Google Drive credentials storage.
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = os.getenv('DATABASE_PATH', '/tmp/stavagent.db')


def get_db():
    """
    Get database connection.

    Returns:
        sqlite3.Connection: Database connection
    """
    # Ensure directory exists
    db_path = Path(DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Connect to database
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row  # Enable column access by name

    return conn


def init_database():
    """
    Initialize database with Google Drive tables.

    Should be called on application startup.
    """
    conn = get_db()

    # Read migration file
    migrations_dir = Path(__file__).parent.parent.parent / 'migrations'
    migration_file = migrations_dir / '003_google_drive_tables.sql'

    if migration_file.exists():
        with open(migration_file, 'r') as f:
            sql = f.read()
            conn.executescript(sql)
        conn.commit()

    conn.close()
