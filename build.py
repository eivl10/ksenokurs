import markdown
import os
import re

def read_file(filepath):
    # read in best effort
    for enc in ['utf-8', 'windows-1251', 'cp866']:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                return f.read()
        except:
            pass
    raise Exception(f"Cannot decode {filepath}")

def fix_charset(html):
    # replace charset=windows-1251 with charset=utf-8
    html = re.sub(r'charset=windows-1251', 'charset=utf-8', html, flags=re.IGNORECASE)
    html = re.sub(r'charset="windows-1251"', 'charset="utf-8"', html, flags=re.IGNORECASE)
    html = re.sub(r'charset=cp1251', 'charset=utf-8', html, flags=re.IGNORECASE)
    return html

def main():
    md = markdown.Markdown(extensions=['meta', 'tables', 'fenced_code'])
    
    # 1. Update starter_pack.html
    sp_md = read_file('course_content.md')
    sp_html = md.convert(sp_md)
    sp_tpl = read_file('starter_pack_template.html')
    sp_out = sp_tpl.replace('<!-- CONTENT -->', sp_html)
    sp_out = fix_charset(sp_out)
    
    with open('starter_pack.html', 'w', encoding='utf-8') as f:
        f.write(sp_out)
        
    # 2. Update course_materials.html
    setup_md = read_file('channel_setup.md')
    posts_md = read_file('telegram_posts.md')
    checklist_md = read_file('launch_checklist.md')
    
    setup_html = md.convert(setup_md)
    posts_html = md.convert(posts_md)
    checklist_html = md.convert(checklist_md)
    
    cm_tpl = read_file('course_materials_template.html')
    cm_out = cm_tpl.replace('<!-- SETUP -->', setup_html)
    cm_out = cm_out.replace('<!-- POSTS -->', posts_html)
    cm_out = cm_out.replace('<!-- CHECKLIST -->', checklist_html)
    cm_out = fix_charset(cm_out)
    
    with open('course_materials.html', 'w', encoding='utf-8') as f:
        f.write(cm_out)

    print("Successfully built starter_pack.html and course_materials.html in UTF-8!")

if __name__ == '__main__':
    main()
