import json
from pathlib import Path
from pypdf import PdfReader

PDF_NAME = "Lachlan @ Work.pdf"
OUT_JS = "notes-data.js"

def main():
    base = Path(__file__).parent
    pdf_path = (base / PDF_NAME)

    if not pdf_path.exists():
        # Help you immediately: show files in folder
        files = "\n".join(sorted([p.name for p in base.glob("*.pdf")]))
        raise FileNotFoundError(
            f"Couldn't find: {pdf_path}\n\nPDFs in this folder:\n{files if files else '(none)'}"
        )

    reader = PdfReader(str(pdf_path))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").replace("\r", "\n").strip()
        pages.append({"page": i, "meta": "", "text": text})

    data = {"pages": pages, "workflow": []}

    (base / OUT_JS).write_text(
        "window.NOTES_DATA = " + json.dumps(data, ensure_ascii=False) + ";",
        encoding="utf-8"
    )
    print(f"✅ Generated {OUT_JS} with {len(pages)} pages from {pdf_path.name}")

if __name__ == "__main__":
    main()