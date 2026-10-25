import urllib.request
import base64
import json

auth_str = "$brightpath:rJlMtMFgZSQSwilvaEuhWNWSgQtuKcAa3GoDcZG2yCSkEe7XmKBjlmu5uqPG"
auth_b64 = base64.b64encode(auth_str.encode()).decode()

headers = {
    "Authorization": f"Basic {auth_b64}",
    "If-Match": "*"
}

del_req = urllib.request.Request(
    "https://brightpath.scm.azurewebsites.net/api/vfs/site/wwwroot/oryx-manifest.toml",
    headers=headers,
    method="DELETE"
)
try:
    with urllib.request.urlopen(del_req) as r:
        print("Deleted oryx-manifest.toml:", r.status)
except Exception as e:
    print("oryx-manifest.toml:", e)
