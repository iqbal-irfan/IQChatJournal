# src\renderers.py
from bs4 import NavigableString, Tag
from constants import UI_WORDS

class PlainTextRenderer:

    def render(self, element):

        out = []

        for child in element.children:
            self.walk(child, out)

        return "".join(out)

    def walk(self, node, out):

        if isinstance(node, NavigableString):

            text = str(node)

            if text.strip() in UI_WORDS:
                return

            out.append(text)
            return

        if not isinstance(node, Tag):
            return

        name = node.name.lower()

        # Skip ChatGPT copy button / language header
        if name == "button":
            return

        # Paragraph
        if name == "p":
            for c in node.children:
                self.walk(c, out)
            out.append("\n\n")
            return

        # Code block
        if name == "pre":

            code = node.find("code")

            if code:
                out.append("\n")
                out.append(code.get_text())
                out.append("\n\n")
                return

        # Line break
        if name == "br":
            out.append("\n")
            return

        # List
        if name == "li":
            out.append("- ")
            for c in node.children:
                self.walk(c, out)
            out.append("\n")
            return

        # Heading
        if name in ("h1", "h2", "h3", "h4"):
            out.append("\n")
            for c in node.children:
                self.walk(c, out)
            out.append("\n\n")
            return

        # Default
        for c in node.children:
            self.walk(c, out)