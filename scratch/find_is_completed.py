import urllib.request
import base64

auth_str = "$brightpath:rJlMtMFgZSQSwilvaEuhWNWSgQtuKcAa3GoDcZG2yCSkEe7XmKBjlmu5uqPG"
auth_b64 = base64.b64encode(auth_str.encode()).decode()

headers = {"Authorization": f"Basic {auth_b64}"}
url = "https://brightpath.scm.azurewebsites.net/api/vfs/site/wwwroot/server.py"
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as r:
        content = r.read().decode('utf-8')
        lines = content.splitlines()
        found = False
        for i, line in enumerate(lines):
            if "is_completed" in line:
                print(f"Line {i+1}: {line}")
                found = True
        if not found:
            print("No occurrences of 'is_completed' found in remote server.py!")
except Exception as e:
    print("Error:", e)
