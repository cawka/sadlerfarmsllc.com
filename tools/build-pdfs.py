#!/usr/bin/env python3
"""Build the downloadable PDFs for the developers page.

Each sheet is a small print-styled HTML page rendered to PDF by headless Chrome:
  assets/downloads/sadler-farms-land-use-concept.pdf
  assets/downloads/sadler-farms-lot-layout.pdf
  assets/downloads/sadler-farms-topography.pdf
  assets/downloads/sadler-farms-developer-package.pdf   (cover + facts + all sheets)

Usage: tools/build-pdfs.py
Sources: assets/site-plans/*.jpg, assets/img/hero.jpg (cover).
Facts and sheets come from _data/developer.json; file sizes are written back
there for the download links on developers.html.
"""
import datetime
import html
import json
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "downloads"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ISSUED = datetime.date.today().strftime("%B %Y")

# Site facts, sheet list and disclaimer are shared with developers.html.
DATA_FILE = ROOT / "_data" / "developer.json"
DATA = json.loads(DATA_FILE.read_text())
SHEETS = DATA["sheets"]
FACTS = [(html.escape(f["label"]), html.escape(f["value"])) for f in DATA["facts"]]
DISCLAIMER = DATA["disclaimer"]

CSS = """
@page { margin: 0.4in; }
@page land { size: letter landscape; }
@page port { size: letter portrait; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #20261f; }
.page { page-break-after: always; display: flex; flex-direction: column; }
.page:last-child { page-break-after: auto; }
.land { page: land; height: 7.7in; }
.port { page: port; height: 10.2in; }
.drawing { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
           border: 1px solid #c9c2ad; padding: 0.12in; background: #fff; }
.drawing img { max-width: 100%; max-height: 100%; object-fit: contain; }
.block { display: grid; grid-template-columns: 1.3fr 2.6fr 1.1fr; border: 1px solid #c9c2ad;
         border-top: 0; font-size: 8.5pt; }
.block > div { padding: 0.08in 0.12in; border-right: 1px solid #c9c2ad; }
.block > div:last-child { border-right: 0; }
.brand { font-family: Georgia, serif; font-size: 15pt; color: #1f3324; }
.brand small { display: block; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 7.5pt;
               letter-spacing: .12em; text-transform: uppercase; color: #8a6f2a; margin-top: 2px; }
.sheet-title { font-size: 11pt; font-weight: 600; color: #1f3324; margin-bottom: 2px; }
.flag { color: #8a2b1f; font-weight: 600; letter-spacing: .04em; }
.meta { text-align: right; }
.meta b { display: block; font-size: 20pt; color: #1f3324; line-height: 1; }
.fine { font-size: 7pt; color: #5c665e; margin-top: 0.06in; line-height: 1.35; }
/* cover + facts */
.cover { page: port; height: 10.2in; justify-content: space-between; }
.cover img { width: 100%; height: 5.6in; object-fit: cover; border-radius: 4px; }
.cover h1 { font-family: Georgia, serif; font-size: 34pt; color: #1f3324; margin: 0.25in 0 0.05in; }
.cover h2 { font-family: Georgia, serif; font-weight: normal; font-size: 16pt; color: #4c6b3c; margin: 0; }
.eyebrow { letter-spacing: .2em; text-transform: uppercase; font-size: 8.5pt; color: #8a6f2a; font-weight: 600; }
.contents { font-size: 10pt; line-height: 1.7; }
.facts { page: port; height: 10.2in; }
.facts h2 { font-family: Georgia, serif; color: #1f3324; font-size: 20pt; margin: 0 0 0.2in; }
table { border-collapse: collapse; width: 100%; font-size: 10.5pt; }
td { padding: 0.09in 0.1in; border-bottom: 1px solid #e4dcc8; vertical-align: top; }
td:first-child { width: 1.9in; font-weight: 600; color: #1f3324; }
"""


def title_block(sheet, total):
    return f"""
<div class="block">
  <div><div class="brand">Sadler Farms<small>Lake Wheeler &middot; Limestone County, AL</small></div></div>
  <div>
    <div class="sheet-title">{html.escape(sheet['title'])}</div>
    {html.escape(sheet['note'])}
    <div class="fine"><span class="flag">CONCEPTUAL &mdash; NOT FOR CONSTRUCTION. NOT A SURVEY.</span> {DISCLAIMER}</div>
  </div>
  <div class="meta">Sheet<b>{sheet['no']}</b>of {total}<div class="fine">Issued {ISSUED}</div></div>
</div>"""


def sheet_page(sheet, total):
    cls = "land" if sheet["orient"] == "landscape" else "port"
    img = (ROOT / sheet["image"]).as_uri()
    return f"""
<section class="page {cls}">
  <div class="drawing"><img src="{img}" alt=""></div>
  {title_block(sheet, total)}
</section>"""


def cover_page():
    photo = (ROOT / "assets/img/hero.jpg").as_uri()
    items = "".join(f"<div>Sheet {s['no']} &mdash; {html.escape(s['title'])}</div>" for s in SHEETS)
    return f"""
<section class="page cover">
  <div>
    <img src="{photo}" alt="">
    <p class="eyebrow" style="margin-top:.3in">Developer &amp; builder package</p>
    <h1>Sadler Farms</h1>
    <h2>A lakeside development opportunity on Lake Wheeler</h2>
  </div>
  <div class="contents">
    <div class="eyebrow">Contents</div>
    <div>Site facts</div>{items}
    <p class="fine">Issued {ISSUED}. {DISCLAIMER}</p>
  </div>
</section>"""


def facts_page():
    rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in FACTS)
    return f"""
<section class="page facts">
  <p class="eyebrow">Site facts</p>
  <h2>The property at a glance</h2>
  <table>{rows}</table>
  <p class="fine" style="margin-top:.25in">{DISCLAIMER}</p>
</section>"""


def render(pages, out):
    doc = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{pages}</body></html>"
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(doc)
        src = f.name
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--allow-file-access-from-files", f"--print-to-pdf={out}",
                    pathlib.Path(src).as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pathlib.Path(src).unlink()
    print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = len(SHEETS)
    for s in SHEETS:
        render(sheet_page(s, total), OUT / f"sadler-farms-{s['slug']}.pdf")
    package = cover_page() + facts_page() + "".join(sheet_page(s, total) for s in SHEETS)
    render(package, OUT / "sadler-farms-developer-package.pdf")

    # Record sizes for the download links (KB, rounded; MB above 1000 KB).
    def size(name):
        kb = (OUT / name).stat().st_size / 1024
        return f"{kb / 1024:.1f} MB" if kb >= 1000 else f"{kb:.0f} KB"
    DATA["package_size"] = size("sadler-farms-developer-package.pdf")
    for s in SHEETS:
        s["pdf_size"] = size(f"sadler-farms-{s['slug']}.pdf")
    DATA_FILE.write_text(json.dumps(DATA, indent=2) + "\n")


if __name__ == "__main__":
    main()
