from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.api.deps import get_admin_user
from app.models.user import User

db = SessionLocal()
admin = db.query(User).first()

def override_get_admin_user():
    return admin

app.dependency_overrides[get_admin_user] = override_get_admin_user

client = TestClient(app)

# 1. Upload
print("Uploading...")
with open("/tmp/cloudtag_uploads/0a5c6cec-554f-490e-b6e5-1aaca5924bdb_azuredraft.csv", "rb") as f:
    upload_resp = client.post("/api/admin/csv/azure/upload", files={"file": ("azuredraft.csv", f, "text/csv")})

job = upload_resp.json()
print("Job created:", job["id"])

# 2. Detect headers (simulate UI)
print("Detecting headers...")
detect_resp = client.get(f"/api/admin/csv/azure/jobs/{job['id']}/headers")
detected = detect_resp.json()

mappings = detected["headers"]

# Let's customize it to make sure it matches what the user expects.
for m in mappings:
    if m["source_header"] == "SubscriptionId":
        m["target_field"] = "account_id"
    elif m["source_header"] == "Kind":
        m["target_field"] = None
    elif m["source_header"] == "SKU":
        m["target_field"] = None
    elif m["source_header"] == "ResourceGroup":
        m["target_field"] = "resource_group"

print("Mappings:", mappings)

# 3. Validate
print("Validating...")
val_resp = client.post(f"/api/admin/csv/azure/jobs/{job['id']}/validate", json={"mappings": mappings})
job = val_resp.json()
print("Validation status:", job["status"])
print("Job full response:", job)


# 4. Import
print("Importing...")
import_resp = client.post(f"/api/admin/csv/azure/jobs/{job['id']}/import")
job = import_resp.json()
print("Import status:", job.get("status"), job.get("error_message"))
