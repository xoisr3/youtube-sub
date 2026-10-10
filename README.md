# YouTube English Subtitles (Chrome Extension)

A Chrome extension that displays English subtitles for YouTube videos directly in the Chrome Side Panel, featuring real-time spoken voice highlighting, interactive seeking, and transcript export.

---

## Features

- 📑 **English Subtitles Only**: Automatically detects and loads available English subtitle tracks (both creator-uploaded and auto-generated English subtitles).
- 🎙️ **Live Voice Highlighting**: Identifies the exact spoken sentence in real-time as the video plays, illuminating it with a distinctive YouTube red indicator and animated equalizer soundwave.
- ⚡ **Interactive Seeking**: Click on any subtitle line or timestamp to immediately jump the YouTube video to that exact second.
- 📜 **Smart Auto-scroll**: Smoothly keeps the active spoken line in view. If you scroll away to read ahead, a convenient floating *"Jump to Current Voice"* button lets you snap right back.
- 🔍 **Real-Time Search**: Search words or phrases across the entire transcript with instant matching highlights and count indicators.
- 💾 **Export & Copy**:
  - Copy clean full transcript.
  - Copy transcript with timestamps.
  - Export and download as standard `.srt` subtitle file.
- ⏯️ **Integrated Playback Controls**: Play, pause, skip backward/forward 5 seconds, and scrub video progress directly from the side panel.
- 🌓 **Themes & Typography**: Built-in YouTube Dark and Light themes with dynamic font size scaling (A- / A+).
- 🛡️ **Zero-Interference Architecture**: Operates without modifying or interfering with YouTube's on-screen video player or internal caption rendering.

---

## Installation & Setup

1. Open Google Chrome.
2. Navigate to `chrome://extensions/` in the URL bar.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the extension directory:
   ```
   /Users/thinh/Documents/code/youtube-sub
   ```
6. The extension is now installed. Pin it to your Chrome toolbar for quick access.

---

## How to Use

1. Open any YouTube video (e.g. `https://www.youtube.com/watch?v=...`).
2. Click the extension icon in Chrome or open the Chrome Side Panel.
3. The extension connects to the YouTube video, loads the English subtitles, and starts tracking the playback in real-time.
4. If multiple English tracks exist (e.g., creator subtitles vs. auto-generated), you can switch between them using the dropdown track selector.
5. Click any subtitle line to jump to that moment in the video.

---

## Project Structure

```
youtube-sub/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Service worker handling side panel activation and tab events
├── content/
│   └── content-isolated.js    # Isolated content script (observes playback time & handles seeking)
├── sidepanel/
│   ├── sidepanel.html         # Side panel markup
│   ├── sidepanel.css          # Modern dark/light styling and voice highlight animations
│   └── sidepanel.js           # Subtitle loading, synchronization, search, and controls
├── icons/                     # Extension icons (16px, 48px, 128px)
├── generate-icons.js          # Generator script for icon assets
└── README.md
```
