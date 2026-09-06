import json

from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class GeminiJSONParser(BaseParser):

    def parse(self):

        with open(
            self.html_path,
            "r",
            encoding="utf-8"
        ) as f:

            data = json.load(f)


        messages = data.get(
            "messages",
            []
        )


        chat_messages = []


        for message in messages:

            role = message.get(
                "role"
            )

            content = message.get(
                "content",
                ""
            )


            if not content:
                continue


            if role == "user":

                chat_role = Role.USER

            elif role in (
                "model",
                "assistant"
            ):

                chat_role = Role.ASSISTANT

            else:

                continue


            soup = BeautifulSoup(
                "<div></div>",
                "html.parser"
            )


            element = soup.div


            element.append(
                content
            )


            chat_messages.append(
                ChatMessage(
                    role=chat_role,
                    element=element
                )
            )


        return chat_messages