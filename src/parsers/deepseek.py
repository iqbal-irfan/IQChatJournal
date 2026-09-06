# src\parsers\deepseek.py
from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class DeepSeekParser(BaseParser):

    def parse(self):

        with open(self.html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        messages = []

        for msg in soup.select(".ds-message"):

            # Assistant
            if msg.select_one(".ds-assistant-message-main-content"):

                text = msg.get_text("\n", strip=True)

                lines = text.splitlines()

                cleaned = []

                skip_prefixes = (
                    "Thought for",
                    "Read ",
                )

                for line in lines:

                    line = line.strip()

                    if not line:
                        continue

                    if line.startswith(skip_prefixes):
                        continue

                    cleaned.append(line)

                clean_text = "\n".join(cleaned)

                clean_msg = BeautifulSoup(
                    f"<div>{clean_text}</div>",
                    "html.parser"
                )

                messages.append(
                    ChatMessage(
                        role=Role.ASSISTANT,
                        element=clean_msg
                    )
                )

            # User
            else:

                messages.append(
                    ChatMessage(
                        role=Role.USER,
                        element=msg
                    )
                )

        return messages