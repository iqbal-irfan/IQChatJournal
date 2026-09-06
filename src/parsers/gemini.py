# src\parsers\gemini.py
from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class GeminiParser(BaseParser):

    def parse(self):

        with open(self.html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        messages = []

        containers = soup.select(".conversation-container")

        for container in containers:

            # -------------------------
            # USER
            # -------------------------
            user = container.find("user-query")

            if user:
                messages.append(
                    ChatMessage(
                        role=Role.USER,
                        element=user
                    )
                )

            # -------------------------
            # GEMINI
            # -------------------------
            response = container.find("model-response")

            if response:
                messages.append(
                    ChatMessage(
                        role=Role.ASSISTANT,
                        element=response
                    )
                )

        return messages