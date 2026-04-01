"""
Database connection pool for Supabase PostgreSQL.

Uses psycopg2 connection pooling for efficient database access.
Configure via DATABASE_URL environment variable.
"""

import os
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

# Connection pool (initialized on first use)
_pool = None


def get_pool():
    """Get or create the connection pool."""
    global _pool
    if _pool is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError(
                "DATABASE_URL environment variable is not set. "
                "Set it to your Supabase PostgreSQL connection string."
            )
        _pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=database_url,
        )
    return _pool


@contextmanager
def get_db():
    """
    Context manager that provides a database connection with RealDictCursor.
    Automatically returns connection to pool when done.

    Usage:
        with get_db() as (conn, cur):
            cur.execute("SELECT * FROM athletes LIMIT 10")
            rows = cur.fetchall()
    """
    p = get_pool()
    conn = p.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield conn, cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        p.putconn(conn)


def close_pool():
    """Close all connections in the pool. Call on app shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
