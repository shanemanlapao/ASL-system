import urllib.request
import base64

auth_str = "$brightpath:rJlMtMFgZSQSwilvaEuhWNWSgQtuKcAa3GoDcZG2yCSkEe7XmKBjlmu5uqPG"
auth_b64 = base64.b64encode(auth_str.encode()).decode()

headers = {"Authorization": f"Basic {auth_b64}"}
url = "https://brightpath.scm.azurewebsites.net/api/vfs/LogFiles/StartupLogs/2026_10_12_lw0mdlwk00011F_failure.log"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as r:
        content = r.read().decode('utf-8', errors='replace')
        print(content[-3000:])
except Exception as e:
    print("Error:", e)
