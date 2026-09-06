# src\parsers\chatgpt.py
from bs4 import BeautifulSoup
from copy import copy
from models import ChatMessage
from parsers.base import BaseParser
from models import ChatMessage, Role

class ChatGPTParser(BaseParser):
    def __init__(self, html_path):
        self.html_path = html_path

    def parse(self):
        with open(self.html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "lxml")

        messages = []

        # Every user/assistant message
        blocks = soup.select("[data-message-author-role]")

        print("=" * 60)
        print("Total blocks:", len(blocks))

        roles = {}

        for b in blocks:
            role = b.get("data-message-author-role", "UNKNOWN")
            roles[role] = roles.get(role, 0) + 1

        print(roles)
        print("=" * 60)

        for block in blocks:

            role_text = block.get("data-message-author-role", "").strip()

            role = (
                Role.USER
                if role_text == "user"
                else Role.ASSISTANT
            )

            # Assistant messages
            body = block.select_one(".markdown.prose")

            # User messages
            if body is None:
                body = block.select_one(".whitespace-pre-wrap")

            if body is None:
                continue

            from copy import copy

            if body:
                messages.append(
                    ChatMessage(
                        role=role,
                        element=copy(body)
                    )
                )

        return messages