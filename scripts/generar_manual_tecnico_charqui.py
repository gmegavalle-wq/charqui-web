#!/usr/bin/env python3
"""Generate the CHARQUI technical manual DOCX from its Markdown source."""

from pathlib import Path
import argparse
import re
import sys

try:
    from docx import Document
    from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.section import WD_SECTION
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt, RGBColor
except ImportError as error:
    raise SystemExit("Falta python-docx. Instálalo con: python -m pip install python-docx") from error


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "manual_tecnico_charqui.md"
OUTPUT = ROOT / "docs" / "manual_tecnico_charqui.docx"


def inline(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    return text.strip()


def shade(cell, fill):
    props = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    props.append(shd)


def repeat_header(row):
    props = row._tr.get_or_add_trPr()
    tag = OxmlElement("w:tblHeader")
    tag.set(qn("w:val"), "true")
    props.append(tag)


def add_table(document, rows):
    table = document.add_table(rows=1, cols=len(rows[0]))
    table.style = "Table Grid"
    table.autofit = True
    repeat_header(table.rows[0])
    for i, value in enumerate(rows[0]):
        cell = table.rows[0].cells[i]
        shade(cell, "174C43")
        cell.text = inline(value)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        for para in cell.paragraphs:
            for run in para.runs:
                run.bold = True
                run.font.size = Pt(8)
                run.font.color.rgb = RGBColor(255, 255, 255)
    for row_values in rows[1:]:
        cells = table.add_row().cells
        for i, value in enumerate(row_values):
            cells[i].text = inline(value)
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for para in cells[i].paragraphs:
                para.paragraph_format.space_after = Pt(1)
                for run in para.runs:
                    run.font.size = Pt(8)
    document.add_paragraph()


def add_field(paragraph, instruction):
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), instruction)
    paragraph._p.append(field)


def set_margins(section):
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.82)
    section.right_margin = Inches(0.82)


def render(source: Path, output: Path):
    lines = source.read_text(encoding="utf-8-sig").splitlines()
    document = Document()
    set_margins(document.sections[0])

    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(9.5)
    normal.font.color.rgb = RGBColor(42, 51, 49)
    normal.paragraph_format.space_after = Pt(5)

    for name, size, color in (
        ("Title", 26, "174C43"),
        ("Heading 1", 18, "174C43"),
        ("Heading 2", 14, "28715F"),
        ("Heading 3", 11.5, "28715F"),
    ):
        style = document.styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)

    footer = document.sections[0].footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("CHARQUI · Manual técnico · ")
    add_field(footer, "PAGE")

    document.core_properties.title = "CHARQUI — Manual técnico"
    document.core_properties.subject = "Arquitectura, instalación y mantenimiento"

    i = 0
    first_title = True
    while i < len(lines):
        line = lines[i].strip()
        if not line or line == "---":
            i += 1
            continue
        if line.startswith("```"):
            i += 1
            code = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i].rstrip())
                i += 1
            i += 1
            p = document.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.15)
            p.paragraph_format.space_after = Pt(6)
            r = p.add_run("\n".join(code))
            r.font.name = "Consolas"
            r.font.size = Pt(8)
            r.font.color.rgb = RGBColor(45, 70, 63)
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?[\s:|-]+\|?\s*$", lines[i + 1]):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in row):
                    rows.append(row)
                i += 1
            add_table(document, rows)
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            text = inline(line[level:].strip())
            if level == 1 and first_title:
                p = document.add_paragraph(style="Title")
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.add_run(text)
                first_title = False
            else:
                document.add_heading(text, level=min(max(level - 1, 1), 3))
            i += 1
            continue
        if re.match(r"^\d+\.\s+", line):
            document.add_paragraph(inline(re.sub(r"^\d+\.\s+", "", line)), style="List Number")
            i += 1
            continue
        if re.match(r"^[-*]\s+", line):
            document.add_paragraph(inline(re.sub(r"^[-*]\s+", "", line)), style="List Bullet")
            i += 1
            continue
        if line.startswith(">"):
            p = document.add_paragraph(style="Intense Quote")
            p.add_run(inline(line.lstrip("> ")))
            i += 1
            continue
        p = document.add_paragraph()
        p.add_run(inline(line))
        i += 1

    output.parent.mkdir(parents=True, exist_ok=True)
    document.save(output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"No se encontró el documento fuente: {args.source}")
    render(args.source, args.output)
    print(f"Documento generado: {args.output.resolve()}")


if __name__ == "__main__":
    main()
