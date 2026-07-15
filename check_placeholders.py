import re

def check_file(filename, out):
    encodings = ['utf-8', 'windows-1251', 'cp866', 'latin-1']
    content = None
    for enc in encodings:
        try:
            with open(filename, 'r', encoding=enc) as f:
                content = f.read()
            break
        except UnicodeDecodeError:
            continue

    if content:
        matches = re.findall(r'<!--.*?-->', content)
        out.write(f"--- {filename} ---\n")
        for m in set(matches):
            out.write(m + "\n")

with open('placeholders.txt', 'w', encoding='utf-8') as out:
    check_file('course_materials.html', out)
    check_file('starter_pack.html', out)
