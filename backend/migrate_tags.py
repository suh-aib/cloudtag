import asyncio
from sqlalchemy import text
from app.database import engine, Base
from app.models.master_data import TagDefinition, TagValue

async def migrate():
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS tag_values;"))
        conn.execute(text("DROP TABLE IF EXISTS tag_definitions;"))
        print("Dropped old tables.")
    
    # Re-create tables
    Base.metadata.create_all(bind=engine)
    print("Recreated tables with new schema.")

if __name__ == "__main__":
    asyncio.run(migrate())
