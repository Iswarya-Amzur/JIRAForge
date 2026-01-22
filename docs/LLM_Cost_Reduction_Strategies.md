# LLM Cost Reduction Strategies for Your Time Tracking Application

## Your Current Architecture & Cost Analysis

Based on your codebase, here's where LLM costs are incurred:

| Component | Model Used | Trigger | Estimated Cost |
|-----------|------------|---------|----------------|
| **Screenshot Analysis** | GPT-4 Vision (`detail: high`) | Every screenshot (5-min interval) | ~$0.01-0.03/image |
| **OCR Fallback** | Tesseract + GPT-4 Text | Only when Vision fails | ~$0.002/call |
| **Clustering Service** | GPT-4/GPT-4o | Periodic batches of sessions | ~$0.01-0.05/batch |

**Current Problem**: With `detail: 'high'` on every screenshot, you're spending **765-1,105 tokens per image** ($0.02-0.03). At 12 screenshots/hour/user, that's approximately **$0.25-0.36/hour/user** or **$50-70/month/user** just for screenshot analysis.

---

## Strategy 1: OCR-First with Intelligent Routing (HIGHEST IMPACT)

### The Concept
Instead of sending every screenshot to GPT-4 Vision, extract text first with **free local OCR** (Tesseract, which you already have), then use **smart routing** to decide if Vision is even needed.

### How It Would Work for Your Use Case

```
Screenshot Captured
       │
       ▼
┌──────────────────┐
│  Tesseract OCR   │  ◄── FREE (local)
│  Extract Text    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  METADATA + OCR ANALYSIS (No LLM)        │
│  • Window title: "VS Code - jira1/..."   │
│  • App name: "Code.exe"                  │
│  • OCR text contains: "function", "SCRUM-123" │
└────────┬─────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│  DECISION ROUTER (Rule-Based, No LLM)          │
├────────────────────────────────────────────────┤
│ CASE 1: Jira key found in OCR text             │
│   → Direct match! Skip LLM entirely            │
│   → Confidence: 0.95                           │
├────────────────────────────────────────────────┤
│ CASE 2: System/Idle app detected               │
│   → LockApp, ScreenSaver, etc.                 │
│   → workType: "non-office", taskKey: null      │
│   → Skip LLM entirely                          │
├────────────────────────────────────────────────┤
│ CASE 3: Known work app + rich OCR text         │
│   → VS Code + code visible + file paths        │
│   → Use GPT-4o-mini TEXT (cheap) with OCR      │
│   → Cost: ~$0.0002 instead of $0.02            │
├────────────────────────────────────────────────┤
│ CASE 4: Ambiguous / Visual-heavy content       │
│   → Figma, complex diagrams, minimal text      │
│   → Use GPT-4 Vision with detail: "low"        │
│   → Cost: 85 tokens (~$0.0004)                 │
├────────────────────────────────────────────────┤
│ CASE 5: Need precise text reading              │
│   → Dense code, documentation                  │
│   → Use GPT-4 Vision with detail: "high"       │
│   → Cost: 765-1105 tokens (~$0.02)             │
└────────────────────────────────────────────────┘
```

### Estimated Savings
Based on typical developer workflows:
- **30-40%** of screenshots are system/idle apps → **FREE**
- **20-30%** have Jira keys visible in window/OCR → **FREE**
- **20-30%** are code editors with readable text → **GPT-4o-mini TEXT ($0.0002)**
- **10-20%** need actual vision analysis → **GPT-4 Vision**

**Potential savings: 70-85% cost reduction**

---

## Strategy 2: Image Deduplication / Similarity Detection

### The Concept
If a user is working in the same application on the same task, consecutive screenshots are often **nearly identical**. Why analyze the same image twice?

### How It Would Work

Using **perceptual hashing** (pHash) or **image embeddings**, you can detect when:
- New screenshot is >95% similar to previous screenshot
- Window title hasn't changed
- Application is the same

**In these cases**: Reuse the previous analysis result instead of making a new API call.

### Technical Approach
1. **Perceptual Hashing**: Libraries like [imagededup](https://github.com/idealo/imagededup) can compute 64-bit hashes where similar images produce similar hashes
2. **Cosine Similarity on Embeddings**: Use a lightweight local model (CLIP) to create image embeddings and compare similarity
3. **Simple Pixel Comparison**: For exact/near-exact duplicates, compute image difference

### Real-World Impact
In a typical 8-hour workday:
- User works on same task for 30-60 minute stretches
- That's 6-12 consecutive similar screenshots
- Only the first needs full analysis; others can inherit results

**Potential savings: 40-60% fewer API calls**

---

## Strategy 3: Use `detail: "low"` Instead of `detail: "high"`

### Current Code (vision-analyzer.js:58)
```javascript
image_url: {
  url: imageDataUrl,
  detail: 'high' // Use high detail for better analysis
}
```

### The Cost Difference
| Detail Level | Token Cost | Actual Cost |
|--------------|------------|-------------|
| `low` | 85 tokens (fixed) | ~$0.0004 |
| `high` | 765-1,105 tokens | ~$0.02-0.03 |

**That's 10-13x more expensive for `high`!**

### When You Can Use `low`
- Classifying work type (office vs non-office)
- Identifying application category
- General scene understanding
- Screenshots with large UI elements

### When You Need `high`
- Reading specific code/text
- Matching to exact Jira issues
- Dense documentation screens

### Hybrid Approach
1. First pass: Use `detail: "low"` for classification ($0.0004)
2. If classification is ambiguous OR needs Jira matching: Use `detail: "high"` ($0.02)

**Potential savings: 50-70% on Vision API costs**

---

## Strategy 4: Rule-Based Pre-Classification (Zero LLM Cost)

### You Already Have the Data!
Your desktop app captures:
- `window_title`: "index.js - jira1 - Visual Studio Code"
- `application_name`: "Code.exe"

### Rule-Based Classification That Needs NO LLM

```
RULE 1: System Apps (Your clustering-service.js already has this!)
  LockApp, ScreenSaver, LogonUI → workType: "non-office", taskKey: null

RULE 2: Known Non-Work Apps
  Netflix, YouTube, Spotify, Steam, Discord (personal servers)
  → workType: "non-office"

RULE 3: Jira Key in Window Title
  Regex: /([A-Z]+-\d+)/ matches "SCRUM-123" in window title
  → Direct taskKey match, no LLM needed!

RULE 4: Project Path Detection
  Window title contains "/jira1/" or "jira-time-tracker"
  → Can narrow down to specific project without LLM

RULE 5: Known Work Patterns
  VS Code + "test" in title → likely testing
  Chrome + "jira.atlassian.net" → Jira usage
  Terminal + "npm" or "git" → development work
```

### Implementation Idea
Create a **pre-classifier** that runs BEFORE any LLM call:
- If rules produce high-confidence result → Skip LLM entirely
- If rules produce partial context → Send minimal prompt to cheaper model
- If rules can't classify → Fall back to full Vision analysis

**Potential savings: 20-40% of screenshots need no LLM at all**

---

## Strategy 5: OpenAI Batch API for Clustering (50% Savings)

### Your Current Clustering
Your `clustering-service.js` runs GPT-4/GPT-4o to group sessions. This doesn't need real-time results!

### Batch API Benefits
- **50% cost discount** on all tokens
- Process up to 50,000 requests per batch
- Results guaranteed within 24 hours
- Higher rate limits

### Perfect Fit for Your Use Case
Clustering is already a **background operation** (runs periodically via `clustering-polling-service.js`). Users don't need instant clustering results.

**Implementation**: Instead of real-time clustering calls, queue them and submit as a batch job overnight.

**Potential savings: 50% on all clustering costs**

---

## Strategy 6: Model Selection Optimization

### Current Models in Your Code
- Screenshot Analysis: GPT-4 Vision (expensive)
- OCR Fallback: GPT-4 Text (expensive)
- Clustering: GPT-4o (expensive)

### Recommended Changes

| Task | Current Model | Recommended | Savings |
|------|---------------|-------------|---------|
| Simple classification | GPT-4 Vision | GPT-4o-mini (text with OCR) | 90%+ |
| Complex visual analysis | GPT-4 Vision (high) | GPT-4 Vision (low) | 90% |
| OCR text analysis | GPT-4 | GPT-4o-mini | 95% |
| Clustering | GPT-4o | GPT-4o-mini + Batch API | 75% |

### GPT-4o-mini Pricing
- Input: $0.15/1M tokens (vs $5/1M for GPT-4o)
- Output: $0.60/1M tokens (vs $15/1M for GPT-4o)
- **33x cheaper for text processing!**

### Caveat for Vision
GPT-4o-mini has a quirk with vision: it uses ~2833 tokens for low-detail images (vs 85 for GPT-4o), which can make it MORE expensive for image-heavy workloads. For vision specifically, stick with GPT-4o with `detail: "low"`.

---

## Strategy 7: Local Vision Models (Free Alternative)

### Options Available via Ollama
- **LLaVA 1.6**: Open-source GPT-4V alternative, runs on 8GB RAM
- **Moondream**: Lightweight vision model
- **Qwen2-VL**: Strong vision-language understanding

### When to Consider This
- High volume of screenshots (>1000/day)
- Privacy requirements (data never leaves your server)
- Predictable costs (just infrastructure, no per-call fees)

### Trade-offs
| Factor | Cloud (GPT-4V) | Local (LLaVA) |
|--------|----------------|---------------|
| Accuracy | Excellent | Good (80-90% of GPT-4V) |
| Speed | Fast | Depends on hardware |
| Cost | Per-call | Fixed infrastructure |
| Setup | Easy | Requires GPU/setup |

### Hybrid Approach
Use local models for:
- Initial classification (office vs non-office)
- Obvious cases (system apps, known patterns)

Fall back to GPT-4V for:
- Ambiguous cases
- High-stakes Jira matching

---

## Strategy 8: Smart Caching Layer

### What to Cache (You've started this with cache.js!)

Extend caching to include:

1. **Analysis Results by Image Hash**
   - Hash the screenshot
   - If same hash exists in cache → return cached analysis
   - TTL: 1 hour (same screenshot = same analysis)

2. **Window Title + App Patterns**
   - Cache: "Code.exe" + "jira1" → likely project X
   - Reduces need for full analysis on repeat patterns

3. **User Work Patterns**
   - User typically works on SCRUM-123 from 9-11 AM
   - Use as prior probability for matching

---

## Recommended Implementation Priority

| Priority | Strategy | Effort | Impact | Savings |
|----------|----------|--------|--------|---------|
| 🥇 1 | `detail: "low"` for Vision | Low | High | 50-70% |
| 🥈 2 | OCR-first routing | Medium | High | 70-85% |
| 🥉 3 | Rule-based pre-classification | Low | Medium | 20-40% |
| 4 | Image deduplication | Medium | Medium | 40-60% |
| 5 | Batch API for clustering | Low | Medium | 50% |
| 6 | GPT-4o-mini for text tasks | Low | Medium | 90%+ |
| 7 | Local models | High | High | ~100% |

---

## Projected Cost Savings

### Current Cost (Estimated)
- 12 screenshots/hour × $0.025/screenshot = $0.30/hour
- 8 hours/day = $2.40/day/user
- 20 working days = **$48/month/user**

### After Optimizations
With strategies 1-5 implemented:
- 40% screenshots skip LLM entirely (rules + dedup): **FREE**
- 40% use OCR + GPT-4o-mini text: **$0.0002 each**
- 20% need Vision but use `detail: "low"`: **$0.0004 each**

New cost: ~$0.02-0.04/hour = **$3-6/month/user**

**Total savings: 85-95%**

---

## Sources

- [OpenAI Vision API Documentation](https://platform.openai.com/docs/guides/images-vision)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [GPT-4o mini Announcement](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/)
- [GPT-4o mini vs GPT-4o Comparison](https://www.relay.app/blog/compare-gpt-4o-vs-gpt-4o-mini)
- [GPT-4o-mini Vision Cost Issue](https://community.openai.com/t/gpt-4o-mini-high-vision-cost/872382)
- [imagededup Library](https://github.com/idealo/imagededup)
- [OpenAI Batch API](https://help.openai.com/en/articles/9197833-batch-api-faq)
- [Batch API 50% Savings](https://medium.com/@tanmay17061/batch-gpt-we-slashed-our-openai-api-costs-by-over-50-bfbfbabd4e03)
- [LLaVA Open Source Alternative](https://medium.com/data-science/llava-an-open-source-alternative-to-gpt-4v-ision-b06f88ce8efa)
- [Ollama Vision Models](https://ollama.com/blog/vision-models)
- [OCR Tools Comparison](https://modal.com/blog/8-top-open-source-ocr-models-compared)
- [LLMs vs OCR](https://www.klippa.com/en/blog/information/llms-vs-ocr-software/)
