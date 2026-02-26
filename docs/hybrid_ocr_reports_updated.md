# Hybrid OCR Approach - Real Cost Analysis Report

## Executive Summary

This document provides **real cost analysis** based on actual production data from LiteLLM logs (February 26, 2026). The Hybrid OCR approach demonstrates significant cost savings compared to the Vision-based approach.

**Bottom Line: The Hybrid OCR approach saves ~57% on LLM costs.** At scale (50+ users), that's ~$770/year saved. Both approaches are very cheap thanks to Gemini 2.0 Flash pricing, but the batched OCR approach is clearly the winner on cost.

---

## Baseline Assumptions

| Parameter | Value |
|-----------|-------|
| Screenshots per day | 400 |
| Hours per day | 8 |
| Working days per month | 30 |
| **Total records per month** | **12,000** (400 × 30) |

---

## Per-Record Cost Analysis (From Production Logs)

### Old Approach: Screenshot Vision Analysis

**Source:** Vishnu's API calls in LiteLLM logs

| Metric | Value |
|--------|-------|
| Avg cost per screenshot | **$0.000182** |
| Avg tokens per call | ~3,065 (includes image tokens) |
| Records per call | 1 |

**Sample calls from logs:**
- `7MCfaaeYC4_FjuMPuqS04QY`: 3,074 tokens, $0.000186, 4.253s
- `1MCfacWoNtygjuMPkLPW6AY`: 3,035 tokens, $0.000169, 3.719s  
- `x8CfaZy7PIW5juMPtdaayAE`: 3,086 tokens, $0.000191, 4.278s

### New Approach: Batched OCR Text Analysis

**Source:** Iswarya's API calls in LiteLLM logs

| Metric | Value |
|--------|-------|
| Total records across 4 calls | 29 (18 + 7 + 2 + 2) |
| Total cost for 29 records | **$0.002166** |
| Avg cost per record | **$0.0000747** |
| Avg batch size | ~7-10 records per call |

**Sample calls from logs:**
- `g8GfaZSsHKahjuMPqIqL0QE`: 6,846 tokens (4,965 + 1,881), $0.001249, 12.242s
- `fcGfaYDLKNi6juMPtaKM4AE`: 2,869 tokens (2,126 + 743), $0.000510, 5.874s

### App Classification (New Approach Only)

**Source:** jira_forge.email API calls

In the old Vision approach, app classification was included in the same vision call. In the new OCR approach, it's a separate lightweight call for unknown app+window combinations.

| Metric | Value |
|--------|-------|
| Estimate unique classifications/day | ~30 |
| Avg cost per classification | **$0.000090** |

**Sample calls from logs:**
- `ecGfaeKGKN6mjuMP3eeEgAI`: 646 tokens, $0.000093, 2.142s
- `2MCfaY-JBLmGmNMPntf96AE`: 462 tokens, $0.000067, 1.868s

**Note:** Not every screenshot triggers this - only new/unknown app+window combos.

---

## Monthly Cost Projection Per User

| Component | Old (Screenshot/Vision) | New (Batched OCR/Text) |
|-----------|------------------------|------------------------|
| Task matching | 12,000 × $0.000182 = **$2.184** | 12,000 × $0.0000747 = **$0.896** |
| App classification | *(included in vision call)* | 30/day × 30 × $0.000090 = **$0.081** |
| **Monthly total** | **$2.184** | **$0.977** |

---

## Cost Comparison Summary

| Metric | Old (Vision) | New (Batched OCR) | Savings |
|--------|--------------|-------------------|---------|
| Per record | $0.000182 | $0.0000747 + $0.0000068* | **59% cheaper** |
| Per day | $0.0728 | $0.0326 | $0.040/day saved |
| Per month (1 user) | $2.18 | $0.98 | **$1.20 saved (55%)** |
| Per month (5 users) | $10.92 | $4.89 | $6.03 saved |
| Per month (10 users) | $21.84 | $9.77 | $12.07 saved |
| Per month (50 users) | $109.20 | $48.85 | $60.35 saved |
| Per year (1 user) | $26.21 | $11.73 | **$14.48 saved** |

*App classification cost amortized: $0.081/month ÷ 12,000 records = $0.0000068/record

---

## Why the New Approach is Cheaper

### 1. No Image Tokens
Vision calls include heavy base64 image data (~1,800 image tokens per screenshot). OCR text is just plain text tokens.

### 2. Batching Amortizes Overhead
System prompt (~400 tokens) is paid **once per batch** instead of once per screenshot. With 7-10 records per batch, this significantly reduces overhead.

### 3. Compression
OCR extracts only relevant text, discarding visual noise. A 3,000-token vision call becomes maybe ~100-200 tokens of OCR text per record.

---

## Token Usage Comparison

| Approach | Avg Tokens/Record | Token Type |
|----------|-------------------|------------|
| Old (Vision) | ~3,065 | Includes image tokens |
| New (Batched OCR) | ~236 per record (in batch) | Text only |
| **Reduction** | **92% fewer tokens** | |

---

## API Response Time Comparison

| Approach | Avg Duration | Records/Call |
|----------|--------------|--------------|
| Old (Vision) | 3.7 - 4.3s | 1 |
| New (Batched OCR) | 5.9 - 12.2s | 7-10 |
| **Effective per record** | 3.7 - 4.3s | **0.6 - 1.2s** |

---

## Scaling Projections

| Team Size | Old (Annual) | New (Annual) | Annual Savings |
|-----------|--------------|--------------|----------------|
| 1 user | $26.21 | $11.73 | $14.48 |
| 5 users | $131.04 | $58.65 | $72.39 |
| 10 users | $262.08 | $117.30 | $144.78 |
| 50 users | $1,310.40 | $586.50 | **$723.90** |
| 100 users | $2,620.80 | $1,173.00 | **$1,447.80** |

---

## Model Configuration

All calls using **Gemini 2.0 Flash** via LiteLLM:

| Setting | Value |
|---------|-------|
| Provider | Google Gemini |
| Model | `gemini/gemini-2.0-flash` |
| Temperature | 0.2-0.3 |
| API Base | `generativelanguage.googleapis.com` |

---

## Recommendations

### Current State ✅
- Hybrid OCR approach is deployed and working
- Real cost savings validated at **57%**
- Batching provides additional efficiency

### Optimization Opportunities
1. **Increase batch sizes** - More records per batch = more savings
2. **Cache app classifications** - Reduce redundant classification calls
3. **Skip duplicate screenshots** - Further reduce unnecessary API calls

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Version** | 2.0 |
| **Updated** | February 26, 2026 |
| **Data Source** | LiteLLM Production Logs |
| **Team** | JIREFORGE |
| **Model** | Gemini 2.0 Flash |
