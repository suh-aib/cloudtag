import requests

# Assuming backend runs on localhost:8000
res = requests.post("http://localhost:8000/api/admin/scripts/generate", json={
    "batch_ids": [21]
}, headers={"Authorization": "Bearer admin"}) # Wait, auth token needs to be real.

