# src\automation\importer.py
from pathlib import Path
import shutil
import os
from parsers.registry import ParserRegistry
from automation.metadata import MetadataExtractor
from automation.organizer import Organizer
from converter import convert
from indexer.index_manager import IndexManager

PROJECT_DIR = Path(__file__).resolve().parents[2]


class Importer:

    def __init__(self):

        self.metadata = MetadataExtractor()
        self.organizer = Organizer()
        self.index = IndexManager()

    def import_file(self, input_file, output_root="output"):

        input_file = Path(input_file)

        print("=" * 60)
        print("IMPORTER")
        print("=" * 60)

        source = ParserRegistry.detect(input_file)

        index_source = (
            "chatgpt"
            if source == "chatgpt_json"
            else "gemini"
            if source == "gemini_json"
            else "kimi"
            if source == "kimi_json"
            else "qwen"
            if source == "qwen_json"
            else "deepseek"
            if source == "deepseek_json"
            else source
        )

        meta = self.metadata.extract(
            input_file,
            source
        )

        deepseek_conversation_id = None

        if source == "deepseek_json":

            import json

            with open(
                input_file,
                "r",
                encoding="utf-8"
            ) as f:
                deepseek_data = json.load(f)

            deepseek_conversation_id = (
                deepseek_data.get(
                    "conversation_id"
                )
                or None
            )

        print("File  :", input_file.name)
        print("AI    :", source)
        print("Title :", meta["title"])

        existing = None

        if source == "deepseek_json":

            index = self.index.load_index()

            for record in index:

                if (
                    record.get("ai") == "deepseek"
                    and record.get(
                        "conversation_id"
                    ) == deepseek_conversation_id
                ):

                    existing = record
                    break

        else:

            existing = self.index.find_by_ai_title(
                index_source,
                meta["title"]
            )

        if existing:

            print("Conversation exists.")
            print("ID    :", existing["id"])

            folder = PROJECT_DIR / existing["folder"]


            # --------------------------------
            # MIGRATE OLD GEMINI OUTPUT FOLDER
            # --------------------------------

            if (
                source == "gemini_json"
                and "output\\gemini_json\\" in str(folder)
            ):

                new_folder = Path(
                    str(folder).replace(
                        "output\\gemini_json\\",
                        "output\\gemini\\",
                        1
                    )
                )


                if (
                    folder.exists()
                    and not new_folder.exists()
                ):

                    new_folder.parent.mkdir(
                        parents=True,
                        exist_ok=True
                    )

                    shutil.move(
                        str(folder),
                        str(new_folder)
                    )

                    folder = new_folder

                    existing["folder"] = str(
                        folder.relative_to(
                            PROJECT_DIR
                        )
                    )

                    index = self.index.load_index()

                    for record in index:

                        if (
                            record["id"]
                            == existing["id"]
                        ):

                            record["folder"] = (
                                existing["folder"]
                            )

                            break

                    self.index.save_index(
                        index
                    )

                    print(
                        "Migrated Gemini folder:",
                        folder
                    )

                elif new_folder.exists():

                    print(
                        "Gemini migration skipped - "
                        "destination already exists:",
                        new_folder
                    )


            self.index.update_conversation(
                existing["id"]
            )

        else:

            print("New conversation.")

            folder_source = (
                "chatgpt"
                if source == "chatgpt_json"
                else "gemini"
                if source == "gemini_json"
                else "kimi"
                if source == "kimi_json"
                else "qwen"
                if source == "qwen_json"
                else "deepseek"
                if source == "deepseek_json"
                else source
            )

            folder = self.organizer.create_folder(
                folder_source,
                meta["title"],
                output_root
            )

            self.index.add_conversation(
                {
                    "ai": index_source,
                    "title": meta["title"],
                    "folder": str(folder),
                }
            )

        print("Folder:", folder)

        if source in (
            "chatgpt_json",
            "gemini_json",
            "kimi_json",
            "qwen_json",
            "deepseek_json"
        ):

            copied = input_file

        else:

            copied = self.organizer.copy_html(
                input_file,
                folder
            )

        print("Source:", copied)

        convert(
            copied,
            folder,
            txt=True,
            md=True,
            pdf=True,
            output_name=meta["title"],
            source_name=os.path.basename(input_file),
        )

        # JSON is the input/archive file, not an output document.
        # Remove it if it was copied into the conversation output folder.
        if copied != input_file and Path(copied).suffix.lower() == ".json":
            try:
                Path(copied).unlink()
                print("Removed JSON from output:", copied)
            except FileNotFoundError:
                pass
            except PermissionError:
                print("Could not remove JSON from output:", copied)

        print("Converted.")