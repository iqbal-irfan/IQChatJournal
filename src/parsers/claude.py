# src\parsers\claude.py

import json

from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class ClaudeParser(BaseParser):

    def parse(self):

        with open(
            self.html_path,
            "r",
            encoding="utf-8"
        ) as f:

            data = json.load(f)

        messages = []

        chat_messages = data.get(
            "chat_messages",
            []
        )

        for msg in chat_messages:

            sender = str(
                msg.get(
                    "sender",
                    ""
                )
            ).lower()

            content = msg.get(
                "content",
                []
            )

            if isinstance(
                content,
                list
            ):

                parts = []

                for item in content:

                    if isinstance(
                        item,
                        dict
                    ):

                        text = item.get(
                            "text",
                            ""
                        )

                        if text:

                            parts.append(
                                str(text)
                            )

                    elif item:

                        parts.append(
                            str(item)
                        )

                text = "\n".join(
                    parts
                )

            else:

                text = str(
                    content or ""
                )

            if not text.strip():

                continue

            if sender in (
                "human",
                "user"
            ):

                role = Role.USER

            elif sender in (
                "assistant",
                "claude"
            ):

                role = Role.ASSISTANT

            else:

                continue

            element = BeautifulSoup(
                text,
                "html.parser"
            )

            messages.append(
                ChatMessage(
                    role=role,
                    element=element
                )
            )

        return messages