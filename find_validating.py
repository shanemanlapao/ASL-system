with open('gemini_share.html', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('Validating')
print('Position:', pos)
if pos != -1:
    snippet = text[max(0, pos-200):min(len(text), pos+5000)]
    with open('validating_snippet.txt', 'w', encoding='utf-8') as out:
        out.write(snippet)
    print("Wrote validating_snippet.txt")
