# src\automation\organizer.py
from pathlib import Path
import shutil

class Organizer:

    def create_folder(self, ai, title, output_root="output"):

        output = (
            Path(output_root)
            / ai
            / title
        )

        output.mkdir(parents=True, exist_ok=True)

        return output

    def copy_html(self, html_file, folder):

        destination = folder / html_file.name

        shutil.copy2(
            html_file,
            destination
        )

        return destination