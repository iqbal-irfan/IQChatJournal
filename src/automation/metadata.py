# src\automation\metadata.py
from pathlib import Path
import json

from bs4 import BeautifulSoup
from automation.title_cleaner import TitleCleaner


class MetadataExtractor:

    def _clean(self, text):

        text = " ".join(text.split())

        text = text.replace(" Locations:", "")

        return text.strip()

    def extract(self, html_file, ai):

        html_file = Path(html_file)

        with open(html_file, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")
        
        title = ""

        if ai == "chatgpt_json":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "title",
                ""
            )

        elif ai == "gemini_json":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "title",
                ""
            )


        elif ai == "kimi_json":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "title",
                ""
            )

        elif ai == "qwen_json":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "title",
                ""
            )


        elif ai == "deepseek_json":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "title",
                ""
            )


        elif ai == "chatgpt":
            if soup.title:
                title = soup.title.get_text(strip=True)
            else:
                title = self._chatgpt_title(soup)

        elif ai == "claude":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "name",
                ""
            )

        elif ai == "gemini":
            title = self._gemini_title(soup)

        elif ai == "qwen":
            with open(
                html_file,
                "r",
                encoding="utf-8"
            ) as f:
                data = json.load(f)

            title = data.get(
                "title",
                ""
            )

        elif ai == "deepseek":
            title = self._deepseek_title(soup)

        elif ai == "kimi":
            title = self._kimi_title(soup)

        else:
            if soup.title:
                title = soup.title.get_text(strip=True)

        title = TitleCleaner.clean(title)

        return {
            "title": title
        }

    def _gemini_title(self, soup):

        msg = soup.select_one(".query-text-line")

        if msg:
            return self._clean(msg.get_text())

        if soup.title:
            return self._clean(soup.title.get_text())

        return "Untitled"

    def _chatgpt_title(self, soup):

        msg = soup.select_one(
            '[data-message-author-role="user"] .whitespace-pre-wrap'
        )

        if msg:
            return self._clean(msg.get_text())

        if soup.title:
            return soup.title.get_text(strip=True)

        return "Untitled"

    def _claude_title(self, soup):

        msg = soup.select_one(
            '[data-testid="user-message"] .whitespace-pre-wrap'
        )

        if msg:
            return self._clean(msg.get_text())

        if soup.title:
            return self._clean(soup.title.get_text())

        return "Untitled"

    def _qwen_title(self, soup):

        msg = soup.select_one(".user-message-content")

        if msg:
            return self._clean(msg.get_text())

        if soup.title:
            return soup.title.get_text(strip=True)

        return "Untitled"

    def _deepseek_title(self, soup):

        msg = soup.select_one(".fbb737a4")

        if msg:
            return self._clean(msg.get_text())

        if soup.title:
            return soup.title.get_text(strip=True)

        return "Untitled"

    def _kimi_title(self, soup):

        msg = soup.select_one(".segment-user .user-content")

        if msg:
            return self._clean(msg.get_text())

        if soup.title:
            return soup.title.get_text(strip=True)

        return "Untitled"