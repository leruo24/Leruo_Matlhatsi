"""Give every local script and stylesheet in the HTML pages a ?v=<version> query, so a browser
never mixes an old cached file with new ones after a push (GitHub Pages lets browsers cache files
for up to 10 minutes). Run before committing:  python3 tools/stamp.py"""
import re, subprocess, time, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
ver = time.strftime("%Y%m%d%H%M")
pages = ["index.html", "photo.html", "os/index.html", "tablet/index.html", "404.html"]
pat = re.compile(r'((?:src|href)=")((?!https?:|//|data:|#)[^"?]+\.(?:js|css))(?:\?v=\w+)?(")')
for p in pages:
    f = root / p
    if not f.exists(): continue
    s = f.read_text()
    n = pat.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
    if n != s: f.write_text(n); print("stamped", p)
