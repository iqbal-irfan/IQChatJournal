# src\exporters\markdown.py
from renderers import PlainTextRenderer
from utils import collapse_blank_lines

class MarkdownExporter:

    def __init__(self):
        self.renderer = PlainTextRenderer()

    def export(self, messages, output_file, source_name=None):

        with open(output_file, "w", encoding="utf-8") as f:

            f.write("# IQChatJournal\n\n")

            if source_name:
                f.write(f"Source: {source_name}\n\n")

            for msg in messages:

                f.write(f"# {msg.role.value.title()}\n\n")

                text = self.renderer.render(msg.element)
                text = collapse_blank_lines(text)

                f.write(text)

                f.write("\n\n---\n\n")