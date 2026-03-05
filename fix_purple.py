import os
import re

TARGET_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.css']
DIRS = ['app', 'features', 'components', 'lib', 'context']

def replace_colors():
    for d in DIRS:
        for root, _, files in os.walk(d):
            if 'node_modules' in root or '.next' in root:
                continue
            for file in files:
                if any(file.endswith(ext) for ext in TARGET_EXTS):
                    path = os.path.join(root, file)
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if 'purple' in content or 'violet' in content:
                        new_content = content.replace('purple', 'teal').replace('violet', 'emerald')
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Fixed {path}")

if __name__ == '__main__':
    replace_colors()
