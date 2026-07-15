import re
import os

def insert_identity(filepath):
    # Try different encodings
    content = None
    enc = None
    for encoding in ['utf-8', 'windows-1251', 'cp866']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                content = f.read()
                enc = encoding
                break
        except:
            pass
            
    if not content:
        print(f"Could not read {filepath}")
        return
        
    script_tag = '<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>'
    
    if script_tag not in content:
        content = re.sub(r'</head>', f'{script_tag}\n</head>', content, flags=re.IGNORECASE)
        with open(filepath, 'w', encoding=enc) as f:
            f.write(content)
        print(f"Added identity widget to {filepath}")
    else:
        print(f"Identity widget already in {filepath}")

def update_config(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = re.sub(r'local_backend:\s*true\n?', '', content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error updating config: {e}")

insert_identity('landing_page.html')
insert_identity('course_materials_template.html')
insert_identity('starter_pack_template.html')
insert_identity('Netlify/admin/index.html')
update_config('Netlify/admin/config.yml')

