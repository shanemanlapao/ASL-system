import urllib.request
import time
from concurrent.futures import ThreadPoolExecutor

endpoints = [
    "/health",
    "/student/7/streak",
    "/student/7/home-summary",
    "/daily-quizzes/7",
    "/student/7/home-summary",
]

def fetch(ep):
    url = f"https://brightpath.azurewebsites.net{ep}"
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return ep, r.status, time.time() - t0
    except Exception as e:
        return ep, f"ERR: {e}", time.time() - t0

t_start = time.time()
with ThreadPoolExecutor(max_workers=5) as executor:
    results = list(executor.map(fetch, endpoints))
total_elapsed = time.time() - t_start

print(f"Total time for {len(endpoints)} CONCURRENT requests: {total_elapsed:.2f}s")
for ep, st, dur in results:
    print(f"  {ep}: {st} in {dur:.2f}s")
