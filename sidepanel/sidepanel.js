// YouTube Subtitles - Side Panel Logic

(function () {
  // Application State
  let currentTabId = null;
  let currentVideoId = null;
  let availableTracks = [];
  let selectedTrackUrl = null;
  let subtitleLines = []; // Active formatted subtitles
  let rawSubtitleLines = []; // Raw un-merged subtitle chunks
  let isSmartSentences = true; // Natural sentence merging (periods, commas, audio pauses)
  let activeLineId = null;
  let isAutoScroll = true;
  let userHasScrolled = false;
  let isPlaying = false;
  let currentVideoTime = 0;
  let totalVideoDuration = 0;
  let currentFontSize = 14;
  let currentSearchQuery = '';

  // DOM Elements
  const elConnectionStatus = document.getElementById('connection-status');
  const elStatusText = document.getElementById('status-text');
  const elVideoInfoBanner = document.getElementById('video-info-banner');
  const elVideoTitle = document.getElementById('video-title');
  const elVideoChannel = document.getElementById('video-channel');
  const elToolbar = document.getElementById('toolbar');
  const elTrackSelect = document.getElementById('track-select');
  const elSearchInput = document.getElementById('search-input');
  const elBtnClearSearch = document.getElementById('btn-clear-search');
  const elSearchResultsInfo = document.getElementById('search-results-info');
  const elSearchMatchCount = document.getElementById('search-match-count');
  const elBtnAutoScroll = document.getElementById('btn-autoscroll');
  const elBtnSmartSentence = document.getElementById('btn-smart-sentence');
  const elBtnMoreOptions = document.getElementById('btn-more-options');
  const elExportMenu = document.getElementById('export-menu');
  const elBtnCopyAll = document.getElementById('btn-copy-all');
  const elBtnCopyWithTime = document.getElementById('btn-copy-with-time');
  const elBtnDownloadSrt = document.getElementById('btn-download-srt');
  const elBtnFontDec = document.getElementById('btn-font-dec');
  const elBtnFontInc = document.getElementById('btn-font-inc');
  const elBtnThemeToggle = document.getElementById('btn-theme-toggle');
  const elBtnRefresh = document.getElementById('btn-refresh');

  const elLoadingState = document.getElementById('loading-state');
  const elEmptyNotYouTube = document.getElementById('empty-not-youtube');
  const elEmptyNoSubtitles = document.getElementById('empty-no-subtitles');
  const elSubtitlesList = document.getElementById('subtitles-list');
  const elBtnJumpCurrent = document.getElementById('btn-jump-current');

  const elPlayerBar = document.getElementById('player-bar');
  const elProgressBarFill = document.getElementById('progress-bar-fill');
  const elProgressBarBg = document.getElementById('progress-bar-bg');
  const elBtnPlayPause = document.getElementById('btn-play-pause');
  const elIconPlay = document.getElementById('icon-play');
  const elIconPause = document.getElementById('icon-pause');
  const elBtnSkipBack = document.getElementById('btn-skip-back');
  const elBtnSkipForward = document.getElementById('btn-skip-forward');
  const elBtnSyncDec = document.getElementById('btn-sync-dec');
  const elBtnSyncInc = document.getElementById('btn-sync-inc');
  const elBtnSyncReset = document.getElementById('btn-sync-reset');
  const elSyncOffsetLabel = document.getElementById('sync-offset-label');
  const elTimeCurrent = document.getElementById('time-current');
  const elTimeTotal = document.getElementById('time-total');
  const elToast = document.getElementById('toast');

  let subtitleSyncOffset = 0; // Fine-tune sync offset in seconds

  function setSyncOffset(val) {
    subtitleSyncOffset = Math.round(val * 10) / 10;
    if (elSyncOffsetLabel) {
      elSyncOffsetLabel.textContent = `${subtitleSyncOffset > 0 ? '+' : ''}${subtitleSyncOffset.toFixed(1)}s`;
    }
    chrome.storage.local.set({ subtitleSyncOffset });
    highlightActiveSubtitle(currentVideoTime, true);
  }

  // Format seconds to mm:ss or hh:mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const padSecs = secs < 10 ? '0' + secs : secs;

    if (hrs > 0) {
      const padMins = mins < 10 ? '0' + mins : mins;
      return `${hrs}:${padMins}:${padSecs}`;
    }
    return `${mins}:${padSecs}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message) {
    if (!elToast) return;
    elToast.textContent = message;
    elToast.style.display = 'block';
    setTimeout(() => {
      elToast.style.display = 'none';
    }, 2000);
  }

  function setConnectionStatus(connected, text) {
    elConnectionStatus.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
    elStatusText.textContent = text;
  }

  function showView(viewName) {
    elLoadingState.style.display = 'none';
    elEmptyNotYouTube.style.display = 'none';
    elEmptyNoSubtitles.style.display = 'none';
    elSubtitlesList.style.display = 'none';
    elToolbar.style.display = 'none';
    elVideoInfoBanner.style.display = 'none';
    elPlayerBar.style.display = 'none';

    switch (viewName) {
      case 'loading':
        elLoadingState.style.display = 'flex';
        break;
      case 'not-youtube':
        elEmptyNotYouTube.style.display = 'flex';
        break;
      case 'no-subtitles':
        elEmptyNoSubtitles.style.display = 'flex';
        elVideoInfoBanner.style.display = 'block';
        elPlayerBar.style.display = 'flex';
        break;
      case 'subtitles':
        elSubtitlesList.style.display = 'block';
        elToolbar.style.display = 'flex';
        elVideoInfoBanner.style.display = 'block';
        elPlayerBar.style.display = 'flex';
        break;
    }
  }

  function getVideoIdFromUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.split('/shorts/')[1].split('/')[0].split('?')[0];
      }
      return u.searchParams.get('v') || '';
    } catch (e) {
      return '';
    }
  }

  async function getYouTubeTab() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url && activeTab.url.includes('youtube.com')) {
        return activeTab;
      }

      const allActive = await chrome.tabs.query({ active: true });
      const ytActive = allActive.find((t) => t.url && t.url.includes('youtube.com'));
      if (ytActive) return ytActive;

      const windowTabs = await chrome.tabs.query({ currentWindow: true });
      const ytWindow = windowTabs.find((t) => t.url && t.url.includes('youtube.com'));
      if (ytWindow) return ytWindow;

      return activeTab || null;
    } catch (e) {
      return null;
    }
  }

  function decodeEntities(text) {
    if (!text) return '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // List of abbreviations that end with a period but do NOT end a sentence
  const ABBREVIATIONS = new Set([
    'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'u.s.', 'u.k.', 'gen.', 'rep.', 'sen.', 'st.'
  ]);

  // Trailing words that strongly indicate an incomplete thought / mid-phrase
  const INCOMPLETE_TRAILING_WORDS = new Set([
    'the', 'a', 'an', 'i', 'he', 'she', 'we', 'they', 'you', 'it',
    'to', 'in', 'on', 'at', 'of', 'for', 'with', 'by', 'from', 'into', 'onto', 'about', 'between', 'through',
    'and', 'or', 'but', 'so', 'because', 'although', 'though', 'while', 'if', 'when', 'where', 'that', 'which', 'who', 'whom', 'whose', 'as', 'than',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had',
    'do', 'does', 'did',
    'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
    'my', 'your', 'his', 'her', 'their', 'our', 'its',
    'this', 'that', 'these', 'those',
    'more', 'most', 'very', 'too', 'also'
  ]);

  // Splits a single raw chunk at internal sentence boundaries if YouTube packaged
  // multiple sentences or sentence-end + next-sentence-start within the same caption card!
  function splitChunkIntoSentences(chunk) {
    const text = (chunk.text || '').trim();
    if (!text) return [];

    const regex = /([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+)?([.?!…]["'\u201d\u2019]?)\s+([A-Z"'\u201c\u20180-9\(\[])/gu;
    const splits = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const word = (match[1] || '').toLowerCase() + match[2];
      if (ABBREVIATIONS.has(word)) continue;

      const punctuationEnd = match.index + (match[1] ? match[1].length : 0) + match[2].length;
      splits.push({
        partText: text.slice(lastIndex, punctuationEnd).trim(),
        startChar: lastIndex,
        endChar: punctuationEnd
      });
      lastIndex = match.index + match[0].length - match[3].length;
    }

    if (lastIndex < text.length) {
      splits.push({
        partText: text.slice(lastIndex).trim(),
        startChar: lastIndex,
        endChar: text.length
      });
    }

    if (splits.length <= 1) return [chunk];

    const totalChars = text.length;
    const chunkDur = Math.max(0.2, chunk.end - chunk.start);

    return splits.map((s) => {
      const sRatio = s.startChar / totalChars;
      const eRatio = s.endChar / totalChars;
      const partStart = chunk.start + chunkDur * sRatio;
      const partEnd = chunk.start + chunkDur * eRatio;
      return {
        start: Math.round(partStart * 100) / 100,
        end: Math.round(partEnd * 100) / 100,
        duration: Math.max(0.1, partEnd - partStart),
        text: s.partText
      };
    });
  }

  function isSentenceEnd(text) {
    if (!text) return false;
    const trimmed = text.trim();
    // Check for terminal punctuation: . ? ! … 。 ？ ！
    const match = trimmed.match(/([a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]+)?([.?!…\u3002\uFF1F\uFF01]["'\u201d\u2019\)]*)$/u);
    if (!match) return false;
    const wordWithPeriod = (match[1] || '').toLowerCase() + (match[2] || '');
    if (ABBREVIATIONS.has(wordWithPeriod)) return false;
    return true;
  }

  function formatSentenceCasing(text) {
    if (!text) return '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  // Merge raw subtitle chunks into complete natural sentences.
  // STRICT RULE: ONLY break when a sentence ends (. ? ! …)
  function mergeIntoNaturalSentences(rawLines) {
    if (!Array.isArray(rawLines) || rawLines.length === 0) return [];

    // Step 1: Pre-split any raw chunks that contain internal sentence terminators (. ? ! …)
    const preSplitLines = [];
    rawLines.forEach((line) => {
      const splits = splitChunkIntoSentences(line);
      splits.forEach((s) => preSplitLines.push(s));
    });

    const lines = preSplitLines
      .filter((l) => l && typeof l.start === 'number' && l.text && l.text.trim())
      .map((l) => ({ ...l, text: l.text.trim() }))
      .sort((a, b) => a.start - b.start);

    if (lines.length <= 1) {
      return lines.map((l, idx) => ({ ...l, id: idx, text: formatSentenceCasing(l.text) }));
    }

    // Check if subtitle track contains any sentence punctuation (. ? ! …)
    const hasAnySentencePunct = lines.some((l) => isSentenceEnd(l.text));

    const merged = [];
    let current = {
      id: 0,
      start: lines[0].start,
      end: lines[0].end,
      duration: lines[0].duration,
      text: lines[0].text
    };

    for (let i = 1; i < lines.length; i++) {
      const next = lines[i];
      const curText = current.text.trim();
      const silenceGap = Math.max(0, next.start - current.end);

      let shouldBreak = false;

      if (hasAnySentencePunct) {
        // STRICT RULE: ONLY break when sentence ends with . ? ! …
        if (isSentenceEnd(curText)) {
          shouldBreak = true;
        }
      } else {
        // Fallback ONLY for legacy videos with zero punctuation in the entire video:
        // Break on long pauses >= 1.2s
        if (silenceGap >= 1.2) {
          shouldBreak = true;
        }
      }

      if (shouldBreak) {
        merged.push({
          id: merged.length,
          start: current.start,
          end: Math.max(current.start + 0.5, next.start),
          duration: Math.max(0.5, next.start - current.start),
          text: formatSentenceCasing(curText)
        });
        current = {
          id: merged.length,
          start: next.start,
          end: next.end,
          duration: next.duration,
          text: next.text
        };
      } else {
        current.end = Math.max(current.end, next.end);
        current.duration = current.end - current.start;
        current.text = `${curText} ${next.text}`.replace(/\s+/g, ' ');
      }
    }

    if (current && current.text.trim()) {
      merged.push({
        id: merged.length,
        start: current.start,
        end: current.end,
        duration: Math.max(0.5, current.end - current.start),
        text: formatSentenceCasing(current.text)
      });
    }

    return merged;
  }

  // Normalize and clean up subtitle intervals.
  // Fixes YouTube's overlapping caption windows where Line A overlaps Line B,
  // which previously caused highlighting to delay until Line A finished instead of when Line B starts!
  function normalizeIntervals(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return [];

    const validLines = lines.filter((l) => l && typeof l.start === 'number' && l.text);
    validLines.sort((a, b) => a.start - b.start);

    for (let i = 0; i < validLines.length; i++) {
      validLines[i].id = i;
      if (i < validLines.length - 1) {
        const cur = validLines[i];
        const next = validLines[i + 1];
        if (cur.end > next.start) {
          cur.end = Math.max(cur.start + 0.2, next.start);
          cur.duration = cur.end - cur.start;
        }
      }
    }
    return validLines;
  }

  // Process raw subtitle list through smart sentence builder and interval normalizer
  function processSubtitleLines(rawList) {
    if (!Array.isArray(rawList) || rawList.length === 0) return [];
    rawSubtitleLines = rawList.map((l, idx) => ({ ...l, id: idx }));
    if (isSmartSentences) {
      return normalizeIntervals(mergeIntoNaturalSentences(rawSubtitleLines));
    } else {
      return normalizeIntervals(rawSubtitleLines);
    }
  }

  // Parse any subtitle format (JSON3, Innertube, WebVTT, XML format 1 & format 2)
  function parseAnySubtitleFormat(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html') || trimmed.includes('<title>Sorry')) {
      return [];
    }
    const lines = [];

    // 0. Innertube get_transcript JSON response
    if (trimmed.startsWith('{') && (trimmed.includes('transcriptRenderer') || trimmed.includes('transcriptSegmentRenderer'))) {
      try {
        const data = JSON.parse(trimmed);
        const actions = data.actions || [];
        const updateAction = actions.find((a) => a.updateEngagementPanelAction);
        const panel = updateAction?.updateEngagementPanelAction?.content?.transcriptRenderer;
        const initialSegments = panel?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments;
        if (Array.isArray(initialSegments) && initialSegments.length > 0) {
          initialSegments.forEach((seg) => {
            const r = seg.transcriptSegmentRenderer;
            if (!r) return;
            const text = (r.snippet?.runs || []).map((x) => x.text || '').join('').trim();
            if (text) {
              const start = (parseFloat(r.startMs) || 0) / 1000;
              const end = (parseFloat(r.endMs) || (start + 2000)) / 1000;
              lines.push({
                id: lines.length,
                start,
                end,
                duration: Math.max(0.5, end - start),
                text: decodeEntities(text)
              });
            }
          });
          if (lines.length > 0) return processSubtitleLines(lines);
        }
      } catch (e) {}
    }

    // 1. JSON3 format
    if (trimmed.startsWith('{')) {
      try {
        const data = JSON.parse(trimmed);
        if (Array.isArray(data.events)) {
          data.events.forEach((ev) => {
            if (!ev.segs || typeof ev.tStartMs !== 'number') return;
            const text = ev.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
            if (text) {
              const start = ev.tStartMs / 1000;
              const duration = (ev.dDurationMs || 1500) / 1000;
              lines.push({
                id: lines.length,
                start,
                end: start + duration,
                duration,
                text: decodeEntities(text)
              });
            }
          });
          if (lines.length > 0) return processSubtitleLines(lines);
        }
      } catch (e) {}
    }

    // 2. WebVTT format
    if (trimmed.startsWith('WEBVTT') || trimmed.includes('-->')) {
      const blocks = trimmed.replace(/\r\n/g, '\n').split(/\n\n+/);
      for (const b of blocks) {
        const bLines = b.trim().split('\n');
        const timeIdx = bLines.findIndex((l) => l.includes('-->'));
        if (timeIdx === -1) continue;
        const [startStr, endStr] = bLines[timeIdx].split('-->');
        const parseT = (s) => {
          const p = s.trim().split(' ')[0].split(':');
          if (p.length === 3) return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2].replace(',', '.'));
          if (p.length === 2) return parseFloat(p[0]) * 60 + parseFloat(p[1].replace(',', '.'));
          return 0;
        };
        const start = parseT(startStr);
        const end = parseT(endStr);
        const text = bLines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
        if (text) {
          lines.push({
            id: lines.length,
            start,
            end,
            duration: Math.max(0.5, end - start),
            text: decodeEntities(text)
          });
        }
      }
      if (lines.length > 0) return processSubtitleLines(lines);
    }

    // 3. XML format 1: <text start="1.5" dur="2.0">...</text>
    const textTagRegex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/gi;
    let m;
    while ((m = textTagRegex.exec(trimmed)) !== null) {
      const start = parseFloat(m[1]) || 0;
      const duration = parseFloat(m[2]) || 1.5;
      const text = decodeEntities(m[3].replace(/<[^>]+>/g, ''));
      if (text) {
        lines.push({
          id: lines.length,
          start,
          end: start + duration,
          duration,
          text
        });
      }
    }
    if (lines.length > 0) return processSubtitleLines(lines);

    // 4. XML format 2: <p t="1500" d="2000"><s>...</s></p>
    const pTagRegex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    while ((m = pTagRegex.exec(trimmed)) !== null) {
      const attrs = m[1];
      const tMatch = attrs.match(/t="([^"]*)"/);
      const dMatch = attrs.match(/d="([^"]*)"/);
      const start = tMatch ? (parseFloat(tMatch[1]) || 0) / 1000 : 0;
      const duration = dMatch ? (parseFloat(dMatch[1]) || 1500) / 1000 : 1.5;
      const text = decodeEntities(m[2].replace(/<[^>]+>/g, ''));
      if (text) {
        lines.push({
          id: lines.length,
          start,
          end: start + duration,
          duration,
          text
        });
      }
    }
    if (lines.length > 0) return processSubtitleLines(lines);

    return processSubtitleLines(lines);
  }

  // Fetch video caption tracks via Android Innertube client
  // Fast, reliable, never blocked by bot detection, works for all videos
  async function fetchAndroidInnertubeData(videoId) {
    if (!videoId) return null;
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.10.38'
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.10.38'
            }
          },
          videoId: videoId
        })
      });

      if (!res.ok) return null;
      const json = await res.json();
      const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const title = json?.videoDetails?.title || '';
      const author = json?.videoDetails?.author || '';

      return {
        title,
        author,
        tracks: tracks.map((t) => ({
          baseUrl: t.baseUrl,
          name: t.name?.runs?.[0]?.text || t.name?.simpleText || 'Subtitles',
          languageCode: t.languageCode || '',
          vssId: t.vssId || t.vss_id || ''
        }))
      };
    } catch (e) {
      console.warn('[YT Sub Sidepanel] fetchAndroidInnertubeData error:', e);
      return null;
    }
  }

  // Read video title, caption tracks, and transcript params from open tab
  async function getVideoDataFromTab(tabId) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const flexy = document.querySelector('ytd-watch-flexy');
          const flexyData = flexy?.playerData || flexy?.data?.playerResponse;
          const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
          const pResp = (player && typeof player.getPlayerResponse === 'function') ? player.getPlayerResponse() : null;
          const initResp = window.ytInitialPlayerResponse;
          const initData = window.ytInitialData;

          let tracksWithUrl = [];

          function findValidTracks(obj) {
            const list = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (Array.isArray(list) && list.length > 0) {
              const valid = list.filter((t) => t && t.baseUrl);
              if (valid.length > 0) return valid;
            }
            return [];
          }

          tracksWithUrl = findValidTracks(flexyData);
          if (tracksWithUrl.length === 0) tracksWithUrl = findValidTracks(pResp);
          if (tracksWithUrl.length === 0) tracksWithUrl = findValidTracks(initResp);

          // If still empty, scan DOM script tags for captionTracks with baseUrl
          if (tracksWithUrl.length === 0) {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
              const text = s.textContent || '';
              const idx = text.indexOf('captionTracks');
              if (idx !== -1) {
                const start = text.indexOf('[', idx);
                let depth = 0, inStr = false, esc = false;
                for (let i = start; i < text.length; i++) {
                  const c = text[i];
                  if (esc) { esc = false; continue; }
                  if (c === '\\') { esc = true; continue; }
                  if (c === '"') { inStr = !inStr; continue; }
                  if (!inStr) {
                    if (c === '[') depth++;
                    else if (c === ']') {
                      depth--;
                      if (depth === 0) {
                        try {
                          const parsed = JSON.parse(text.substring(start, i + 1));
                          if (Array.isArray(parsed)) {
                            const valid = parsed.filter((t) => t && t.baseUrl);
                            if (valid.length > 0) {
                              tracksWithUrl = valid;
                              break;
                            }
                          }
                        } catch (e) {}
                        break;
                      }
                    }
                  }
                }
                if (tracksWithUrl.length > 0) break;
              }
            }
          }

          // Active track currently selected in player settings
          let playerSelectedLang = '';
          let isSubtitlesOn = false;
          if (player && typeof player.getOption === 'function') {
            try {
              const currentOption = player.getOption('captions', 'track');
              playerSelectedLang = currentOption?.languageCode || currentOption?.vss_id || '';
              if (typeof player.isSubtitlesOn === 'function') {
                isSubtitlesOn = player.isSubtitlesOn();
              }
            } catch (e) {}
          }

          // Search for getTranscriptEndpoint params from engagement panels or script tags
          let transcriptParams = null;
          const panels = initData?.engagementPanels || [];
          for (const p of panels) {
            const ep = p?.engagementPanelSectionListRenderer?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.getTranscriptEndpoint;
            if (ep?.params) {
              transcriptParams = ep.params;
              break;
            }
          }
          if (!transcriptParams) {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
              const t = s.textContent || '';
              const m = t.match(/"getTranscriptEndpoint":\{"params":"([^"]+)"/);
              if (m) {
                transcriptParams = m[1];
                break;
              }
            }
          }

          const title = pResp?.videoDetails?.title || initResp?.videoDetails?.title || document.title.replace(' - YouTube', '').trim();
          const author = pResp?.videoDetails?.author || initResp?.videoDetails?.author || '';

          return {
            title,
            author,
            playerSelectedLang,
            isSubtitlesOn,
            transcriptParams,
            tracks: tracksWithUrl.map((t) => ({
              baseUrl: t.baseUrl,
              name: t.name?.runs?.[0]?.text || t.name?.simpleText || t.languageName || t.name || 'Subtitles',
              languageCode: t.languageCode || '',
              vssId: t.vssId || t.vss_id || ''
            }))
          };
        }
      });

      return result;
    } catch (e) {
      console.warn('[YT Sub Sidepanel] getVideoDataFromTab error:', e);
      return null;
    }
  }

  // Fetch subtitle file content using page session or Innertube transcript
  async function fetchSubtitlesInTab(tabId, trackUrl, transcriptParams) {
    // 1. If we have transcriptParams, try Innertube get_transcript first!
    if (transcriptParams) {
      try {
        const [{ result: transcriptResult }] = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: async (params) => {
            try {
              const apiKey = window.ytcfg?.get?.('INNERTUBE_API_KEY') || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
              const context = window.ytcfg?.get?.('INNERTUBE_CONTEXT') || {
                client: {
                  hl: 'en',
                  gl: 'US',
                  clientName: 'WEB',
                  clientVersion: '2.20261008.01.00'
                }
              };
              const res = await window.fetch(`/youtubei/v1/get_transcript?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ context, params })
              });
              if (res.ok) {
                const text = await res.text();
                if (text && text.includes('transcriptSegmentRenderer')) return text;
              }
            } catch (e) {}
            return '';
          },
          args: [transcriptParams]
        });

        if (transcriptResult && transcriptResult.trim().length > 0) {
          return transcriptResult;
        }
      } catch (e) {
        console.warn('[YT Sub] Innertube transcript fetch error:', e);
      }
    }

    // 2. If trackUrl exists, fetch from timedtext in-tab
    if (trackUrl) {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: async (url) => {
            const variants = [
              url,
              url.includes('fmt=json3') ? url : url + (url.includes('?') ? '&' : '?') + 'fmt=json3',
              url.includes('fmt=vtt') ? url : url + (url.includes('?') ? '&' : '?') + 'fmt=vtt',
              url + (url.includes('?') ? '&' : '?') + 'fmt=srv3'
            ];

            function isValidSubtitleText(str) {
              if (!str || !str.trim()) return false;
              const t = str.trim();
              if (t.startsWith('<!DOCTYPE html') || t.startsWith('<html') || t.includes('<title>Sorry')) {
                return false;
              }
              return t.startsWith('{') || t.startsWith('WEBVTT') || t.includes('<text') || t.includes('<p') || t.includes('<transcript');
            }

            for (const u of variants) {
              try {
                const res = await window.fetch(u, { credentials: 'include' });
                if (res.ok) {
                  const text = await res.text();
                  if (isValidSubtitleText(text)) return text;
                }
              } catch (e) {}
            }

            // XMLHttpRequest fallback
            for (const u of variants) {
              try {
                const xhrText = await new Promise((resolve) => {
                  const xhr = new XMLHttpRequest();
                  xhr.open('GET', u, true);
                  xhr.withCredentials = true;
                  xhr.onload = () => resolve(xhr.status === 200 ? xhr.responseText : '');
                  xhr.onerror = () => resolve('');
                  xhr.send();
                });
                if (isValidSubtitleText(xhrText)) return xhrText;
              } catch (e) {}
            }

            return '';
          },
          args: [trackUrl]
        });

        if (result) return result;
      } catch (e) {
        console.warn('[YT Sub] fetchSubtitlesInTab error:', e);
      }

      // Extension sidepanel fetch fallback
      try {
        const res = await fetch(trackUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && !text.startsWith('<html') && !text.includes('<title>Sorry')) {
            return text;
          }
        }
      } catch (e) {}
    }

    return '';
  }

  // Subtitle caching system (Memory + Chrome Storage per videoId)
  const subtitlesMemoryCache = new Map();

  async function getCachedSubtitles(videoId) {
    if (!videoId) return null;
    if (subtitlesMemoryCache.has(videoId)) {
      return subtitlesMemoryCache.get(videoId);
    }
    try {
      const key = `yt_sub_cache_${videoId}`;
      const data = await chrome.storage.local.get([key]);
      if (data && data[key] && Array.isArray(data[key].lines) && data[key].lines.length > 0) {
        subtitlesMemoryCache.set(videoId, data[key]);
        return data[key];
      }
    } catch (e) {}
    return null;
  }

  function saveSubtitlesToCache(videoId, title, author, lines, tracks, rawLines) {
    if (!videoId || !Array.isArray(lines) || lines.length === 0) return;
    const entry = {
      title: title || '',
      author: author || '',
      lines,
      tracks: tracks || [],
      rawLines: (rawLines && rawLines.length > 0) ? rawLines : lines
    };
    subtitlesMemoryCache.set(videoId, entry);
    const key = `yt_sub_cache_${videoId}`;
    chrome.storage.local.set({ [key]: entry }).catch(() => {});
  }

  // Load and setup subtitles for the current video
  async function loadSubtitlesForTab(tabId) {
    showView('loading');
    setConnectionStatus(true, 'Connecting to subtitles...');

    // 0. Check cache first! If already cached, load immediately with 0ms delay!
    const cached = await getCachedSubtitles(currentVideoId);
    if (cached && (cached.rawLines || cached.lines)) {
      if (cached.title) elVideoTitle.textContent = cached.title;
      if (cached.author) elVideoChannel.textContent = cached.author;
      if (cached.tracks && cached.tracks.length > 0) {
        availableTracks = cached.tracks;
        elTrackSelect.innerHTML = '';
        availableTracks.forEach((track) => {
          const opt = document.createElement('option');
          opt.value = track.baseUrl;
          opt.textContent = `${track.name} [${track.languageCode || 'sub'}]`;
          elTrackSelect.appendChild(opt);
        });
      }
      const raw = (cached.rawLines && cached.rawLines.length > 0) ? cached.rawLines : cached.lines;
      subtitleLines = processSubtitleLines(raw);
      renderSubtitles(subtitleLines);
      showView('subtitles');
      queryPlaybackState();
      return;
    }

    // 1. Fetch via Android Innertube client and tab data in parallel!
    const [innertubeData, tabData] = await Promise.all([
      fetchAndroidInnertubeData(currentVideoId),
      getVideoDataFromTab(tabId)
    ]);

    const title = innertubeData?.title || tabData?.title || 'YouTube Video';
    const author = innertubeData?.author || tabData?.author || '';
    elVideoTitle.textContent = title;
    elVideoChannel.textContent = author;

    // Prefer Android Innertube tracks because their baseUrl works without bot blocks!
    let tracks = (innertubeData?.tracks && innertubeData.tracks.length > 0)
      ? innertubeData.tracks
      : (tabData?.tracks || []);

    availableTracks = tracks;

    if (tracks.length > 0) {
      let chosenIdx = 0;
      const playerSelectedLang = tabData?.playerSelectedLang || '';
      if (playerSelectedLang) {
        const matchIdx = tracks.findIndex(
          (t) =>
            t.languageCode === playerSelectedLang ||
            t.vssId.includes(playerSelectedLang)
        );
        if (matchIdx !== -1) chosenIdx = matchIdx;
      } else {
        const enIdx = tracks.findIndex(
          (t) =>
            (t.languageCode || '').toLowerCase().startsWith('en') ||
            (t.vssId || '').toLowerCase().includes('.en')
        );
        if (enIdx !== -1) chosenIdx = enIdx;
      }

      // Populate track dropdown with ALL available tracks
      elTrackSelect.innerHTML = '';
      tracks.forEach((track, idx) => {
        const opt = document.createElement('option');
        opt.value = track.baseUrl;
        opt.textContent = `${track.name} [${track.languageCode || 'sub'}]`;
        if (idx === chosenIdx) opt.selected = true;
        elTrackSelect.appendChild(opt);
      });

      const chosenTrack = tracks[chosenIdx];
      selectedTrackUrl = chosenTrack ? chosenTrack.baseUrl : '';

      await loadSubtitleText(tabId, selectedTrackUrl, chosenIdx, tabData?.transcriptParams);
    } else if (tabData?.transcriptParams) {
      await loadSubtitleText(tabId, '', 0, tabData.transcriptParams);
    } else {
      showView('subtitles');
      elSubtitlesList.innerHTML = '<div class="live-hint-banner"><span class="live-pulse"></span><div><strong>Live Subtitles Active</strong><span>Waiting for speech... Subtitles will stream here like music lyrics.</span></div></div>';
      queryPlaybackState();
      checkTabForLiveCaption();
    }
  }

  async function loadSubtitleText(tabId, trackUrl, trackIndex, transcriptParams) {
    showView('loading');

    // 1. Try direct fetch first (works directly with Android Innertube baseUrl!)
    let rawText = '';
    if (trackUrl) {
      try {
        const res = await fetch(trackUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 0 && !text.startsWith('<html') && !text.includes('<title>Sorry')) {
            rawText = text;
          }
        }
      } catch (e) {}
    }

    // 2. If direct fetch was empty, fallback to fetchSubtitlesInTab
    if (!rawText) {
      rawText = await fetchSubtitlesInTab(tabId, trackUrl, transcriptParams);
    }

    const parsedLines = parseAnySubtitleFormat(rawText);

    if (parsedLines.length > 0) {
      subtitleLines = parsedLines;
      saveSubtitlesToCache(currentVideoId, elVideoTitle.textContent, elVideoChannel.textContent, subtitleLines, availableTracks, rawSubtitleLines);
      renderSubtitles(subtitleLines);
      showView('subtitles');
      queryPlaybackState();
    } else {
      // Try next track if available
      if (availableTracks.length > trackIndex + 1) {
        const next = availableTracks[trackIndex + 1];
        elTrackSelect.value = next.baseUrl;
        await loadSubtitleText(tabId, next.baseUrl, trackIndex + 1, transcriptParams);
      } else {
        // Switch to live lyrics mode
        showView('subtitles');
        elSubtitlesList.innerHTML = '<div class="live-hint-banner"><span class="live-pulse"></span><div><strong>Live Subtitles Active</strong><span>Streaming speech from video player in real-time...</span></div></div>';
        queryPlaybackState();
        checkTabForLiveCaption();
      }
    }
  }

  function checkTabForLiveCaption() {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, { action: 'GET_CURRENT_LIVE_CAPTION' }, (res) => {
      if (res && res.success && res.text) {
        handleLiveCaptionSegment({ text: res.text, time: res.time });
      }
    });
  }

  function queryPlaybackState() {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, { action: 'GET_PLAYBACK_STATE' }, (res) => {
      if (res && res.success) {
        currentVideoTime = res.currentTime || 0;
        totalVideoDuration = res.duration || 0;
        isPlaying = !res.paused;
        updatePlayPauseButton();
        updateTimeDisplay();
        highlightActiveSubtitle(currentVideoTime, true);
      }
    });
  }

  // Create a single subtitle row DOM element
  function createSubtitleRowElement(line) {
    const row = document.createElement('div');
    row.className = 'sub-row';
    row.id = `sub-${line.id}`;
    row.dataset.id = line.id;
    row.dataset.start = line.start;
    row.dataset.end = line.end;

    const timeBtn = document.createElement('button');
    timeBtn.className = 'sub-time-btn';
    timeBtn.title = 'Jump to ' + formatTime(line.start);

    const wave = document.createElement('div');
    wave.className = 'voice-wave';
    wave.innerHTML = '<span class="wave-bar"></span><span class="wave-bar"></span><span class="wave-bar"></span>';
    timeBtn.appendChild(wave);

    const timeText = document.createTextNode(formatTime(line.start));
    timeBtn.appendChild(timeText);

    const content = document.createElement('div');
    content.className = 'sub-content';

    const textEl = document.createElement('div');
    textEl.className = 'sub-text';
    textEl.textContent = line.text;
    content.appendChild(textEl);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy-line';
    copyBtn.title = 'Copy line';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
    `;

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(`[${formatTime(line.start)}] ${line.text}`);
      showToast('Copied to clipboard!');
    });

    row.addEventListener('click', () => {
      seekVideoTo(line.start);
    });

    row.appendChild(timeBtn);
    row.appendChild(content);
    row.appendChild(copyBtn);
    return row;
  }

  // Render lyric lines
  function renderSubtitles(lines) {
    elSubtitlesList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    lines.forEach((line) => {
      fragment.appendChild(createSubtitleRowElement(line));
    });

    elSubtitlesList.appendChild(fragment);

    if (currentSearchQuery) {
      filterSubtitles(currentSearchQuery);
    }
  }

  // Dedicated, robust auto-scrolling engine for subtitle list
  let isProgrammaticScrolling = false;
  let programmaticScrollTimer = null;
  let userScrollIdleTimer = null;
  let isMouseDownOnList = false;

  function scrollToActiveSubtitle(force = false) {
    if (!isAutoScroll && !force) return;
    if (userHasScrolled && !force) return;
    if (activeLineId === null) return;

    const activeEl = document.getElementById(`sub-${activeLineId}`);
    if (!activeEl) return;

    const listHeight = elSubtitlesList.clientHeight;
    if (listHeight <= 0) return;

    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.offsetHeight;
    const targetScrollTop = Math.max(0, elTop - (listHeight / 2) + (elHeight / 2));

    isProgrammaticScrolling = true;
    if (programmaticScrollTimer) clearTimeout(programmaticScrollTimer);

    elSubtitlesList.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });

    programmaticScrollTimer = setTimeout(() => {
      isProgrammaticScrolling = false;
    }, 450);
  }

  // Real-time lyric highlighting
  function highlightActiveSubtitle(time, forceScroll = false) {
    if (!subtitleLines || subtitleLines.length === 0) return;

    // Apply user sync offset (default 0s)
    const effectiveTime = time + subtitleSyncOffset;

    // 1. Find all subtitle lines active at effectiveTime
    const activeCandidates = subtitleLines.filter(
      (line) => effectiveTime >= line.start && effectiveTime < line.end
    );

    let activeLine = null;
    if (activeCandidates.length > 0) {
      // Pick the latest started candidate so newly spoken sentences take immediate priority!
      activeLine = activeCandidates[activeCandidates.length - 1];
    } else {
      // 2. If video time is in a momentary pause between lines (<= 1.0s gap),
      // keep the most recent line highlighted so lyrics don't flicker off during brief breaths
      const prev = subtitleLines.filter((l) => l.start <= effectiveTime);
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (effectiveTime >= last.start && effectiveTime - last.end <= 1.0) {
          activeLine = last;
        }
      }
    }

    const newActiveId = activeLine ? activeLine.id : null;

    if (newActiveId !== activeLineId) {
      if (activeLineId !== null) {
        const oldEl = document.getElementById(`sub-${activeLineId}`);
        if (oldEl) oldEl.classList.remove('active');
      }

      activeLineId = newActiveId;

      if (activeLineId !== null) {
        const newEl = document.getElementById(`sub-${activeLineId}`);
        if (newEl) {
          newEl.classList.add('active');

          if (isAutoScroll && !userHasScrolled) {
            scrollToActiveSubtitle(false);
          } else if (userHasScrolled) {
            elBtnJumpCurrent.style.display = 'flex';
          }
        }
      }
    } else if (forceScroll && activeLineId !== null) {
      scrollToActiveSubtitle(true);
    }
  }

  function seekVideoTo(time) {
    if (!currentTabId) return;
    chrome.tabs.sendMessage(currentTabId, { action: 'SEEK_TO', time, play: true }, (res) => {
      if (res && res.success) {
        currentVideoTime = res.currentTime;
        highlightActiveSubtitle(currentVideoTime, true);
        userHasScrolled = false;
        elBtnJumpCurrent.style.display = 'none';
      }
    });
  }

  function filterSubtitles(query) {
    currentSearchQuery = query.trim().toLowerCase();
    const rows = elSubtitlesList.querySelectorAll('.sub-row');

    if (!currentSearchQuery) {
      rows.forEach((row) => {
        row.classList.remove('hidden');
        const textEl = row.querySelector('.sub-text');
        const id = parseInt(row.dataset.id, 10);
        const line = subtitleLines[id];
        if (line && textEl) {
          textEl.textContent = line.text;
        }
      });
      elSearchResultsInfo.style.display = 'none';
      elBtnClearSearch.style.display = 'none';
      return;
    }

    elBtnClearSearch.style.display = 'block';
    let matchCount = 0;

    rows.forEach((row) => {
      const id = parseInt(row.dataset.id, 10);
      const line = subtitleLines[id];
      if (!line) return;

      const text = line.text;
      const lower = text.toLowerCase();
      const matchIdx = lower.indexOf(currentSearchQuery);

      if (matchIdx !== -1) {
        row.classList.remove('hidden');
        matchCount++;

        const textEl = row.querySelector('.sub-text');
        const before = text.substring(0, matchIdx);
        const match = text.substring(matchIdx, matchIdx + currentSearchQuery.length);
        const after = text.substring(matchIdx + currentSearchQuery.length);
        textEl.innerHTML = `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
      } else {
        row.classList.add('hidden');
      }
    });

    elSearchMatchCount.textContent = matchCount;
    elSearchResultsInfo.style.display = 'block';
  }

  function updatePlayPauseButton() {
    if (isPlaying) {
      elIconPlay.style.display = 'none';
      elIconPause.style.display = 'block';
    } else {
      elIconPlay.style.display = 'block';
      elIconPause.style.display = 'none';
    }
  }

  function updateTimeDisplay() {
    elTimeCurrent.textContent = formatTime(currentVideoTime);
    elTimeTotal.textContent = formatTime(totalVideoDuration);

    if (totalVideoDuration > 0) {
      const pct = Math.min(100, Math.max(0, (currentVideoTime / totalVideoDuration) * 100));
      elProgressBarFill.style.width = `${pct}%`;
    }
  }

  async function syncActiveTab() {
    showView('loading');
    setConnectionStatus(false, 'Connecting to YouTube...');

    try {
      const tab = await getYouTubeTab();
      if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
        showView('not-youtube');
        setConnectionStatus(false, 'Not YouTube');
        return;
      }

      currentTabId = tab.id;
      const videoId = getVideoIdFromUrl(tab.url);

      if (!videoId) {
        showView('not-youtube');
        setConnectionStatus(false, 'No video on page');
        return;
      }

      currentVideoId = videoId;
      setConnectionStatus(true, 'Connected to YouTube');

      // Make sure content script is active in the tab
      chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content/content-isolated.js']
      }).catch(() => {});

      await loadSubtitlesForTab(currentTabId);
    } catch (err) {
      console.error('[YT Sub Sidepanel] Sync active tab error:', err);
      showView('not-youtube');
      setConnectionStatus(false, 'Connection error');
    }
  }

  function setupEventListeners() {
    elTrackSelect.addEventListener('change', (e) => {
      selectedTrackUrl = e.target.value;
      const idx = availableTracks.findIndex((t) => t.baseUrl === selectedTrackUrl);
      loadSubtitleText(currentTabId, selectedTrackUrl, Math.max(0, idx));
    });

    elSearchInput.addEventListener('input', (e) => {
      filterSubtitles(e.target.value);
    });

    elBtnClearSearch.addEventListener('click', () => {
      elSearchInput.value = '';
      filterSubtitles('');
      elSearchInput.focus();
    });

    elBtnAutoScroll.addEventListener('click', () => {
      isAutoScroll = !isAutoScroll;
      elBtnAutoScroll.classList.toggle('active', isAutoScroll);
      chrome.storage.local.set({ isAutoScroll });
      if (isAutoScroll) {
        userHasScrolled = false;
        elBtnJumpCurrent.style.display = 'none';
        scrollToActiveSubtitle(true);
        showToast('Auto-scroll enabled');
      } else {
        showToast('Auto-scroll paused');
      }
    });

    if (elBtnSmartSentence) {
      elBtnSmartSentence.addEventListener('click', () => {
        isSmartSentences = !isSmartSentences;
        elBtnSmartSentence.classList.toggle('active', isSmartSentences);
        chrome.storage.local.set({ isSmartSentences });
        if (rawSubtitleLines && rawSubtitleLines.length > 0) {
          subtitleLines = processSubtitleLines(rawSubtitleLines);
          renderSubtitles(subtitleLines);
          highlightActiveSubtitle(currentVideoTime, true);
        }
        showToast(isSmartSentences ? 'Smart Sentences (ngắt câu theo dấu & ngừng nghỉ)' : 'Raw Segments (ngắt theo phân đoạn gốc)');
      });
    }

    const handleUserManualScroll = () => {
      if (!isAutoScroll) return;
      // Real physical user action (wheel / touch drag / scrollbar drag)
      userHasScrolled = true;
      elBtnJumpCurrent.style.display = 'flex';

      // Auto-resume after 4.5 seconds of user idle if playing
      if (userScrollIdleTimer) clearTimeout(userScrollIdleTimer);
      userScrollIdleTimer = setTimeout(() => {
        if (isAutoScroll && isPlaying) {
          userHasScrolled = false;
          elBtnJumpCurrent.style.display = 'none';
          scrollToActiveSubtitle(true);
        }
      }, 4500);
    };

    elSubtitlesList.addEventListener('wheel', handleUserManualScroll, { passive: true });
    elSubtitlesList.addEventListener('touchmove', handleUserManualScroll, { passive: true });

    elSubtitlesList.addEventListener('mousedown', () => {
      isMouseDownOnList = true;
    });
    document.addEventListener('mouseup', () => {
      isMouseDownOnList = false;
    });

    elSubtitlesList.addEventListener('scroll', () => {
      // Programmatic scrolling in progress -> completely ignore!
      if (isProgrammaticScrolling) return;

      // User clicked and dragged the scrollbar
      if (isMouseDownOnList) {
        handleUserManualScroll();
        return;
      }

      // If user manually scrolled back to current active subtitle, auto-hide the jump button
      if (userHasScrolled && activeLineId !== null) {
        const activeEl = document.getElementById(`sub-${activeLineId}`);
        if (activeEl) {
          const rect = activeEl.getBoundingClientRect();
          const listRect = elSubtitlesList.getBoundingClientRect();
          const isInMiddle = rect.top >= listRect.top + 20 && rect.bottom <= listRect.bottom - 20;
          if (isInMiddle) {
            userHasScrolled = false;
            elBtnJumpCurrent.style.display = 'none';
          }
        }
      }
    });

    elBtnJumpCurrent.addEventListener('click', () => {
      userHasScrolled = false;
      elBtnJumpCurrent.style.display = 'none';
      scrollToActiveSubtitle(true);
    });

    elBtnMoreOptions.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = elExportMenu.style.display === 'flex';
      elExportMenu.style.display = isVisible ? 'none' : 'flex';
    });

    document.addEventListener('click', () => {
      elExportMenu.style.display = 'none';
    });

    elBtnCopyAll.addEventListener('click', () => {
      const text = subtitleLines.map((l) => l.text).join(' ');
      navigator.clipboard.writeText(text);
      showToast('Copied full transcript!');
    });

    elBtnCopyWithTime.addEventListener('click', () => {
      const text = subtitleLines
        .map((l) => `[${formatTime(l.start)}] ${l.text}`)
        .join('\n');
      navigator.clipboard.writeText(text);
      showToast('Copied transcript with timestamps!');
    });

    elBtnDownloadSrt.addEventListener('click', () => {
      let srtContent = '';
      subtitleLines.forEach((l, i) => {
        const formatSrtTime = (sec) => {
          const h = Math.floor(sec / 3600).toString().padStart(2, '0');
          const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
          const s = Math.floor(sec % 60).toString().padStart(2, '0');
          const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
          return `${h}:${m}:${s},${ms}`;
        };

        srtContent += `${i + 1}\n${formatSrtTime(l.start)} --> ${formatSrtTime(l.end)}\n${l.text}\n\n`;
      });

      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${elVideoTitle.textContent.replace(/[^a-z0-9]/gi, '_') || 'subtitles'}.srt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded .SRT file');
    });

    elBtnFontInc.addEventListener('click', () => {
      if (currentFontSize < 22) {
        currentFontSize += 1.5;
        document.documentElement.style.setProperty('--font-base', `${currentFontSize}px`);
        chrome.storage.local.set({ fontSize: currentFontSize });
      }
    });

    elBtnFontDec.addEventListener('click', () => {
      if (currentFontSize > 11) {
        currentFontSize -= 1.5;
        document.documentElement.style.setProperty('--font-base', `${currentFontSize}px`);
        chrome.storage.local.set({ fontSize: currentFontSize });
      }
    });

    elBtnThemeToggle.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('theme-light');
      document.body.classList.toggle('theme-dark', !isLight);
      chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
    });

    elBtnRefresh.addEventListener('click', () => {
      syncActiveTab();
    });

    document.getElementById('btn-open-youtube').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.youtube.com' });
    });

    document.getElementById('btn-retry-subs').addEventListener('click', () => {
      syncActiveTab();
    });

    const btnEnableCC = document.getElementById('btn-enable-cc');
    if (btnEnableCC) {
      btnEnableCC.addEventListener('click', () => {
        if (!currentTabId) return;
        chrome.tabs.sendMessage(currentTabId, { action: 'ENABLE_CC' }, (res) => {
          showToast('Turned on YouTube captions');
          setTimeout(() => syncActiveTab(), 600);
        });
      });
    }

    elBtnPlayPause.addEventListener('click', () => {
      if (!currentTabId) return;
      chrome.tabs.sendMessage(currentTabId, { action: 'TOGGLE_PLAY' }, (res) => {
        if (res && res.success) {
          isPlaying = !res.paused;
          updatePlayPauseButton();
        }
      });
    });

    elBtnSkipBack.addEventListener('click', () => {
      if (!currentTabId) return;
      chrome.tabs.sendMessage(currentTabId, { action: 'SKIP', seconds: -5 });
    });

    elBtnSkipForward.addEventListener('click', () => {
      if (!currentTabId) return;
      chrome.tabs.sendMessage(currentTabId, { action: 'SKIP', seconds: 5 });
    });

    elProgressBarBg.addEventListener('click', (e) => {
      if (totalVideoDuration <= 0) return;
      const rect = elProgressBarBg.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = clickRatio * totalVideoDuration;
      seekVideoTo(targetTime);
    });

    if (elBtnSyncDec) {
      elBtnSyncDec.addEventListener('click', (e) => {
        e.stopPropagation();
        setSyncOffset(subtitleSyncOffset - 0.2);
      });
    }

    if (elBtnSyncInc) {
      elBtnSyncInc.addEventListener('click', (e) => {
        e.stopPropagation();
        setSyncOffset(subtitleSyncOffset + 0.2);
      });
    }

    if (elBtnSyncReset) {
      elBtnSyncReset.addEventListener('click', (e) => {
        e.stopPropagation();
        setSyncOffset(0);
      });
    }
  }

  function handleLiveCaptionSegment(message) {
    if (!message || !message.text) return;
    const text = message.text.trim();
    if (!text) return;

    // If we have full pre-loaded track and no live banner, ignore live DOM segments
    if (subtitleLines.length > 5 && !elSubtitlesList.querySelector('.live-hint-banner')) {
      return;
    }

    const banner = elSubtitlesList.querySelector('.live-hint-banner');
    if (banner) banner.remove();

    const time = typeof message.time === 'number' ? message.time : currentVideoTime;
    const existing = subtitleLines.find(
      (l) => Math.abs(l.start - time) < 1.2 || l.text === text
    );

    if (!existing) {
      if (subtitleLines.length > 0) {
        const prev = subtitleLines[subtitleLines.length - 1];
        if (prev && prev.end > time) {
          prev.end = Math.max(prev.start + 0.5, time);
          prev.duration = prev.end - prev.start;
        }
      }

      const newLine = {
        id: subtitleLines.length,
        start: Math.max(0, time - 0.2),
        end: time + 3.0,
        duration: 3.0,
        text: text
      };

      subtitleLines.push(newLine);
      const row = createSubtitleRowElement(newLine);
      elSubtitlesList.appendChild(row);
      showView('subtitles');
      highlightActiveSubtitle(time, true);
    }
  }

  // Runtime message listener from content script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.action) {
      case 'TIME_UPDATE': {
        currentVideoTime = message.currentTime;
        totalVideoDuration = message.duration || totalVideoDuration;
        isPlaying = !message.paused;

        updatePlayPauseButton();
        updateTimeDisplay();
        highlightActiveSubtitle(currentVideoTime);
        break;
      }

      case 'PLAY_STATE_CHANGE': {
        isPlaying = !message.paused;
        updatePlayPauseButton();
        break;
      }

      case 'LIVE_CAPTION_SEGMENT': {
        handleLiveCaptionSegment(message);
        break;
      }

      case 'TIMEDTEXT_CAPTURED': {
        if (message.text && message.videoId === currentVideoId) {
          const parsed = parseAnySubtitleFormat(message.text);
          if (parsed && parsed.length > 0) {
            subtitleLines = parsed;
            saveSubtitlesToCache(currentVideoId, elVideoTitle.textContent, elVideoChannel.textContent, subtitleLines, availableTracks, rawSubtitleLines);
            renderSubtitles(subtitleLines);
            showView('subtitles');
            highlightActiveSubtitle(currentVideoTime, true);
          }
        }
        break;
      }

      case 'VIDEO_CHANGED': {
        if (message.videoId && message.videoId !== currentVideoId) {
          currentVideoId = message.videoId;
          syncActiveTab();
        }
        break;
      }

      case 'ACTIVE_TAB_CHANGED':
      case 'TAB_URL_UPDATED': {
        syncActiveTab();
        break;
      }
    }
  });

  chrome.storage.local.get(['theme', 'fontSize', 'subtitleSyncOffset', 'isSmartSentences', 'isAutoScroll'], (data) => {
    if (data.theme === 'light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
    if (data.fontSize) {
      currentFontSize = data.fontSize;
      document.documentElement.style.setProperty('--font-base', `${currentFontSize}px`);
    }
    if (typeof data.subtitleSyncOffset === 'number') {
      subtitleSyncOffset = data.subtitleSyncOffset;
      if (elSyncOffsetLabel) {
        elSyncOffsetLabel.textContent = `${subtitleSyncOffset > 0 ? '+' : ''}${subtitleSyncOffset.toFixed(1)}s`;
      }
    }
    if (typeof data.isSmartSentences === 'boolean') {
      isSmartSentences = data.isSmartSentences;
      if (elBtnSmartSentence) {
        elBtnSmartSentence.classList.toggle('active', isSmartSentences);
      }
    }
    if (typeof data.isAutoScroll === 'boolean') {
      isAutoScroll = data.isAutoScroll;
      if (elBtnAutoScroll) {
        elBtnAutoScroll.classList.toggle('active', isAutoScroll);
      }
    }
  });

  setupEventListeners();
  syncActiveTab();
})();
