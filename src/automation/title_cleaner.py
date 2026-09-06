# src\automation\title_cleaner.py
import re


class TitleCleaner:

    INVALID = r'[<>:"/\\|?*]'

    @staticmethod
    def clean(title, max_length=80):

        title = " ".join(title.split())

        title = re.sub(TitleCleaner.INVALID, "", title)

        title = title.strip(" .")

        if len(title) > max_length:
            title = title[:max_length].rstrip()

        if not title:
            title = "Untitled"

        return title