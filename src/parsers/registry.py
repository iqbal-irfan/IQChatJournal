# <YOUR_PATH_HERE>
# from parsers.chatgptiqbal1931975 import ChatGPTParser as ChatGPT1931975Parser
# from parsers.chatgptiqbalirfanmail import ChatGPTParser as ChatGPTIrfanMailParser
from parsers.chatgpt import ChatGPTParser
from parsers.claude import ClaudeParser
from parsers.gemini import GeminiParser
from parsers.deepseek import DeepSeekParser
from parsers.kimi import KimiParser
from parsers.qwen import QwenParser
from parsers.deepseek_json import DeepSeekJSONParser
from parsers.chatgpt_json import ChatGPTJSONParser
from parsers.gemini_json import GeminiJSONParser
from parsers.kimi_json import KimiJSONParser
from parsers.qwen_json import QwenJSONParser



class ParserRegistry:

    @staticmethod
    def detect(html_file):

        if str(html_file).lower().endswith(".json"):

            import json

            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            platform = str(
                data.get(
                    "platform",
                    ""
                )
            ).lower()

            if platform in (
                "claude",
                "claude_ai"
            ):
                return "claude"

            if platform == "gemini":
                return "gemini_json"

            if platform == "kimi":
                return "kimi_json"

            if platform == "qwen":
                return "qwen_json"

            if platform == "deepseek":
                return "deepseek_json"

            return "chatgpt_json"

        with open(html_file, "r", encoding="utf-8") as f:
            html = f.read().lower()

        # ChatGPT
        if "data-message-author-role" in html:
            return "chatgpt"

        # Qwen
        if "qwen-chat-message" in html:
            return "qwen"

        # Gemini
        if "<model-response" in html or "<user-query" in html:
            return "gemini"

        # Kimi
        if "chat-content-item-assistant" in html:
            return "kimi"

        # DeepSeek
        if "ds-assistant-message-main-content" in html:
            return "deepseek"

        # Claude
        if "data-testid=\"user-message\"" in html or "font-claude-response-body" in html:
            return "claude"

        return None

    @staticmethod
    def get_parser(html_file):

        source = ParserRegistry.detect(html_file)
        print("DETECTED SOURCE:", source)

        print("=" * 60)
        print("Detected:", source)
        print("=" * 60)

        if source == "chatgpt":
            return ChatGPTParser(html_file)

        if source == "chatgpt_json":
            return ChatGPTJSONParser(html_file)

        if source == "gemini_json":
            return GeminiJSONParser(html_file)

        if source == "kimi_json":
            return KimiJSONParser(html_file)

        if source == "qwen_json":
            return QwenJSONParser(html_file)

        if source == "deepseek_json":
            return DeepSeekJSONParser(html_file)

        # if source == "chatgptiqbal1931975":
        #     return ChatGPT1931975Parser(html_file)

        # elif source == "chatgptiqbalirfanmail":
        #     return ChatGPTIrfanMailParser(html_file)

        elif source == "claude":
            return ClaudeParser(html_file)

        elif source == "gemini":
            return GeminiParser(html_file)

        elif source == "deepseek":
            return DeepSeekParser(html_file)

        elif source == "kimi":
            return KimiParser(html_file)

        elif source == "qwen":
            return QwenParser(html_file)

        raise Exception("Unsupported AI export.")
    # @staticmethod
    # def get_parser(html_file):

    #     source = ParserRegistry.detect(html_file)

    #     if source == "chatgpt":
    #         return ChatGPTParser(html_file)

    #     elif source == "claude":
    #         return ClaudeParser(html_file)

    #     elif source == "gemini":
    #         return GeminiParser(html_file)

    #     elif source == "deepseek":
    #         return DeepSeekParser(html_file)

    #     elif source == "kimi":
    #         return KimiParser(html_file)

    #     elif source == "qwen":
    #         return QwenParser(html_file)

    #     raise Exception("Unsupported AI export.")