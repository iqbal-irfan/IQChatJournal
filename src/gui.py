# IQChatJournal Control App
# Additive file: does not modify existing watcher/importer/parser structure.

import subprocess
import sys
import webbrowser
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import ttk, messagebox


# -------------------------------------------------
# PROJECT PATH
# -------------------------------------------------

if getattr(sys, "frozen", False):
    # Running as PyInstaller EXE.
    # EXE location:
    # ...\IQChatJournal\dist\IQChatJournal\IQChatJournal.exe
    #
    # Real project:
    # ...\IQChatJournal
    PROJECT_ROOT = Path(sys.executable).resolve().parent.parent.parent

else:
    # Running from source:
    # ...\IQChatJournal\src\gui.py
    PROJECT_ROOT = Path(__file__).resolve().parent.parent


if getattr(sys, "frozen", False):
    WATCHER = (
        PROJECT_ROOT
        / "dist"
        / "IQChatJournalWatcher"
        / "IQChatJournalWatcher.exe"
    )
else:
    WATCHER = PROJECT_ROOT / "src" / "test_watcher.py"

DOWNLOAD_DIR = PROJECT_ROOT / "download"

CHATGPT_OUTPUT_DIR = PROJECT_ROOT / "output" / "chatgpt"


# Brave browser path
BRAVE_PATH = Path(
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
)


SITES = {
    "Claude": "https://claude.ai/",
    "Gemini": "https://gemini.google.com/",
    "DeepSeek": "https://chat.deepseek.com/",
    "Kimi": "https://kimi.moonshot.cn/",
    "Qwen": "https://chat.qwen.ai/",
}


class IQChatJournalApp:

    def __init__(self, root):

        self.root = root
        self.watcher_process = None

        self.root.title("IQChatJournal")

        self.root.geometry("900x650")

        self.root.minsize(800, 600)


        self.status_var = tk.StringVar(
            value="Watcher: STOPPED"
        )

        self.activity_var = tk.StringVar(
            value="Ready. Start the capture service."
        )

        self.latest_capture_var = tk.StringVar(
            value="Latest Capture: Waiting..."
        )

        self.latest_output_var = tk.StringVar(
            value="Latest Output: Waiting..."
        )


        self.build_ui()

        self.update_latest_files()

        self.root.protocol(
            "WM_DELETE_WINDOW",
            self.on_close
        )


    # -------------------------------------------------
    # BUILD UI
    # -------------------------------------------------

    def build_ui(self):

        canvas = tk.Canvas(
            self.root,
            highlightthickness=0
        )

        scrollbar = ttk.Scrollbar(
            self.root,
            orient="vertical",
            command=canvas.yview
        )

        main = ttk.Frame(
            canvas,
            padding=25
        )

        main_window = canvas.create_window(
            (0, 0),
            window=main,
            anchor="nw"
        )

        canvas.configure(
            yscrollcommand=scrollbar.set
        )

        canvas.pack(
            side="left",
            fill="both",
            expand=True
        )

        scrollbar.pack(
            side="right",
            fill="y"
        )

        def update_scroll_region(event=None):

            canvas.configure(
                scrollregion=canvas.bbox("all")
            )

        def resize_content(event):

            canvas.itemconfigure(
                main_window,
                width=event.width
            )

        def mouse_wheel(event):

            canvas.yview_scroll(
                int(-1 * (event.delta / 120)),
                "units"
            )

        main.bind(
            "<Configure>",
            update_scroll_region
        )

        canvas.bind(
            "<Configure>",
            resize_content
        )

        canvas.bind_all(
            "<MouseWheel>",
            mouse_wheel
        )


        # -------------------------------------------------
        # TITLE
        # -------------------------------------------------

        ttk.Label(
            main,
            text="IQChatJournal",
            font=("Segoe UI", 24, "bold")
        ).pack(
            anchor="w"
        )


        ttk.Label(
            main,
            text="AI conversation capture and journal manager",
            font=("Segoe UI", 11)
        ).pack(
            anchor="w",
            pady=(0, 20)
        )


        # -------------------------------------------------
        # CAPTURE SERVICE
        # -------------------------------------------------

        status_frame = ttk.LabelFrame(
            main,
            text="Capture Service",
            padding=15
        )

        status_frame.pack(
            fill="x"
        )


        ttk.Label(
            status_frame,
            textvariable=self.status_var,
            font=("Segoe UI", 12, "bold")
        ).pack(
            anchor="w"
        )


        ttk.Label(
            status_frame,
            textvariable=self.activity_var,
            wraplength=800
        ).pack(
            anchor="w",
            pady=(10, 10)
        )


        ttk.Separator(
            status_frame,
            orient="horizontal"
        ).pack(
            fill="x",
            pady=(0, 10)
        )


        ttk.Label(
            status_frame,
            text="Latest Capture",
            font=("Segoe UI", 10, "bold")
        ).pack(
            anchor="w"
        )


        ttk.Label(
            status_frame,
            textvariable=self.latest_capture_var,
            justify="left",
            wraplength=800
        ).pack(
            anchor="w",
            pady=(2, 10)
        )


        ttk.Label(
            status_frame,
            text="Latest Output",
            font=("Segoe UI", 10, "bold")
        ).pack(
            anchor="w"
        )


        ttk.Label(
            status_frame,
            textvariable=self.latest_output_var,
            justify="left",
            wraplength=800
        ).pack(
            anchor="w",
            pady=(2, 15)
        )


        buttons = ttk.Frame(
            status_frame
        )

        buttons.pack(
            fill="x"
        )


        self.start_button = ttk.Button(
            buttons,
            text="Start Capture",
            command=self.start_watcher,
            width=18
        )

        self.start_button.pack(
            side="left",
            padx=(0, 10)
        )


        self.stop_button = ttk.Button(
            buttons,
            text="Stop Capture",
            command=self.stop_watcher,
            state="disabled",
            width=18
        )

        self.stop_button.pack(
            side="left"
        )


        # -------------------------------------------------
        # OPEN AI CHAT
        # -------------------------------------------------

        sites_frame = ttk.LabelFrame(
            main,
            text="Open AI Chat",
            padding=15
        )

        sites_frame.pack(
            fill="x",
            pady=18
        )


        # -------------------------------------------------
        # CHATGPT
        #
        # Two choices:
        # Brave
        # Default Browser
        # -------------------------------------------------

        ttk.Label(
            sites_frame,
            text="ChatGPT",
            font=("Segoe UI", 11, "bold")
        ).grid(
            row=0,
            column=0,
            padx=8,
            pady=(8, 2),
            sticky="w"
        )


        chatgpt_buttons = ttk.Frame(
            sites_frame
        )

        chatgpt_buttons.grid(
            row=1,
            column=0,
            columnspan=3,
            padx=8,
            pady=(2, 12),
            sticky="w"
        )


        ttk.Button(
            chatgpt_buttons,
            text="Open in Brave",
            command=self.open_chatgpt_brave,
            width=20
        ).pack(
            side="left",
            padx=(0, 10)
        )


        ttk.Button(
            chatgpt_buttons,
            text="Open in Default Browser",
            command=self.open_chatgpt_default,
            width=25
        ).pack(
            side="left"
        )


        # -------------------------------------------------
        # OTHER AI SITES
        # -------------------------------------------------

        site_list = list(SITES.items())


        for index, (name, url) in enumerate(site_list):

            button = ttk.Button(
                sites_frame,
                text=name,
                command=lambda u=url: self.open_site(u),
                width=20
            )

            button.grid(
                row=(index // 3) + 2,
                column=index % 3,
                padx=8,
                pady=8,
                sticky="ew"
            )


        for column in range(3):

            sites_frame.grid_columnconfigure(
                column,
                weight=1
            )


        # -------------------------------------------------
        # FOLDERS
        # -------------------------------------------------

        folders_frame = ttk.LabelFrame(
            main,
            text="Folders",
            padding=15
        )

        folders_frame.pack(
            fill="x"
        )


        ttk.Button(
            folders_frame,
            text="Open Download Folder",
            command=self.open_download,
            width=24
        ).pack(
            side="left",
            padx=(0, 12)
        )


        ttk.Button(
            folders_frame,
            text="Open ChatGPT Output",
            command=self.open_output,
            width=24
        ).pack(
            side="left"
        )


        # -------------------------------------------------
        # PATH INFORMATION
        # -------------------------------------------------

        info_frame = ttk.LabelFrame(
            main,
            text="Paths",
            padding=15
        )

        info_frame.pack(
            fill="both",
            expand=True,
            pady=18
        )


        ttk.Label(
            info_frame,
            text=f"Project:\n{PROJECT_ROOT}",
            justify="left",
            wraplength=820
        ).pack(
            anchor="w",
            pady=(0, 10)
        )


        ttk.Label(
            info_frame,
            text=f"Downloa<YOUR_PATH_HERE>",
            justify="left",
            wraplength=820
        ).pack(
            anchor="w",
            pady=(0, 10)
        )


        ttk.Label(
            info_frame,
            text=f"ChatGPT Output:\n{CHATGPT_OUTPUT_DIR}",
            justify="left",
            wraplength=820
        ).pack(
            anchor="w"
        )


        # -------------------------------------------------
        # EXIT BUTTON
        # -------------------------------------------------

        bottom = ttk.Frame(
            main
        )

        bottom.pack(
            fill="x",
            pady=(5, 0)
        )


        ttk.Button(
            bottom,
            text="Exit",
            command=self.on_close,
            width=18
        ).pack(
            side="right"
        )

        canvas.configure(
            scrollregion=canvas.bbox("all")
        )


    # -------------------------------------------------
    # LATEST FILE INFORMATION
    # -------------------------------------------------

    def update_latest_files(self):

        try:

            json_files = list(
                DOWNLOAD_DIR.glob("*.json")
            )


            if json_files:

                latest_json = max(
                    json_files,
                    key=lambda path: path.stat().st_mtime
                )

                capture_time = datetime.fromtimestamp(
                    latest_json.stat().st_mtime
                ).strftime(
                    "%d-%m-%Y %H:%M:%S"
                )

                self.latest_capture_var.set(
                    f"{latest_json.name}\n"
                    f"Time: {capture_time}"
                )

            else:

                self.latest_capture_var.set(
                    "No captured JSON file found."
                )


            output_files = []

            OUTPUT_DIR = PROJECT_ROOT / "output"

            for pattern in (
                "*.md",
                "*.pdf",
                "*.txt"
            ):

                output_files.extend(
                    OUTPUT_DIR.rglob(pattern)
                )


            if output_files:

                latest_output = max(
                    output_files,
                    key=lambda path: path.stat().st_mtime
                )

                output_time = datetime.fromtimestamp(
                    latest_output.stat().st_mtime
                ).strftime(
                    "%d-%m-%Y %H:%M:%S"
                )

                output_folder = latest_output.parent

                related_files = []

                for extension in (
                    ".md",
                    ".pdf",
                    ".txt"
                ):

                    candidate = (
                        output_folder /
                        (
                            latest_output.stem +
                            extension
                        )
                    )

                    if candidate.exists():

                        related_files.append(
                            candidate.name
                        )


                self.latest_output_var.set(
                    f"{' | '.join(related_files)}\n"
                    f"Time: {output_time}"
                )

            else:

                self.latest_output_var.set(
                    "No output files found."
                )


        except Exception as error:

            self.latest_capture_var.set(
                f"File check error: {error}"
            )


        self.root.after(
            2000,
            self.update_latest_files
        )


    # -------------------------------------------------
    # WATCHER
    # -------------------------------------------------

    def start_watcher(self):

        if (
            self.watcher_process
            and self.watcher_process.poll() is None
        ):

            self.activity_var.set(
                "Watcher is already running."
            )

            return


        if not WATCHER.exists():

            messagebox.showerror(
                "IQChatJournal",
                f"Watcher not foun<YOUR_PATH_HERE>"
            )

            return


        try:

            creationflags = 0


            if sys.platform.startswith("win"):

                creationflags = (
                    subprocess.CREATE_NEW_CONSOLE
                )


            if getattr(sys, "frozen", False):
                watcher_command = [
                    str(WATCHER)
                ]
            else:
                watcher_command = [
                    sys.executable,
                    str(WATCHER)
                ]

            self.watcher_process = subprocess.Popen(
                watcher_command,
                cwd=str(PROJECT_ROOT),
                creationflags=creationflags
            )


            self.status_var.set(
                "Watcher: RUNNING"
            )


            self.activity_var.set(
                "Existing watcher started successfully. "
                "Watching the download folder."
            )


            self.start_button.config(
                state="disabled"
            )


            self.stop_button.config(
                state="normal"
            )


        except Exception as error:

            messagebox.showerror(
                "IQChatJournal",
                f"Could not start watcher:\n{error}"
            )


    def stop_watcher(self):

        if not self.watcher_process:

            return


        if self.watcher_process.poll() is None:

            self.watcher_process.terminate()


            try:

                self.watcher_process.wait(
                    timeout=5
                )

            except subprocess.TimeoutExpired:

                self.watcher_process.kill()


        self.watcher_process = None


        self.status_var.set(
            "Watcher: STOPPED"
        )


        self.activity_var.set(
            "Capture service stopped."
        )


        self.start_button.config(
            state="normal"
        )


        self.stop_button.config(
            state="disabled"
        )


    # -------------------------------------------------
    # CHATGPT
    # -------------------------------------------------

    def open_chatgpt_brave(self):

        url = "https://chatgpt.com/"


        if not BRAVE_PATH.exists():

            messagebox.showerror(
                "IQChatJournal",
                f"Brave browser not foun<YOUR_PATH_HERE>"
            )

            return


        try:

            subprocess.Popen(
                [
                    str(BRAVE_PATH),
                    url
                ]
            )


            self.activity_var.set(
                "Opened ChatGPT in Brave."
            )


        except Exception as error:

            messagebox.showerror(
                "IQChatJournal",
                f"Could not open Brave:\n{error}"
            )


    def open_chatgpt_default(self):

        url = "https://chatgpt.com/"


        webbrowser.open(url)


        self.activity_var.set(
            "Opened ChatGPT in default browser."
        )


    # -------------------------------------------------
    # OTHER AI SITES
    # -------------------------------------------------

    def open_site(self, url):

        webbrowser.open(url)


        self.activity_var.set(
            f"Opened: {url}"
        )


    # -------------------------------------------------
    # FOLDERS
    # -------------------------------------------------

    def open_download(self):

        DOWNLOAD_DIR.mkdir(
            parents=True,
            exist_ok=True
        )


        if sys.platform.startswith("win"):

            subprocess.Popen(
                [
                    "explorer",
                    str(DOWNLOAD_DIR)
                ]
            )

        else:

            webbrowser.open(
                DOWNLOAD_DIR.as_uri()
            )


    def open_output(self):

        CHATGPT_OUTPUT_DIR.mkdir(
            parents=True,
            exist_ok=True
        )


        if sys.platform.startswith("win"):

            subprocess.Popen(
                [
                    "explorer",
                    str(CHATGPT_OUTPUT_DIR)
                ]
            )

        else:

            webbrowser.open(
                CHATGPT_OUTPUT_DIR.as_uri()
            )


    # -------------------------------------------------
    # EXIT
    # -------------------------------------------------

    def on_close(self):

        if (

            self.watcher_process

            and

            self.watcher_process.poll() is None

        ):

            answer = messagebox.askyesno(

                "IQChatJournal",

                "The watcher is running.\n\n"
                "Stop it and exit IQChatJournal?"

            )


            if not answer:

                return


            self.stop_watcher()


        self.root.destroy()


# -------------------------------------------------
# MAIN
# -------------------------------------------------

def main():

    root = tk.Tk()

    IQChatJournalApp(root)

    root.mainloop()


if __name__ == "__main__":

    main()