#!/usr/bin/env python3
"""Generate the CHARQUI user manual DOCX from its Markdown source."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt, RGBColor
except ImportError as error:
    raise SystemExit(
        "Falta python-docx. Instálalo con: python -m pip install python-docx"
    ) from error


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "docs" / "manual_usuario_charqui.md"
DEFAULT_OUTPUT = ROOT / "docs" / "manual_usuario_charqui.docx"


def clean_inline(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"(\*\*|__)(.*?)\1", r"\2", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()


def shade_cell(cell, fill: str) -> None:
    properties = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    properties.append(shading)


def set_repeat_table_header(row) -> None:
    properties = row._tr.get_or_add_trPr()
    repeat = OxmlElement("w:tblHeader")
    repeat.set(qn("w:val"), "true")
    properties.append(repeat)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.add_run("CHARQUI · Manual de usuario · ")
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    paragraph._p.append(field)


def add_markdown_table(document: Document, rows: list[list[str]]) -> None:
    if not rows:
        return
    table = document.add_table(rows=1, cols=len(rows[0]))
    table.style = "Table Grid"
    table.autofit = True
    header = table.rows[0]
    set_repeat_table_header(header)
    for index, value in enumerate(rows[0]):
        cell = header.cells[index]
        cell.text = clean_inline(value)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        shade_cell(cell, "174C43")
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(9)
    for values in rows[1:]:
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cells[index].text = clean_inline(value)
            cells[index].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for paragraph in cells[index].paragraphs:
                paragraph.paragraph_format.space_after = Pt(2)
                for run in paragraph.runs:
                    run.font.size = Pt(8.5)
    document.add_paragraph()


def render_markdown(source: Path, output: Path) -> None:
    lines = source.read_text(encoding="utf-8-sig").splitlines()
    document = Document()
    section = document.sections[0]
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.85)
    section.right_margin = Inches(0.85)

    normal = document.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor(45, 54, 51)
    normal.paragraph_format.space_after = Pt(6)
    for style_name, size, color in (
        ("Title", 28, "174C43"),
        ("Heading 1", 19, "174C43"),
        ("Heading 2", 14, "28715F"),
        ("Heading 3", 11, "28715F"),
    ):
        style = document.styles[style_name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)

    footer = section.footer.paragraphs[0]
    add_page_number(footer)
    document.core_properties.title = "CHARQUI — Manual de usuario oficial"
    document.core_properties.subject = "Guía de uso para clientes y administración"

    index = 0
    cover_started = False
    while index < len(lines):
        stripped = lines[index].strip()
        if not stripped or stripped == "---":
            index += 1
            continue
        if stripped == "<!-- PAGEBREAK -->":
            document.add_page_break()
            index += 1
            continue
        if stripped.startswith("```"):
            index += 1
            code_lines = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index].rstrip())
                index += 1
            paragraph = document.add_paragraph()
            paragraph.paragraph_format.left_indent = Inches(0.18)
            paragraph.paragraph_format.space_after = Pt(8)
            run = paragraph.add_run("\n".join(code_lines))
            run.font.name = "Consolas"
            run.font.size = Pt(8.5)
            run.font.color.rgb = RGBColor(45, 70, 63)
            index += 1
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and re.match(
            r"^\s*\|?[\s:|-]+\|?\s*$", lines[index + 1]
        ):
            table_rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                row = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in row):
                    table_rows.append(row)
                index += 1
            add_markdown_table(document, table_rows)
            continue
        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            text = clean_inline(stripped[level:].strip())
            if level == 1 and not cover_started:
                paragraph = document.add_paragraph(style="Title")
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                paragraph.add_run(text)
                cover_started = True
            else:
                heading_level = min(max(level - 1, 1), 3)
                document.add_heading(text, level=heading_level)
            index += 1
            continue
        if stripped.startswith(">"):
            paragraph = document.add_paragraph(style="Quote")
            paragraph.add_run(clean_inline(stripped.lstrip("> ")))
            index += 1
            continue
        if re.match(r"^\d+\.\s+", stripped):
            paragraph = document.add_paragraph(style="List Number")
            paragraph.add_run(clean_inline(re.sub(r"^\d+\.\s+", "", stripped)))
            index += 1
            continue
        if re.match(r"^[-*]\s+", stripped):
            paragraph = document.add_paragraph(style="List Bullet")
            paragraph.add_run(clean_inline(re.sub(r"^[-*]\s+", "", stripped)))
            index += 1
            continue

        paragraph = document.add_paragraph()
        paragraph.add_run(clean_inline(stripped))
        if cover_started and index < 8:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        index += 1

    output.parent.mkdir(parents=True, exist_ok=True)
    document.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Archivo Markdown de entrada")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Archivo DOCX de salida")
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"No se encontró el manual de entrada: {args.source}")
    try:
        render_markdown(args.source, args.output)
    except OSError as error:
        raise SystemExit(f"No se pudo leer o escribir el documento: {error}") from error
    print(f"Documento Word generado: {args.output.resolve()}")


if __name__ == "__main__":
    main()
