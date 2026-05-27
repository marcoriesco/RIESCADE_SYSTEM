import os
import shutil

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # emulationstation/.riescade/src
    themes_dir = os.path.abspath(os.path.join(base_dir, '..', 'themes'))
    
    src_theme = os.path.join(themes_dir, 'default')
    dst_theme = os.path.join(themes_dir, 'antigravity')
    
    print(f"Source Theme: {src_theme}")
    print(f"Destination Theme: {dst_theme}")
    
    if not os.path.exists(src_theme):
        print("Error: Source default theme not found!")
        return
        
    if os.path.exists(dst_theme):
        print("Destination already exists, cleaning it up first...")
        shutil.rmtree(dst_theme)
        
    shutil.copytree(src_theme, dst_theme)
    print("Theme copied successfully!")

if __name__ == '__main__':
    main()
