# 🎬 YouTube Subtitles & Lyrics (Chrome Side Panel Extension)

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![Platform](https://img.shields.io/badge/Platform-Chrome%20Extension-brightgreen?style=flat-square)](https://chrome.google.com)
[![JavaScript](https://img.shields.io/badge/ES6+-Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Vanilla)-success?style=flat-square)](#architecture)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

A high-performance Chrome Extension (Manifest V3) that turns YouTube closed captions into a synchronized, lyrics-style transcript stream directly inside the **Chrome Side Panel**. Features real-time voice tracking, smart sentence breaking, sub-second sync calibration, and interactive playback seeking.

---

## ✨ Features

- ⚡ **Dual-Engine Subtitle Pipeline**:
  - **Primary**: Android Innertube Client fetch for pre-loading complete video captions instantly upon video load.
  - **Secondary**: Live Network Interceptor hook (`world: "MAIN"`) capturing raw YouTube `/api/timedtext` API payloads.
  - **Fallback**: Real-time DOM `MutationObserver` streaming live captions from YouTube's player if API tracks are restricted.
- 🎙️ **Live Voice Tracking (Lyrics Mode)**:
  - Tracks playback with sub-second precision (50ms sync loop).
  - Highlights active spoken lines with an active glowing indicator and animated equalizer soundwave.
- 🧩 **Smart Sentence Splitting Engine**:
  - Reconstructs fragmented YouTube caption chunks into fluent, natural sentences using strict terminal punctuation detection (`.`, `?`, `!`, `…`), abbreviation handling (`Mr.`, `Dr.`, `U.S.`), and speech pauses.
  - Toggle between **Smart Sentences** and **Raw Segments** anytime with one click.
- ⏱️ **Audio-Sync Calibration (±0.2s)**:
  - Built-in offset tuner to compensate for YouTube auto-caption timing delays or Bluetooth audio lag.
- 🎯 **Interactive Seeking**:
  - Click any subtitle line or timestamp to instantly seek the video to that exact timestamp.
- 📜 **Intelligent Auto-Scroll**:
  - Smoothly keeps the current spoken sentence centered in view.
  - User-intent aware: automatically pauses auto-scroll when you scroll manually to read ahead, and shows a floating *"Jump to Current Voice"* badge to snap back.
- 🔍 **Real-Time Transcript Search**:
  - Instant text filtering and match count badge across long transcripts.
- 💾 **Export & Clipboard Tools**:
  - Copy clean full transcript text.
  - Copy formatted transcript with timestamps.
  - Download as standard `.srt` subtitle file.
- ⏯️ **Built-in Mini Player Bar**:
  - Scrub progress bar, Play/Pause, Skip ±5 seconds, and time counter directly from the side panel.
- 🌓 **Aesthetics & Ergonomics**:
  - Sleek Dark / Light modes matching YouTube's design system.
  - Quick font size adjustment (`A-` / `A+`).

---

## 🏗️ Architecture

The extension is built with **zero external dependencies**, leveraging modern Web APIs and Chrome Extension Manifest V3 standards:

```
┌────────────────────────────────────────────────────────┐
│                      YouTube Tab                       │
│  ┌───────────────────────┐  ┌───────────────────────┐  │
│  │   content-main.js     │  │  content-isolated.js  │  │
│  │  (world: MAIN)        │  │  (world: ISOLATED)    │  │
│  │  - Hooks fetch & XHR  │  │  - HTML5 video bridge │  │
│  │  - Sniffs /timedtext  │  │  - MutationObserver   │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  │
└──────────────┼──────────────────────────┼──────────────┘
               │ window.postMessage       │ chrome.runtime.sendMessage
               ▼                          ▼
┌────────────────────────────────────────────────────────┐
│            Side Panel (sidepanel.js / html)            │
│  - Dual-Engine Subtitle Loader (Innertube + Sniffer)   │
│  - Natural Sentence Assembly Engine                    │
│  - Real-Time Time Synchronization & Offset Tuner       │
│  - Smooth Auto-Scroller with Programmatic Guard        │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
youtube-sub/
├── manifest.json              # Chrome Manifest V3 configuration & permissions
├── background.js              # Service worker handling side panel activation
├── content/
│   ├── content-main.js        # Main world script (sniffs timedtext network calls)
│   └── content-isolated.js    # Isolated world script (video state & seeking bridge)
├── sidepanel/
│   ├── sidepanel.html         # Side panel semantic layout & controls
│   ├── sidepanel.css          # Glassmorphic dark/light UI & equalizer animations
│   └── sidepanel.js           # Subtitle engine, sentence splitter & sync logic
├── icons/                     # Extension branding icons (16px, 48px, 128px)
├── .gitignore                 # Standard clean repository ignore rules
└── README.md                  # Project documentation
```

---

## 🚀 Installation & Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/youtube-sub.git
   ```
2. Open Google Chrome and go to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project directory (`youtube-sub`).
6. Pin the extension to your Chrome toolbar for quick access!

---

## 💡 How to Use

1. Open any video on [YouTube](https://www.youtube.com).
2. Click the extension icon or open the **Side Panel** in Chrome.
3. Subtitles are automatically fetched, organized into clean sentences, and highlighted in real-time as the speaker talks.
4. Use the toolbar to search words, adjust audio offset, toggle smart sentence mode, or export transcripts to `.srt`.

---

## 📄 License

Released under the [MIT License](LICENSE). Free for personal and educational use.
