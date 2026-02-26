# Microsoft Presidio Integration Guide

This guide explains how to enable and configure Microsoft Presidio for enhanced PII detection in the privacy filtering module.

---

## What is Presidio?

[Microsoft Presidio](https://github.com/microsoft/presidio) is an open-source SDK for PII (Personally Identifiable Information) detection and anonymization. It uses:

- **NLP Models** (spaCy) for named entity recognition (names, locations, organizations)
- **Regex Patterns** for structured data (emails, phone numbers, credit cards)
- **Checksums/Validation** for financial data (credit cards with Luhn validation)
- **Context Analysis** for improved accuracy

---

## Installation

### Step 1: Install Dependencies

```bash
# Navigate to the desktop app directory
cd python-desktop-app

# Activate virtual environment
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/macOS

# Install Presidio packages
pip install presidio-analyzer presidio-anonymizer

# Install spaCy English model (required for NLP-based detection)
python -m spacy download en_core_web_lg
```

### Step 2: Verify Installation

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

# Test analyzer
analyzer = AnalyzerEngine()
results = analyzer.analyze(text="John Smith's email is john@example.com", language="en")
print(f"Found {len(results)} entities")

# Test anonymizer
anonymizer = AnonymizerEngine()
anonymized = anonymizer.anonymize(text="John Smith's email is john@example.com", analyzer_results=results)
print(f"Anonymized: {anonymized.text}")
```

Expected output:
```
Found 2 entities
Anonymized: <PERSON>'s email is <EMAIL_ADDRESS>
```

---

## Configuration

### Enable Presidio in Privacy Config

Edit `privacy/config.py` or set environment variables:

#### Option 1: Programmatic Configuration

```python
from privacy.config import PrivacyConfig

config = PrivacyConfig(
    enabled=True,
    detect_pii=True,              # Enable Presidio
    detect_custom_patterns=True,   # Keep custom patterns for passwords/API keys
    min_confidence=0.7,           # Only detect high-confidence matches
    pii_types=[                   # Specify which PII types to detect
        'CREDIT_CARD',
        'EMAIL_ADDRESS',
        'PHONE_NUMBER',
        'US_SSN',
        'IP_ADDRESS',
        # 'PERSON',              # Uncomment to enable name detection
        # 'LOCATION',            # Uncomment to enable location detection
    ],
)
```

#### Option 2: Environment Variables

```bash
# Windows PowerShell
$env:PRIVACY_FILTER_ENABLED = "true"
$env:PRIVACY_DETECT_PII = "true"
$env:PRIVACY_MIN_CONFIDENCE = "0.7"
$env:PRIVACY_PII_TYPES = "CREDIT_CARD,EMAIL_ADDRESS,PHONE_NUMBER,US_SSN"

# Linux/macOS
export PRIVACY_FILTER_ENABLED=true
export PRIVACY_DETECT_PII=true
export PRIVACY_MIN_CONFIDENCE=0.7
export PRIVACY_PII_TYPES=CREDIT_CARD,EMAIL_ADDRESS,PHONE_NUMBER,US_SSN
```

---

## Entity Types Reference

### High-Precision Entities (Recommended)

These entities have low false-positive rates:

| Entity | Description | Example |
|--------|-------------|---------|
| `CREDIT_CARD` | Credit card numbers with Luhn validation | 4532-1234-5678-9012 |
| `US_SSN` | US Social Security Numbers | 123-45-6789 |
| `EMAIL_ADDRESS` | Email addresses | user@example.com |
| `PHONE_NUMBER` | Phone numbers (international formats) | +1-555-123-4567 |
| `IP_ADDRESS` | IPv4 and IPv6 addresses | 192.168.1.1 |
| `IBAN_CODE` | International Bank Account Numbers | DE89370400440532013000 |
| `CRYPTO` | Cryptocurrency wallet addresses | 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 |

### NLP-Based Entities (Use with Caution)

These entities use NLP and may have false positives in OCR text:

| Entity | Description | Example | False Positive Risk |
|--------|-------------|---------|---------------------|
| `PERSON` | Person names | John Smith | ⚠️ High |
| `LOCATION` | Locations, addresses | New York, 123 Main St | ⚠️ High |
| `NRP` | Nationality, Religion, Political group | American, Catholic | ⚠️ Medium |
| `MEDICAL_LICENSE` | Medical license numbers | Various formats | 🟡 Medium |
| `US_DRIVER_LICENSE` | US driver's license numbers | State-specific | 🟡 Medium |
| `US_PASSPORT` | US passport numbers | Various formats | 🟢 Low |
| `US_BANK_NUMBER` | US bank account numbers | Routing + Account | 🟡 Medium |

---

## Recommended Configurations

### Configuration 1: Minimal (Lowest False Positives)

Best for OCR text with mixed content:

```python
PrivacyConfig(
    detect_pii=True,
    detect_custom_patterns=True,
    min_confidence=0.85,  # High threshold
    pii_types=[
        'CREDIT_CARD',
        'US_SSN',
        'IBAN_CODE',
    ],
)
```

### Configuration 2: Balanced

Good balance of coverage and accuracy:

```python
PrivacyConfig(
    detect_pii=True,
    detect_custom_patterns=True,
    min_confidence=0.7,
    pii_types=[
        'CREDIT_CARD',
        'US_SSN',
        'EMAIL_ADDRESS',
        'PHONE_NUMBER',
        'IP_ADDRESS',
        'IBAN_CODE',
        'CRYPTO',
    ],
)
```

### Configuration 3: Maximum Coverage

Use when privacy is critical and some false positives are acceptable:

```python
PrivacyConfig(
    detect_pii=True,
    detect_custom_patterns=True,
    min_confidence=0.6,
    pii_types=[
        'CREDIT_CARD',
        'US_SSN',
        'EMAIL_ADDRESS',
        'PHONE_NUMBER',
        'IP_ADDRESS',
        'IBAN_CODE',
        'CRYPTO',
        'PERSON',
        'LOCATION',
        'US_DRIVER_LICENSE',
        'US_PASSPORT',
        'US_BANK_NUMBER',
        'MEDICAL_LICENSE',
    ],
)
```

---

## Custom Recognizers

You can add custom recognizers to Presidio for domain-specific patterns.

### Example: Add Internal Employee ID Recognizer

```python
from presidio_analyzer import Pattern, PatternRecognizer

# Create a recognizer for employee IDs (e.g., EMP-12345)
employee_recognizer = PatternRecognizer(
    supported_entity="EMPLOYEE_ID",
    patterns=[
        Pattern(
            name="employee_id_pattern",
            regex=r"\bEMP-\d{5}\b",
            score=0.9
        )
    ]
)

# Add to analyzer
analyzer = AnalyzerEngine()
analyzer.registry.add_recognizer(employee_recognizer)
```

### Example: Add Internal System URL Recognizer

```python
internal_url_recognizer = PatternRecognizer(
    supported_entity="INTERNAL_URL",
    patterns=[
        Pattern(
            name="internal_corp_url",
            regex=r"https?://[a-zA-Z0-9.-]+\.corp\.company\.com[^\s]*",
            score=0.85
        ),
        Pattern(
            name="internal_local_url",
            regex=r"https?://[a-zA-Z0-9.-]+\.internal[^\s]*",
            score=0.85
        )
    ]
)
```

---

## Context Enhancement

Presidio can use context words to improve detection accuracy:

```python
from presidio_analyzer import PatternRecognizer, Pattern

# SSN recognizer with context enhancement
ssn_recognizer = PatternRecognizer(
    supported_entity="US_SSN",
    patterns=[
        Pattern(
            name="ssn_pattern",
            regex=r"\b\d{3}-\d{2}-\d{4}\b",
            score=0.5  # Base score
        )
    ],
    context=["ssn", "social security", "tax id", "taxpayer"]  # Context words boost score
)
```

When context words are found near the pattern, the confidence score increases.

---

## Performance Optimization

### 1. Use Smaller spaCy Model

For faster processing with slightly lower accuracy:

```bash
# Use small model instead of large
python -m spacy download en_core_web_sm

# In code, specify the model
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider

# Configure smaller model
provider = NlpEngineProvider(nlp_configuration={
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}]
})

analyzer = AnalyzerEngine(nlp_engine=provider.create_engine())
```

### 2. Disable NLP-Based Detection

For maximum speed, disable person/location detection:

```python
PrivacyConfig(
    detect_pii=True,
    pii_types=[
        'CREDIT_CARD',
        'EMAIL_ADDRESS',
        'PHONE_NUMBER',
        'US_SSN',
        # Exclude PERSON, LOCATION - these require NLP
    ],
)
```

### 3. Text Length Limits

Set maximum text length to prevent slow processing:

```python
PrivacyConfig(
    max_text_length=50000,  # Truncate text longer than 50KB
    skip_short_text=10,     # Skip text shorter than 10 chars
)
```

---

## Troubleshooting

### Issue: Too Many False Positives

**Symptoms:** Normal text is being masked incorrectly.

**Solutions:**
1. Increase `min_confidence` threshold to 0.8 or higher
2. Remove `PERSON` and `LOCATION` from `pii_types`
3. Add a deny list for common false positives

```python
# Example: Add deny list
deny_list = ["Chrome", "Windows", "Microsoft", "Loading", "Version"]
```

### Issue: spaCy Model Not Found

**Symptoms:** `OSError: [E050] Can't find model 'en_core_web_lg'`

**Solution:**
```bash
python -m spacy download en_core_web_lg
```

### Issue: DLL Load Failure (Windows)

**Symptoms:** `OSError: [WinError 126] The specified module could not be found`

**Solution:** This is a PyTorch/spaCy compatibility issue. The codebase already handles this with a try/except wrapper.

### Issue: Slow Processing

**Symptoms:** Privacy filtering takes too long.

**Solutions:**
1. Use smaller spaCy model (`en_core_web_sm`)
2. Disable NLP-based entity types
3. Reduce `max_text_length`
4. Process text in chunks

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Privacy Filter Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐                                        │
│  │   OCR Text      │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────┐                │
│  │  1. Custom Patterns (Always First)      │ ← Passwords,   │
│  │     - Password patterns                  │   API keys,    │
│  │     - API key patterns                   │   tokens       │
│  │     - Private key patterns               │                │
│  └────────┬────────────────────────────────┘                │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────┐                │
│  │  2. Presidio Analyzer (If Enabled)      │ ← PII types    │
│  │     - NLP-based detection (names)        │   configured   │
│  │     - Pattern-based (emails, phones)     │   above        │
│  │     - Validated (credit cards)           │                │
│  └────────┬────────────────────────────────┘                │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────┐                │
│  │  3. Confidence Filtering                │                │
│  │     - Keep only results >= threshold     │                │
│  │     - Deduplicate overlapping matches    │                │
│  └────────┬────────────────────────────────┘                │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────────┐                │
│  │  4. Anonymizer                          │ ← Mask with    │
│  │     - Apply redaction strategy           │   ********     │
│  │     - Generate masked text               │                │
│  └────────┬────────────────────────────────┘                │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  Masked Text    │                                        │
│  └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install

```bash
pip install presidio-analyzer presidio-anonymizer
python -m spacy download en_core_web_lg
```

### 2. Enable

Edit `privacy/config.py`:

```python
'detect_pii': True,
'min_confidence': 0.7,
'pii_types': ['CREDIT_CARD', 'EMAIL_ADDRESS', 'PHONE_NUMBER', 'US_SSN'],
```

Or set environment variable:

```bash
$env:PRIVACY_DETECT_PII = "true"
```

### 3. Test

```bash
cd python-desktop-app
.\venv\Scripts\python.exe -m pytest privacy/tests/ -v
```

---

## References

- [Presidio Documentation](https://microsoft.github.io/presidio/)
- [Presidio GitHub Repository](https://github.com/microsoft/presidio)
- [Supported Entity Types](https://microsoft.github.io/presidio/supported_entities/)
- [spaCy Models](https://spacy.io/models/en)
- [Custom Recognizers Guide](https://microsoft.github.io/presidio/analyzer/adding_recognizers/)
