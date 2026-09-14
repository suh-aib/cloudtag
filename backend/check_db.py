from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("Cloud Accounts:")
accounts = db.execute(text("SELECT cloud, account_identifier, name FROM cloud_accounts WHERE cloud = 'AZURE' ORDER BY name;")).fetchall()
for row in accounts:
    print(f"Provider: {row[0]}, ID: {row[1]}, Name: {row[2]}")

print("\nResource Counts:")
counts = db.execute(text("""
SELECT
    ca.name,
    ca.account_identifier,
    COUNT(r.id) AS resource_count
FROM cloud_accounts ca
LEFT JOIN resources r
    ON r.cloud_account_id = ca.id
WHERE ca.cloud = 'AZURE'
GROUP BY ca.id, ca.name, ca.account_identifier
ORDER BY ca.name;
""")).fetchall()

for row in counts:
    print(f"Name: {row[0]}, ID: {row[1]}, Count: {row[2]}")

db.close()
