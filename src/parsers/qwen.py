# src\parsers\qwen.py
from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role

print("=" * 60)
print("QWEN PARSER")
print("=" * 60)

class QwenParser(BaseParser):

    def parse(self):

        with open(self.html_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        messages = []

        msgs = soup.select(".qwen-chat-message")

        print("Found messages:", len(msgs))

        for msg in msgs:

            print(msg.get("class"))

            classes = msg.get("class", [])

            if "qwen-chat-message-user" in classes:

                messages.append(
                    ChatMessage(
                        role=Role.USER,
                        element=msg
                    )
                )

            elif "qwen-chat-message-assistant" in classes:

                # Remove "Thinking completed"
                thinking = msg.find(
                    string=lambda s: s and "Thinking completed" in s
                )

                if thinking:
                    thinking.extract()

                messages.append(
                    ChatMessage(
                        role=Role.ASSISTANT,
                        element=msg
                    )
                )

        print("Total ChatMessages:", len(messages))

        return messages