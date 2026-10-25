import glob
import re

tsx_files = glob.glob('app/**/*.tsx', recursive=True)
for f in tsx_files:
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        content = fp.read()
    if 'SafeAreaView' in content:
        uses_rn = False
        uses_ctx = False
        if re.search(r'import\s+[^;]*SafeAreaView[^;]*from\s+[\'"]react-native[\'"]', content, re.DOTALL):
            uses_rn = True
        if 'react-native-safe-area-context' in content and 'SafeAreaView' in content:
            uses_ctx = True
        print(f"{f}: RN={uses_rn}, CTX={uses_ctx}")
