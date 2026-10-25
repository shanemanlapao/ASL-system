import urllib.request
import base64
import json

auth_str = "$brightpath:rJlMtMFgZSQSwilvaEuhWNWSgQtuKcAa3GoDcZG2yCSkEe7XmKBjlmu5uqPG"
auth_b64 = base64.b64encode(auth_str.encode()).decode()

headers = {"Authorization": f"Basic {auth_b64}"}

def check_dir(path):
    url = f"https://brightpath.scm.azurewebsites.net/api/vfs/{path}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            items = json.loads(r.read().decode())
            print(f"Items in {path}:")
            for it in items:
                print(" ", it.get("name"), it.get("mime"))
    except Exception as e:
        print(f"Error {path}:", e)

check_dir("site/")
check_dir("site/wwwroot/")
