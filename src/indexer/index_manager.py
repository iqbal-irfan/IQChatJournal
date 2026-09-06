# src\indexer\index_manager.py
import json
from pathlib import Path
from datetime import datetime


class IndexManager:

    def __init__(self):

        self.index_file = (
            Path(__file__).resolve().parents[2]
            / "output"
            / "index.json"
        )

    def load_index(self):

        if not self.index_file.exists():
            return []

        with open(
            self.index_file,
            "r",
            encoding="utf-8"
        ) as f:

            return json.load(f)

    def save_index(self, index):

        with open(
            self.index_file,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                index,
                f,
                indent=4,
                ensure_ascii=False
            )

    def next_id(self):

        index = self.load_index()

        number = len(index) + 1

        return f"CHAT{number:06d}"

    def find_by_ai_title(self, ai, title):

        index = self.load_index()

        for record in index:

            if (
                record["ai"] == ai
                and record["title"] == title
            ):
                return record

        return None

    def add_conversation(self, record):

        index = self.load_index()

        now = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        record["id"] = self.next_id()
        record["created"] = now
        record["updated"] = now
        record["status"] = "active"
        record["tags"] = []

        index.append(record)

        self.save_index(index)

    def update_conversation(self, conversation_id):

        index = self.load_index()

        now = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        for record in index:

            if record["id"] == conversation_id:

                record["updated"] = now

                break

        self.save_index(index)