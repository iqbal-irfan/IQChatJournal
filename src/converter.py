# src\converter.py
import os
from pathlib import Path

from parsers.registry import ParserRegistry
from exporters.txt import TXTExporter
from exporters.markdown import MarkdownExporter
from exporters.pdf import PDFExporter

def convert(
    html_file,
    output_folder,
    txt=True,
    md=True,
    pdf=True,
    output_name=None,
    source_name=None,
):
    parser = ParserRegistry.get_parser(html_file)

    messages = parser.parse()

    html_name = (
        output_name
        if output_name
        else Path(html_file).stem
    )

    source_line = (
        f"Source: {source_name}\n\n"
        if source_name
        else ""
    )

    chat_folder = output_folder

    assets_folder = os.path.join(
        chat_folder,
        "assets"
    )

    os.makedirs(
        assets_folder,
        exist_ok=True
    )
    if txt:

        txt_file = os.path.join(
            chat_folder,
            f"{html_name}.txt"
        )

        try:

            TXTExporter().export(
                messages,
                txt_file,
                source_name=source_name
            )

        except PermissionError:

            print(
                f"[SKIP] TXT is open: {txt_file}"
            )

    if md:

        md_file = os.path.join(
            chat_folder,
            f"{html_name}.md"
        )

        try:

            MarkdownExporter().export(
                messages,
                md_file,
                source_name=source_name
            )

        except PermissionError:

            print(
                f"[SKIP] Markdown is open: {md_file}"
            )

    if pdf:

        pdf_file = os.path.join(
            chat_folder,
            f"{html_name}.pdf"
        )

        try:

            PDFExporter().export(
                messages,
                pdf_file,
                source_name=source_name
            )

        except PermissionError:

            print(
                f"[SKIP] PDF is open: {pdf_file}"
            )
            
    return {
        "folder": chat_folder,
        "txt": txt,
        "md": md,
        "pdf": pdf,
    }