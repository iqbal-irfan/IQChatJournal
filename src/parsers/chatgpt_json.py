import json
from bs4 import BeautifulSoup

from parsers.base import BaseParser
from models import ChatMessage, Role


class ChatGPTJSONParser(BaseParser):

    def __init__(self, json_path):
        self.json_path = json_path


    def parse(self):

        with open(
            self.json_path,
            "r",
            encoding="utf-8"
        ) as f:

            data = json.load(f)


        # --------------------------------------------------
        # GET MESSAGE OBJECTS
        # --------------------------------------------------

        ordered_messages = self._get_messages(data)

        # print("=" * 60)
        # print("CHATGPT JSON RAW ANALYSIS")
        # print("Top-level keys:", list(data.keys()))

        # if isinstance(data.get("messages"), list):
        #     print(
        #         "Direct messages array:",
        #         len(data["messages"])
        #     )

        # if isinstance(data.get("mapping"), dict):
        #     print(
        #         "Mapping nodes:",
        #         len(data["mapping"])
        #     )

        # print(
        #     "Messages returned by _get_messages:",
        #     len(ordered_messages)
        # )
        # print("=" * 60)


        if not ordered_messages:

            raise Exception(
                "ChatGPT JSON contains no readable messages."
            )


        # --------------------------------------------------
        # CONVERT TO CHATMESSAGES
        # --------------------------------------------------

        messages = []


        message_number = 0

        for message in ordered_messages:

            message_number += 1

            if not message:

                print(
                    "SKIP",
                    message_number,
                    ": empty message"
                )

                continue


            author = message.get(
                "author",
                {}
            )

            role_text = author.get(
                "role"
            )


            # Only user / assistant messages
            if role_text not in (
                "user",
                "assistant"
            ):

                # print(
                #     "SKIP",
                #     message_number,
                #     ": role =",
                #     role_text
                # )

                continue


            metadata = message.get(
                "metadata",
                {}
            )


            # Skip tool-generated messages
            if metadata.get(
                "real_author"
            ) == "tool":

                print(
                    "SKIP",
                    message_number,
                    ": real_author = tool"
                )

                continue


            # Skip visually hidden messages
            if metadata.get(
                "is_visually_hidden_from_conversation"
            ):
                continue


            # Skip actual assistant tool calls only.
            #
            # Normal assistant messages can contain recipient
            # metadata, so do not discard them just because
            # recipient is present.

            recipient = message.get(
                "recipient"
            )

            if (
                role_text == "assistant"
                and recipient
                and recipient not in (
                    "all",
                    None
                )
                and content.get(
                    "content_type"
                ) in (
                    "tool_call",
                    "tool_result"
                )
            ):
                continue


            content = message.get(
                "content",
                {}
            )


            content_type = content.get(
                "content_type"
            )


            # Never save internal reasoning
            if content_type in (
                "thoughts",
                "reasoning_recap"
            ):
                continue


            parts = content.get(
                "parts",
                []
            )


            if not parts:
                continue


            html_parts = []


            for part in parts:

                if isinstance(part, str):

                    pass


                elif (
                    isinstance(part, dict)
                    and part.get(
                        "content_type"
                    ) == "image_asset_pointer"
                ):

                    html_parts.append(
                        "<p>[Image attached]</p>"
                    )

                    continue


                else:

                    continue


                if content_type == "code":

                    html_parts.append(
                        "<pre><code>"
                        +
                        self._escape_html(part)
                        +
                        "</code></pre>"
                    )


                else:

                    paragraphs = part.split(
                        "\n\n"
                    )


                    for paragraph in paragraphs:

                        lines = paragraph.split(
                            "\n"
                        )


                        html_text = "<br/>".join(

                            self._escape_html(line)

                            for line in lines
                        )


                        html_parts.append(

                            "<p>"
                            +
                            html_text
                            +
                            "</p>"
                        )


            if not html_parts:
                continue


            html = (

                "<div>"
                +
                "".join(html_parts)
                +
                "</div>"
            )


            soup = BeautifulSoup(
                html,
                "html.parser"
            )


            element = soup.div


            role = (

                Role.USER

                if role_text == "user"

                else Role.ASSISTANT
            )


            messages.append(

                ChatMessage(
                    role=role,
                    element=element
                )
            )


        print("=" * 60)
        print("CHATGPT JSON PARSER")
        print(
            "Source messages:",
            len(ordered_messages)
        )
        print(
            "ChatMessages:",
            len(messages)
        )
        print("=" * 60)


        return messages


    # --------------------------------------------------
    # DETECT CHATGPT JSON FORMAT
    # --------------------------------------------------

    def _get_messages(self, data):


        # ==============================================
        # FORMAT 1
        #
        # OLD CHATGPT FORMAT
        #
        # {
        #     "mapping": {...},
        #     "current_node": "..."
        # }
        # ==============================================

        mapping = data.get(
            "mapping"
        )


        if isinstance(mapping, dict) and mapping:

            return self._get_mapping_messages(
                data,
                mapping
            )

        
        # ==============================================
        # FORMAT 2
        #
        # NEW CHATGPT CAPTURE FORMAT
        #
        # Conversation may contain message objects
        # directly inside:
        #
        # {
        #     "messages": [...]
        # }
        #
        # or:
        #
        # {
        #     "items": [...]
        # }
        # ==============================================

        for key in (
            "items",
            "messages"
        ):

            value = data.get(key)

            if isinstance(value, list):

                # ChatGPT's direct messages array is not guaranteed
                # to be in chronological order.
                # Sort by create_time before returning it.
                return sorted(
                    value,
                    key=lambda message:
                        message.get("create_time")
                        if isinstance(
                            message,
                            dict
                        )
                        and isinstance(
                            message.get("create_time"),
                            (int, float)
                        )
                        else 0
                )


        # ==============================================
        # FORMAT 3
        #
        # NEW CHATGPT API RESPONSE FORMAT
        #
        # Message objects may be nested inside the
        # conversation JSON without a "mapping".
        # ==============================================

        found = []
        seen_ids = set()


        def is_message_object(value):

            if not isinstance(value, dict):

                return False


            author = value.get(
                "author"
            )

            content = value.get(
                "content"
            )


            return (

                isinstance(author, dict)

                and isinstance(content, dict)

                and "role" in author

                and "content_type" in content
            )


        def walk(value):

            if isinstance(value, dict):

                if is_message_object(value):

                    message_id = value.get(
                        "id"
                    )


                    if message_id:

                        if message_id in seen_ids:

                            return

                        seen_ids.add(
                            message_id
                        )


                    found.append(
                        value
                    )

                    return


                for child in value.values():

                    walk(child)


            elif isinstance(value, list):

                for child in value:

                    walk(child)


        walk(data)


        # ----------------------------------------------
        # ORDER MESSAGES BY CREATE TIME
        # ----------------------------------------------

        found.sort(

            key=lambda message:

                message.get(
                    "create_time"
                )

                if isinstance(
                    message.get(
                        "create_time"
                    ),
                    (int, float)
                )

                else 0
        )


        return found


    # --------------------------------------------------
    # OLD MAPPING FORMAT
    # --------------------------------------------------

    def _get_mapping_messages(
        self,
        data,
        mapping
    ):


        current_node = data.get(
            "current_node"
        )


        ordered_nodes = []


        # Follow current conversation branch
        if (
            current_node
            and current_node in mapping
        ):

            node_id = current_node


            while node_id:

                node = mapping.get(
                    node_id
                )


                if not node:
                    break


                message = node.get(
                    "message"
                )


                if message is not None:

                    ordered_nodes.append(
                        message
                    )


                node_id = node.get(
                    "parent"
                )


            ordered_nodes.reverse()


            return ordered_nodes


        # ----------------------------------------------
        # FALLBACK
        # ----------------------------------------------

        roots = []


        for node_id, node in mapping.items():

            if node.get(
                "parent"
            ) is None:

                roots.append(
                    node_id
                )


        visited = set()


        def walk(node_id):

            if node_id in visited:
                return


            visited.add(
                node_id
            )


            node = mapping.get(
                node_id
            )


            if not node:
                return


            message = node.get(
                "message"
            )


            if message is not None:

                ordered_nodes.append(
                    message
                )


            for child_id in node.get(
                "children",
                []
            ):

                walk(
                    child_id
                )


        for root_id in roots:

            walk(
                root_id
            )


        return ordered_nodes


    @staticmethod
    def _escape_html(text):

        return (

            str(text)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )