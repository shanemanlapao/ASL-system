import urllib.request
import re

# 1. Fetch remote index.html
url = "https://brightpath.azurewebsites.net/"
with urllib.request.urlopen(url, timeout=15) as resp:
    remote_html = resp.read().decode('utf-8')

# 2. Read local dist/index.html
with open('dist/index.html', 'r', encoding='utf-8') as f:
    local_html = f.read()

# Extract script src
remote_scripts = re.findall(r'src="([^"]+)"', remote_html)
local_scripts = re.findall(r'src="([^"]+)"', local_html)

print("Remote scripts:", remote_scripts)
print("Local scripts: ", local_scripts)
if remote_scripts == local_scripts:
    print("MATCH: Azure has the latest dist/ bundle!")
else:
    print("MISMATCH: Azure is running an older bundle.")
