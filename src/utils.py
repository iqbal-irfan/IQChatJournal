# src\utils.py
import re


def collapse_blank_lines(text: str) -> str:
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove trailing spaces
    text = re.sub(r"[ \t]+\n", "\n", text)

    # Collapse 3+ blank lines into one blank line
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()