# Window Title-Based Application Classification

## Overview

This document describes the per-title classification system implemented to accurately classify browser-based activities. The system ensures that different pages within the same domain (e.g., YouTube) are classified independently based on their actual content.

## Problem Statement

### Original Behavior

The original classification system used a domain-based deduplication key for browser windows:

```python
# OLD: Domain-only key
app_key = f"{app_lower}|{domain}"  # e.g., "chrome.exe|youtube"
```

This caused a significant issue with mixed-use websites:

| Time | Window Title | app_key | Sent to AI? | Classification |
|------|--------------|---------|-------------|----------------|
| 10:00 | "AI Tutorial - YouTube" | `chrome.exe\|youtube` | ✅ Yes | productive |
| 10:30 | "Movie Song - YouTube" | `chrome.exe\|youtube` | ❌ No (cached) | productive (inherited!) |

**Result:** Entertainment content was incorrectly classified as productive because the first YouTube video happened to be work-related.

### Root Cause

The deduplication logic only considered:
1. Process name (e.g., `chrome.exe`)
2. Domain extracted from window title (e.g., `youtube`)

Window title content was ignored in the deduplication key, even though it was sent to the AI for classification.

## Solution

### New Per-Title Classification

The updated system includes a normalized title key in the deduplication:

```python
# NEW: Domain + Title key
title_key = self._extract_title_key_for_classification(window_title, domain)
app_key = f"{app_lower}|{domain}|{title_key}"  # e.g., "chrome.exe|youtube|ai_tutorial"
```

| Time | Window Title | app_key | Sent to AI? | Classification |
|------|--------------|---------|-------------|----------------|
| 10:00 | "AI Tutorial - YouTube" | `chrome.exe\|youtube\|ai_tutorial` | ✅ Yes | productive |
| 10:30 | "Movie Song - YouTube" | `chrome.exe\|youtube\|movie_song` | ✅ Yes | non_productive |
| 10:45 | "AI Tutorial - YouTube" | `chrome.exe\|youtube\|ai_tutorial` | ❌ No (same page) | productive |

## Implementation Details

### Files Modified

- `python-desktop-app/desktop_app.py`

### New Method: `_extract_title_key_for_classification()`

```python
def _extract_title_key_for_classification(self, window_title, domain=''):
    """Extract a normalized title key for per-page classification deduplication.
    
    This extracts the meaningful page title (before the site name) and normalizes it
    so that the same content gets the same key, even with minor variations.
    
    Examples:
        "AI Tutorial - YouTube" (domain=youtube) -> "ai_tutorial"
        "Movie Song - YouTube" (domain=youtube) -> "movie_song"
        "GitHub - AmzurATG/JIRAForge" (domain=github) -> "amzuratg_jiraforge"
        "Stack Overflow - How to fix bug" -> "how_to_fix_bug"
        "Google Search" -> "search"
    
    Returns:
        str: Normalized title key (lowercase, alphanumeric + underscores, max 50 chars)
    """
```

#### Algorithm

1. **Parse separators**: Split on common title separators (`-`, `|`, `–`, `—`, `:`, `·`)
2. **Remove domain**: Filter out parts containing the known domain
3. **Normalize**: Convert to lowercase, keep only alphanumeric characters
4. **Truncate**: Limit to 50 characters to prevent memory bloat

### Updated Deduplication Logic

**Location:** `desktop_app.py` → `_on_window_switched()` method

```python
if classification == 'unknown':
    app_lower = app_name.lower()
    if app_lower in BROWSER_PROCESSES:
        # Extract domain and normalized title for per-page classification
        domain = self._extract_domain_from_title(window_title)
        title_key = self._extract_title_key_for_classification(window_title, domain)
        app_key = f"{app_lower}|{domain}|{title_key}" if domain else f"{app_lower}|{title_key}"
    else:
        app_key = app_lower
    
    if app_key not in self._unknown_apps_classified:
        # First time seeing this app/page — send to AI for classification
        self._unknown_apps_classified.add(app_key)
        # ... send to AI server
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Window Switch Event                          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Initial Classification Lookup                              │
│  - Check app_classifications_cache (SQLite)                         │
│  - For browsers: check URL patterns in window title                 │
│  - Result: 'productive', 'non_productive', 'private', or 'unknown'  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ (if 'unknown')
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Generate Deduplication Key                                 │
│  Browser:  app_key = "{process}|{domain}|{title_key}"               │
│  Non-browser: app_key = "{process}"                                 │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Check Deduplication Set                                    │
│  if app_key in _unknown_apps_classified:                            │
│      → Skip (already sent to AI this session)                       │
│  else:                                                              │
│      → Continue to AI classification                                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼ (if not in set)
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: AI Classification (async)                                  │
│  POST /api/classify-app                                             │
│  Body: { application_name, window_title, ocr_text }                 │
│  AI receives FULL context for accurate classification               │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Update Classification                                      │
│  - Update session manager                                           │
│  - Update activity_records in Supabase                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Title Key Normalization Examples

| Window Title | Domain | Title Key |
|--------------|--------|-----------|
| "AI Tutorial - YouTube" | youtube | `ai_tutorial` |
| "Movie Song - YouTube" | youtube | `movie_song` |
| "GitHub - AmzurATG/JIRAForge" | github | `amzuratg_jiraforge` |
| "Stack Overflow - How to fix bug" | stackoverflow | `how_to_fix_bug` |
| "Google Search" | google | `search` |
| "Netflix - Stranger Things S4" | netflix | `stranger_things_s4` |
| "Slack \| #engineering" | slack | `engineering` |

## Memory Considerations

### Deduplication Set Growth

The `_unknown_apps_classified` set grows with unique pages visited during a session:

- **Old system**: ~50-100 entries (one per domain)
- **New system**: ~500-2000 entries (one per unique page)

### Mitigations

1. **Title truncation**: Keys limited to 50 characters
2. **Session-scoped**: Set is cleared on app restart
3. **Alphanumeric only**: No special characters stored

### Memory Usage Estimate

- Average key length: ~40 characters
- Python string overhead: ~50 bytes per entry
- 2000 entries × 90 bytes = **~180 KB**

This is negligible compared to OCR text and screenshots.

## Testing Scenarios

### Scenario 1: Mixed YouTube Content

```
1. Open "Python Tutorial - YouTube" → AI classifies as productive
2. Open "Cat Videos - YouTube" → AI classifies as non_productive ✅
3. Return to "Python Tutorial - YouTube" → Uses cached classification ✅
```

### Scenario 2: Same Page, Multiple Visits

```
1. Open "Jira - SCRUM-123" → AI classifies as productive
2. Switch to another app
3. Return to "Jira - SCRUM-123" → Skipped (same key in set) ✅
```

### Scenario 3: Non-Browser Apps

```
1. Open Notepad → app_key = "notepad.exe" (no title key)
2. Change document → Still "notepad.exe" (title ignored for non-browsers)
```

## Related Components

- **AI Server**: `/api/classify-app` endpoint receives full window_title and ocr_text
- **Activity Service**: `classifyUnknownApp()` uses all context for LLM prompt
- **Session Manager**: Stores classification per window
- **Supabase**: `activity_records.classification` gets updated retroactively

## Future Improvements

1. **Persistent classification cache**: Store AI classifications in SQLite to avoid re-classification after restart
2. **Admin-defined URL patterns**: Allow admins to configure domain-level rules (e.g., "all YouTube = non_productive")
3. **Confidence-based re-evaluation**: Re-send to AI if first classification had low confidence
