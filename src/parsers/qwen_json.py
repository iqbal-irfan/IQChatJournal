import json
from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class QwenJSONParser(BaseParser):

    def parse(self):

        with open(
            self.html_path,
            "r",
            encoding="utf-8"
        ) as f:
            data = json.load(f)

        messages = data.get("messages", [])

        print("=" * 60)
        print("QWEN JSON PARSER")
        print("Found:", len(messages))
        print("=" * 60)

        result = []

        for message in messages:

            role = str(
                message.get("role", "")
            ).lower()

            text = (
                message.get("content")
                or message.get("text")
                or ""
            )

            if isinstance(text, list):
                text = "\n".join(
                    str(x) for x in text
                )

            text = str(text).strip()

            if not text:
                continue

            element = BeautifulSoup(
                f"<div>{text}</div>",
                "html.parser"
            ).div

            if role == "user":

                result.append(
                    ChatMessage(
                        role=Role.USER,
                        element=element
                    )
                )

            elif role in (
                "assistant",
                "model"
            ):

                result.append(
                    ChatMessage(
                        role=Role.ASSISTANT,
                        element=element
                    )
                )

        print(
            "ChatMessages:",
            len(result)
        )

        return result