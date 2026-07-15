import markdown
import os
import re
import yaml

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

    # 3. Update index.html
    index_md_content = read_file('index_content.md')
    
    # Parse frontmatter with PyYAML
    frontmatter = {}
    body = index_md_content
    
    if index_md_content.startswith('---'):
        parts = index_md_content.split('---', 2)
        if len(parts) >= 3:
            try:
                frontmatter = yaml.safe_load(parts[1]) or {}
                body = parts[2].strip()
            except yaml.YAMLError as e:
                print(f"Error parsing YAML frontmatter: {e}")
                
    index_html_body = md.convert(body)
    index_tpl = read_file('index_template.html')
    
    # Replace variables from frontmatter
    for key, value in frontmatter.items():
        if key == 'extra_blocks':
            continue # Handle separately
        # Convert value to string in case it's not
        str_val = str(value) if value is not None else ""
        index_tpl = index_tpl.replace('{{' + key + '}}', str_val)
        
    # Handle extra blocks
    extra_blocks_html = ""
    extra_blocks = frontmatter.get('extra_blocks', [])
    if extra_blocks:
        extra_blocks_html += '<section class="extra-blocks-section container" style="padding: 40px 20px;">\n'
        for block in extra_blocks:
            btype = block.get('type')
            if btype == 'text_block':
                content = md.convert(block.get('content', ''))
                extra_blocks_html += f'<div class="extra-block-text" style="margin-bottom: 30px;">{content}</div>\n'
            elif btype == 'heading2':
                title = block.get('title', '')
                extra_blocks_html += f'<h2 class="section-title" style="margin-bottom: 30px; text-align: left; color: var(--kosmosky-dark); font-family: var(--font-heading); font-size: 2.5rem; font-weight: 700;">{title}</h2>\n'
        extra_blocks_html += '</section>\n'
            
    index_tpl = index_tpl.replace('<!-- EXTRA_BLOCKS -->', extra_blocks_html)
    index_tpl = index_tpl.replace('<!-- AUTHOR_TEXT -->', index_html_body)
    index_out = fix_charset(index_tpl)
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(index_out)

    print("Successfully built index.html, starter_pack.html and course_materials.html in UTF-8!")

if __name__ == '__main__':
    main()
