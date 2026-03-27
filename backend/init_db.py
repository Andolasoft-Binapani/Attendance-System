import asyncio
from pathlib import Path

import asyncpg
from sqlalchemy.engine import make_url

from app.config import settings


SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def to_asyncpg_dsn(url):
    normalized = url.set(drivername="postgresql")
    return normalized.render_as_string(hide_password=False)


async def ensure_database():
    url = make_url(settings.DATABASE_URL)
    target_db = url.database
    admin_url = url.set(database="postgres")

    conn = await asyncpg.connect(to_asyncpg_dsn(admin_url))
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            target_db,
        )
        if not exists:
            await conn.execute(f'CREATE DATABASE "{target_db}"')
    finally:
        await conn.close()


async def apply_schema():
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    conn = await asyncpg.connect(to_asyncpg_dsn(make_url(settings.DATABASE_URL)))
    try:
        await conn.execute(schema_sql)
    finally:
        await conn.close()


async def main():
    await ensure_database()
    await apply_schema()
    print("Database bootstrap complete.")


if __name__ == "__main__":
    asyncio.run(main())
