import fitz  # pymupdf
from pathlib import Path
import sys

# Use raw string paths
pdf_path = Path(r"f:\Vibecoding\Kosmosky\Ксенокурс по ритму\брендбук дизайн раздел.pdf")
output_dir = Path(r"f:\Vibecoding\Kosmosky\Ксенокурс по ритму\brandbook_pages")

print(f"PDF exists: {pdf_path.exists()}", flush=True)
print(f"PDF path: {pdf_path}", flush=True)

if not pdf_path.exists():
    # Try listing directory to find the file
    parent = pdf_path.parent
    print(f"Files in {parent}:", flush=True)
    for f in parent.iterdir():
        if f.suffix.lower() == '.pdf':
            print(f"  PDF found: {f.name}", flush=True)
    sys.exit(1)

output_dir.mkdir(parents=True, exist_ok=True)

doc = fitz.open(str(pdf_path))
print(f"Total pages: {doc.page_count}", flush=True)

for i, page in enumerate(doc):
    zoom = 150 / 72  # dpi=150
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    out_path = output_dir / f"page_{i+1:02d}.png"
    pix.save(str(out_path))
    print(f"Saved page {i+1}: {out_path.name} ({pix.width}x{pix.height})", flush=True)

doc.close()
print("Done!", flush=True)
