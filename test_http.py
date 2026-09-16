import urllib.request
import urllib.parse
import json

data = urllib.parse.urlencode({
    "username": "cloudtag.suhaib",
    "password": "password"
}).encode('ascii')
req = urllib.request.Request("http://localhost:8000/api/auth/token", data=data)
try:
    with urllib.request.urlopen(req) as response:
        token_data = json.loads(response.read().decode('utf-8'))
        token = token_data["access_token"]
except Exception as e:
    print("Login failed:", e)
    import sys; sys.exit(1)

req2 = urllib.request.Request("http://localhost:8000/api/inventory/azure/accounts/9f295f23-cf36-44ef-9168-0f02a4b147a7/resource-groups?task_id=4")
req2.add_header("Authorization", f"Bearer {token}")
try:
    with urllib.request.urlopen(req2) as response:
        data = json.loads(response.read().decode('utf-8'))
        print(f"Status: {response.status}")
        print(f"Groups: {len(data)}")
        if data:
            print(f"First group: {data[0]}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
