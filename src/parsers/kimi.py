# src\parsers\kimi.py
from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class KimiParser(BaseParser):

    def parse(self):

        with open(self.html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        messages = []

        msgs = soup.select(".chat-content-item")

        print("=" * 60)
        print("KIMI PARSER")
        print("Found:", len(msgs))
        print("=" * 60)

        for msg in msgs:

            print(msg.get("class"))
            print(msg.get_text("\n", strip=True)[:200])
            print("-" * 40)

            classes = msg.get("class", [])

            if "chat-content-item-user" in classes:

                messages.append(
                    ChatMessage(
                        role=Role.USER,
                        element=msg
                    )
                )

            elif "chat-content-item-assistant" in classes:

                messages.append(
                    ChatMessage(
                        role=Role.ASSISTANT,
                        element=msg
                    )
                )

        print("ChatMessages:", len(messages))

        return messages