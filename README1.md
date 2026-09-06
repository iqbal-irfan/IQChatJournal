# IQChatJournal

IQChatJournal is a Windows desktop application and browser-extension-based conversation capture and journaling system.

It captures conversations from supported AI chat platforms, stores the original conversation data, organizes conversations by AI platform and chat title, and converts them into readable TXT, Markdown, and PDF documents.

## Supported AI Platforms

- ChatGPT
- Claude
- Gemini
- DeepSeek
- Kimi
- Qwen

## Main Features

- Conversation capture through a browser extension
- Automatic and manual saving where supported
- Conversation title and conversation-ID handling
- Platform-specific parsers
- Automatic organization by AI platform and chat title
- TXT, Markdown, and PDF export
- Local conversation archival

## Example Output

```text
output/
└── deepseek/
    ├── AI as Human Cognitive Externalization/
    │   ├── AI as Human Cognitive Externalization.md
    │   ├── AI as Human Cognitive Externalization.pdf
    │   ├── AI as Human Cognitive Externalization.txt
    │   └── assets/
    ├── GitHub Repo Analysis/
    │   ├── GitHub Repo Analysis.md
    │   ├── GitHub Repo Analysis.pdf
    │   ├── GitHub Repo Analysis.txt
    │   └── assets/
    └── Android screen capture text extraction feasibility/
        ├── Android screen capture text extraction feasibility.md
        ├── Android screen capture text extraction feasibility.pdf
        ├── Android screen capture text extraction feasibility.txt
        └── assets/
```

## Project Structure

```text
IQChatJournal/
├── browser_extension/
│   ├── manifest.json
│   ├── content.js
│   ├── page_hook.js
│   └── ...
├── src/
│   ├── automation/
│   │   ├── importer.py
│   │   ├── metadata.py
│   │   ├── organizer.py
│   │   ├── title_cleaner.py
│   │   └── watcher.py
│   ├── exporters/
│   │   ├── markdown.py
│   │   ├── pdf.py
│   │   └── txt.py
│   ├── indexer/
│   │   └── index_manager.py
│   ├── parsers/
│   │   ├── base.py
│   │   ├── registry.py
│   │   ├── chatgpt.py
│   │   ├── chatgpt_json.py
│   │   ├── claude.py
│   │   ├── deepseek.py
│   │   ├── gemini.py
│   │   ├── kimi.py
│   │   └── qwen.py
│   ├── constants.py
│   ├── converter.py
│   ├── gui.py
│   ├── launcher.py
│   ├── models.py
│   ├── renderers.py
│   └── utils.py
├── download/
├── output/
├── requirements.txt
└── README.md
```

## Architecture

```text
AI Website
     │
     ▼
Browser Extension
     │
     ▼
Platform-specific Capture
     │
     ▼
Conversation JSON
     │
     ▼
Download/Input Directory
     │
     ▼
Watcher / Importer
     │
     ▼
Metadata Extraction
     │
     ▼
Conversation Identification
     │
     ▼
Parser
     │
     ▼
Organization
     │
     ▼
Converter
     ├──► TXT
     ├──► Markdown
     └──► PDF
```

## Component Overview

### Browser Extension

The browser extension interacts with supported AI websites, detects conversation changes, and captures relevant conversation information.

Platform-specific page hooks handle differences between websites.

### `src/automation`

Contains the automation pipeline.

- `importer.py` — processes captured/downloaded conversations.
- `metadata.py` — extracts conversation metadata.
- `organizer.py` — creates and manages output directories.
- `title_cleaner.py` — normalizes titles.
- `watcher.py` — monitors the configured input/download area.

### `src/parsers`

Contains platform-specific conversation parsers:

```text
chatgpt.py
chatgpt_json.py
claude.py
deepseek.py
gemini.py
kimi.py
qwen.py
registry.py
```

### `src/exporters`

Generates:

```text
Markdown
PDF
TXT
```

### `src/indexer`

Maintains conversation indexing information through `index_manager.py`.

### `converter.py`

Coordinates conversion into TXT, Markdown, and PDF.

## Data Directories

### `download`

Contains original captured/downloaded conversation data.

```text
download/
└── <conversation-id>.json
```

### `output`

Contains organized converted conversations:

```text
output/
├── chatgpt/
├── claude/
├── gemini/
├── deepseek/
├── kimi/
└── qwen/
```

Personal conversation data in these directories should not be committed to GitHub.

## Installation From Source

IQChatJournal is intended for Windows.

### 1. Open a Command Prompt

Change to the IQChatJournal project directory:

```bat
cd /d <YOUR_PATH_HERE>
```

### 2. Create a Python Virtual Environment

Create a virtual environment named `.venv`:

```bat
python -m venv .venv
```

### 3. Activate the Virtual Environment

```bat
.venv\Scripts\activate
```

After activation, the command prompt should show:

```text
(.venv)
```

### 4. Upgrade pip

```bat
python -m pip install --upgrade pip
```

### 5. Install Dependencies

```bat
pip install -r requirements.txt
```

### 6. Verify Python

```bat
python --version
```

### 7. Run IQChatJournal

The current project uses `src\launcher.py` as the intended launcher:

```bat
python src\launcher.py
```

If the launcher requires a different entry point in the current build, use the entry point documented by the current project configuration.

### Deactivate the Virtual Environment

When finished:

```bat
deactivate
```

### Activate the Existing Environment Again

When returning to the project later:

```bat
cd /d <YOUR_PATH_HERE>
python -m venv .venv
.venv\Scripts\activate

then
pip install -r requirements.txt
```

Then run the application:

```bat
python .\src\gui.py
```

## Browser Extension Installation

During development/testing:

1. Open the browser's extension management page.
2. Enable Developer Mode.
3. Select **Load unpacked**.
4. Select the IQChatJournal browser-extension directory.
5. Enable the extension.
6. Open a supported AI website.
7. Verify that IQChatJournal reports that the extension is running.

## Running From Source

The current project contains:

```text
src/launcher.py
src/gui.py
```

The launcher is intended to provide the application entry point.

## Supported Platforms

| Platform | Capture | Import | TXT | Markdown | PDF |
|---|---:|---:|---:|---:|---:|
| ChatGPT | ✓ | ✓ | ✓ | ✓ | ✓ |
| Claude | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gemini | ✓ | ✓ | ✓ | ✓ | ✓ |
| DeepSeek | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kimi | ✓ | ✓ | ✓ | ✓ | ✓ |
| Qwen | ✓ | ✓ | ✓ | ✓ | ✓ |

Support is implemented independently for each platform because AI websites can change their interfaces.

## Conversation Identity

Conversation titles alone are not always sufficient to identify a conversation.

Where a platform provides a stable conversation ID, IQChatJournal uses that identity to distinguish conversations so separate conversations can remain separate even when titles are similar.

## Current Development Status

Current platform capture:

```text
ChatGPT   ✓
Claude    ✓
Gemini    ✓
DeepSeek  ✓
Kimi      ✓
Qwen      ✓
```

Current preparation work:

```text
Working Application
        │
        ▼
Code Cleanup
        │
        ▼
Dead-code Review
        │
        ▼
GitHub Repository
        │
        ▼
Standalone Windows EXE
        │
        ▼
Tester ZIP
```

## Planned Standalone Distribution

The planned test distribution will allow a tester to use IQChatJournal without installing the Python development environment.

```text
IQChatJournal-Test/
├── IQChatJournal.exe
├── browser_extension/
├── README.md
└── installation instructions
```

User conversation data should not be included in the public repository or test distribution.

## GitHub Guidelines

The repository should contain source code and documentation, but not personal conversation archives.

The following should normally be excluded from Git:

```text
download/
output/
runtime indexes
cache files
temporary files
build/
dist/
PyInstaller temporary files
personal test conversations
```

## Privacy

Never commit the following to a public repository:

- Personal conversations
- Authentication information
- Browser session data
- API keys
- Passwords
- Private configuration
- Personal test archives

## Known Considerations

AI websites can change their HTML structure, JavaScript implementation, URLs, and internal behavior. Platform-specific browser capture code may therefore require maintenance when a supported AI service changes its website.

## Development Philosophy

> **Capture once, preserve locally, organize automatically, and keep the conversation readable.**

The application separates:

```text
Capture
   ↓
Storage
   ↓
Identification
   ↓
Parsing
   ↓
Organization
   ↓
Export
```

## License

License information will be finalized before the public GitHub release.

## Project Status

**Pre-release / testing**

The current version is being prepared for:

- Code cleanup
- Dead-code identification
- Dependency verification
- GitHub publication
- Standalone Windows EXE creation
- External tester distribution
