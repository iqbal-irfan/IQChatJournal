# src\exporters\pdf.py
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics

from renderers import PlainTextRenderer
from utils import collapse_blank_lines

class PDFExporter:

    def __init__(self):
        self.renderer = PlainTextRenderer()
        self.styles = getSampleStyleSheet()

    def export(self, messages, output_file, source_name=None):

        doc = SimpleDocTemplate(
            output_file,
            leftMargin=40,
            rightMargin=40,
            topMargin=50,
            bottomMargin=50,
        )

        story = []

        if source_name:
            story.append(
                Paragraph(
                    f"Source: {source_name}",
                    self.styles["Normal"]
                )
            )
            story.append(Spacer(1, 12))

        heading = self.styles["Heading1"]
        normal = self.styles["Code"]

        heading.spaceAfter = 12
        heading.spaceBefore = 20
        heading.leading = 22

        for msg in messages:

            if msg.role.value == "assistant":
                role = "Assistant"
            else:
                role = "User"

            story.append(
                Paragraph(role, heading)
            )

            text = self.renderer.render(msg.element)
            text = collapse_blank_lines(text)

            text = (
                text.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\n", "<br/>")
            )

            story.append(
                Paragraph(text, normal)
            )

            story.append(
                Spacer(1, 12)
            )

        doc.build(
            story,
            onFirstPage=self.add_page_number,
            onLaterPages=self.add_page_number
        )

    def add_page_number(self, canvas, doc):
        page_num = canvas.getPageNumber()

        canvas.setFont("Helvetica", 9)

        canvas.drawRightString(
            doc.pagesize[0] - 40,
            20,
            f"Page {page_num}"
        )