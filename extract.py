with open('gemini_share.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('ASLG-PC12')
print('Index of ASLG-PC12:', idx)

# Let's search for user prompt and model responses in text
# In google share pages, JSON is often embedded in AF_initDataCallback or window.WIZ_global_data
# Let's write out text from 10,000 chars before idx to 60,000 chars after idx
start = max(0, idx - 15000)
end = min(len(text), idx + 100000)
with open('extracted_convo.txt', 'w', encoding='utf-8') as f_out:
    f_out.write(text[start:end])

print('Saved chunk of size:', end - start)
