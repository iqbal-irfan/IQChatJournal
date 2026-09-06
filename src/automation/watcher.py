from pathlib import Path
import time

from automation.importer import Importer


class FolderWatcher:

    STABLE_SECONDS = 5
    RETRY_SECONDS = 60

    def __init__(self, folder):

        self.folder = Path(folder)
        self.importer = Importer()

        # file -> state
        self.files = {}

    def run(self):

        print("=" * 60)
        print("Watching:", self.folder)
        print("=" * 60)

        while True:

            current_files = set()

            # Search for HTML and ChatGPT JSON files
            for file in self.folder.glob("*"):

                if file.suffix.lower() not in (
                    ".html",
                    ".htm",
                    ".json",
                ):
                    continue

                if not file.is_file():
                    continue

                current_files.add(file)

                try:
                    stat = file.stat()
                    modified = stat.st_mtime
                    size = stat.st_size

                except FileNotFoundError:
                    continue

                now = time.time()

                # --------------------------------------------------
                # FIRST TIME SEEN
                # --------------------------------------------------

                if file not in self.files:

                    self.files[file] = {
                        "modified": modified,
                        "size": size,
                        "stable_since": now,
                        "imported": False,
                        "last_attempt": 0,
                    }

                    # print(
                    #     f"NEW [{file.parent.name}] : {file.name}"
                    # )

                    continue

                state = self.files[file]

                # --------------------------------------------------
                # FILE IS STILL CHANGING
                # --------------------------------------------------

                if (
                    state["modified"] != modified
                    or state["size"] != size
                ):

                    state["modified"] = modified
                    state["size"] = size
                    state["stable_since"] = now
                    state["imported"] = False
                    state["last_attempt"] = 0

                    # print(
                    #     f"CHANGED [{file.parent.name}] : {file.name}"
                    # )

                    continue

                # --------------------------------------------------
                # WAIT UNTIL FILE IS STABLE
                # --------------------------------------------------

                stable_for = (
                    now - state["stable_since"]
                )

                if (
                    not state["imported"]
                    and stable_for >= self.STABLE_SECONDS
                    and (
                        now - state["last_attempt"]
                        >= self.RETRY_SECONDS
                    )
                ):
                    state["last_attempt"] = now
                    # print(
                    #     f"STABLE [{file.parent.name}] : {file.name}"
                    # )

                    try:

                        self.importer.import_file(file)

                        state["imported"] = True

                        print(
                            f"IMPORTED [{file.parent.name}] : {file.name}"
                        )

                    except Exception as e:

                        print(
                            f"IMPORT ERROR [{file.name}] : {e}"
                        )

                        # Allow another attempt on the next
                        # detected change instead of killing watcher.
                        state["imported"] = False

            # --------------------------------------------------
            # REMOVE FILES THAT NO LONGER EXIST
            # --------------------------------------------------

            for file in list(self.files):

                if file not in current_files:

                    del self.files[file]

            time.sleep(2)