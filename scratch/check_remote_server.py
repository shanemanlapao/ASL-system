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
        print("Total lines in remote server.py:", len(lines))
        for i, line in enumerate(lines):
            if "student_quiz_attempts" in line and "cnt" in line:
                for j in range(max(0, i-2), min(len(lines), i+8)):
                    print(f"{j+1}: {lines[j]}")
                break
except Exception as e:
    print("Error:", e)
