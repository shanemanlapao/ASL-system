import urllib.request
import re

url = "https://expo.dev/accounts/radny/projects/brightpath/builds/c43a6a4c-fde1-4ef1-82f2-f2df4c96eddf"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req) as r:
        html = r.read().decode("utf-8", errors="ignore")
        # Find apk links
        apk_links = [m for m in re.findall(r'https://[^"\'\s>]+\.apk[^"\'\s>]*', html)]
        print("Found APK URLs:", set(apk_links))
        
        # Look for version and build metadata
        for pattern in [r'"version":\s*"([^"]+)"', r'"versionCode":\s*([0-9]+)', r'Version\s*([\d\.]+)']:
            m = re.findall(pattern, html)
            if m:
                print(f"Pattern {pattern}:", m)
except Exception as e:
    print("Error:", e)
