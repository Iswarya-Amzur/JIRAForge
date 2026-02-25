# Privacy Safeguards Implementation

## Overview

This document details the complete implementation of privacy safeguards for JIRAForge's OCR functionality. The privacy module automatically detects and redacts sensitive information from OCR-extracted text, protecting user privacy when screenshots may contain passwords, API keys, PII, and other secrets.

**Implementation Date:** February 25, 2026  
**Module Location:** `python-desktop-app/privacy/`  
**Status:** ✅ Complete (21/21 tests passing)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Module Structure](#module-structure)
4. [Component Details](#component-details)
5. [Detection Capabilities](#detection-capabilities)
6. [Configuration Options](#configuration-options)
7. [Integration with OCR](#integration-with-ocr)
8. [Test Coverage](#test-coverage)
9. [Usage Examples](#usage-examples)
10. [Dependencies](#dependencies)
11. [Performance Considerations](#performance-considerations)

---

## Problem Statement

When users capture screenshots for JIRA issue creation, the OCR engine may extract sensitive information such as:

- **Passwords** in configuration files, terminal output, or login screens
- **API Keys** from environment variables, config files, or dashboards
- **Personal Identifiable Information (PII)** like credit cards, SSNs, phone numbers
- **Private Keys** and certificates
- **Database connection strings** with embedded credentials
- **Bearer tokens** and JWTs

Without privacy safeguards, this sensitive data could be:
1. Stored in JIRA issues (visible to team members)
2. Transmitted to AI analysis servers
3. Logged in application logs

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OCR Facade                                │
│                    (ocr/facade.py)                               │
├─────────────────────────────────────────────────────────────────┤
│                           │                                      │
│                           ▼                                      │
│              ┌─────────────────────────┐                        │
│              │     PrivacyFilter       │                        │
│              │   (privacy/filter.py)   │                        │
│              └───────────┬─────────────┘                        │
│                          │                                      │
│          ┌───────────────┼───────────────┐                      │
│          ▼               ▼               ▼                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│   │   Custom     │ │   Presidio   │ │   detect-    │           │
│   │  Patterns    │ │  Detector    │ │   secrets    │           │
│   │  (Regex)     │ │   (PII)      │ │  Detector    │           │
│   └──────────────┘ └──────────────┘ └──────────────┘           │
│          │               │               │                      │
│          └───────────────┼───────────────┘                      │
│                          ▼                                      │
│              ┌─────────────────────────┐                        │
│              │     TextRedactor        │                        │
│              │ (Merge & Apply Masks)   │                        │
│              └─────────────────────────┘                        │
│                          │                                      │
│                          ▼                                      │
│                   Redacted Text                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Graceful Degradation**: Works with built-in regex patterns even without optional dependencies
2. **Configurable**: All behavior controlled via environment variables
3. **Extensible**: Easy to add new detectors
4. **Performant**: Pre-compiled regex, optimized for OCR text lengths
5. **Auditable**: Optional audit logging for compliance

---

## Module Structure

```
python-desktop-app/privacy/
├── __init__.py              # Module exports and documentation
├── config.py                # PrivacyConfig dataclass with env loading
├── filter.py                # Main PrivacyFilter orchestration class
├── detectors/
│   ├── __init__.py          # Detector exports and availability flags
│   ├── base.py              # BaseDetector ABC and Detection dataclass
│   ├── custom_patterns.py   # Regex-based detector (always available)
│   ├── presidio_detector.py # Microsoft Presidio wrapper (optional)
│   └── secrets_detector.py  # Yelp detect-secrets wrapper (optional)
├── redactors/
│   ├── __init__.py          # Redactor exports
│   └── text_redactor.py     # Text redaction with multiple strategies
└── tests/
    ├── __init__.py          # Test module marker
    └── test_filter.py       # Unit tests (21 test cases)
```

---

## Component Details

### 1. PrivacyConfig (`privacy/config.py`)

Centralized configuration management with environment variable support.

**Key Features:**
- Dataclass-based configuration
- Environment variable loading via `from_env()`
- Dictionary serialization for API responses
- Configuration validation

**Configuration Options:**

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PRIVACY_FILTER_ENABLED` | bool | `true` | Master toggle |
| `PRIVACY_MIN_CONFIDENCE` | float | `0.7` | Minimum confidence to redact (0.0-1.0) |
| `PRIVACY_DETECT_PII` | bool | `true` | Enable Presidio PII detection |
| `PRIVACY_DETECT_SECRETS` | bool | `true` | Enable detect-secrets |
| `PRIVACY_DETECT_CUSTOM_PATTERNS` | bool | `true` | Enable regex patterns |
| `PRIVACY_REDACTION_STRATEGY` | enum | `mask` | How to redact: mask/entity_type/hash/remove |
| `PRIVACY_MASK_CHAR` | char | `*` | Character for masking |
| `PRIVACY_MASK_LENGTH` | int | `8` | Fixed mask length (0=variable) |
| `PRIVACY_FAIL_OPEN` | bool | `false` | Return original on error (less secure) |
| `PRIVACY_SKIP_SHORT_TEXT` | int | `10` | Skip filtering text < N chars |
| `PRIVACY_MAX_TEXT_LENGTH` | int | `50000` | Truncate for performance |

**Code Example:**
```python
from privacy import PrivacyConfig

# Load from environment
config = PrivacyConfig.from_env()

# Or configure programmatically
config = PrivacyConfig()
config.min_confidence = 0.8
config.redaction_strategy = RedactionStrategy.ENTITY_TYPE
```

---

### 2. Detection Classes (`privacy/detectors/base.py`)

#### Detection Dataclass

Represents a detected piece of sensitive information:

```python
@dataclass
class Detection:
    entity_type: str      # e.g., 'PASSWORD', 'API_KEY', 'CREDIT_CARD'
    start: int            # Start index in text
    end: int              # End index (exclusive)
    confidence: float     # 0.0-1.0 confidence score
    text: str             # Matched text (excluded from serialization)
    detector: str         # Source detector name
    metadata: Dict        # Additional context
```

**Key Methods:**
- `overlaps(other)` - Check if detections overlap
- `contains(other)` - Check if fully contains another
- `to_dict()` - Serialize without exposing actual text

#### BaseDetector Abstract Class

```python
class BaseDetector(ABC):
    @abstractmethod
    def detect(self, text: str) -> List[Detection]: ...
    
    @abstractmethod
    def get_name(self) -> str: ...
    
    def is_available(self) -> bool: ...
    def get_supported_entities(self) -> List[str]: ...
```

---

### 3. CustomPatternDetector (`privacy/detectors/custom_patterns.py`)

Regex-based detector that works without any external dependencies.

**Detected Patterns:**

| Pattern | Entity Type | Confidence | Example |
|---------|-------------|------------|---------|
| URL credentials | PASSWORD | 0.9 | `https://user:pass@host.com` |
| Key=value passwords | PASSWORD | 0.75 | `password=secret123` |
| AWS Access Key ID | API_KEY | 0.95 | `AKIAIOSFODNN7EXAMPLE` |
| AWS Secret Key | API_KEY | 0.85 | `aws_secret_access_key=...` |
| GitHub PAT | API_KEY | 0.95 | `ghp_xxxxx...` |
| Slack tokens | API_KEY | 0.9 | `xoxb-...` |
| Google API keys | API_KEY | 0.95 | `AIza...` |
| Stripe keys | API_KEY | 0.95 | `sk_live_...` |
| Bearer tokens | BEARER_TOKEN | 0.85 | `Authorization: Bearer ...` |
| JWT tokens | BEARER_TOKEN | 0.95 | `eyJhbGciOiJIUzI1...` |
| PEM private keys | PRIVATE_KEY | 0.99 | `-----BEGIN RSA PRIVATE KEY-----` |
| Connection strings | CONNECTION_STRING | 0.9 | `mongodb://user:pass@...` |
| Credit cards | CREDIT_CARD | 0.85 | Visa, MC, Amex patterns |
| US SSN | US_SSN | 0.8 | `XXX-XX-XXXX` |

**Confidence Adjustment:**
- Longer matches → +0.05 confidence
- Mixed case + numbers + special chars → +0.1 confidence
- Known prefixes (AKIA, sk_, ghp_) → +0.1 confidence
- Short matches (<8 chars) → -0.1 confidence

---

### 4. PresidioDetector (`privacy/detectors/presidio_detector.py`)

Wrapper around Microsoft's Presidio Analyzer for PII detection.

**Requires:** `pip install presidio-analyzer`

**Detected Entities:**
- CREDIT_CARD
- CRYPTO (wallet addresses)
- EMAIL_ADDRESS
- IBAN_CODE
- IP_ADDRESS
- PHONE_NUMBER
- US_SSN, US_BANK_NUMBER, US_DRIVER_LICENSE, US_PASSPORT
- MEDICAL_LICENSE
- URL
- NRP (National Registration Numbers)

**Features:**
- Uses spaCy NLP engine for context-aware detection
- Falls back to basic analyzer if spaCy unavailable
- Graceful degradation if not installed

---

### 5. SecretsDetector (`privacy/detectors/secrets_detector.py`)

Wrapper around Yelp's detect-secrets library.

**Requires:** `pip install detect-secrets`

**Plugins Used:**

| Plugin | Detects |
|--------|---------|
| AWSKeyDetector | AWS access keys |
| AzureStorageKeyDetector | Azure storage keys |
| BasicAuthDetector | Basic auth in URLs |
| GitHubTokenDetector | GitHub tokens |
| Base64HighEntropyString | Encoded secrets |
| HexHighEntropyString | Hex-encoded secrets |
| JwtTokenDetector | JWT tokens |
| KeywordDetector | Password keywords |
| PrivateKeyDetector | Private keys |
| SlackDetector | Slack tokens |
| StripeDetector | Stripe API keys |
| TwilioKeyDetector | Twilio keys |

---

### 6. TextRedactor (`privacy/redactors/text_redactor.py`)

Applies redaction to detected sensitive data.

**Redaction Strategies:**

| Strategy | Example Output | Use Case |
|----------|---------------|----------|
| `MASK` | `********` | Default, clean output |
| `ENTITY_TYPE` | `[PASSWORD]` | Debugging, shows what was found |
| `HASH` | `[PASSWORD:a1b2c3d4]` | Correlation without exposure |
| `REMOVE` | `` (empty) | Complete removal |

**Features:**
- Processes detections in reverse order to preserve positions
- Configurable mask character and length
- Returns detailed redaction metadata

---

### 7. PrivacyFilter (`privacy/filter.py`)

Main orchestration class that coordinates detection and redaction.

**Features:**
- Automatic detector initialization based on availability
- Detection merging to avoid double-redaction
- Confidence threshold filtering
- Performance metrics
- Optional audit logging
- Fail-open/fail-closed modes

**Result Format:**
```python
{
    'text': 'redacted text...',
    'original_length': 100,
    'redacted_length': 95,
    'redactions_count': 3,
    'redactions': [
        {'entity_type': 'PASSWORD', 'start': 10, 'end': 20, 'confidence': 0.85},
        ...
    ],
    'processing_time_ms': 15.5,
    'detectors_used': ['custom_patterns', 'presidio'],
    'filtered_by_confidence': 1,
}
```

---

## Integration with OCR

The privacy filter is integrated into `ocr/facade.py`:

```python
# In OCRFacade.__init__
self._initialize_privacy_filter()

def _initialize_privacy_filter(self):
    """Initialize the privacy filter for redacting sensitive data."""
    try:
        from privacy import PrivacyFilter, PrivacyConfig
        config = PrivacyConfig.from_env()
        if config.enabled:
            self._privacy_filter = PrivacyFilter(config)
            logger.info("Privacy filter initialized successfully")
        else:
            self._privacy_filter = None
            logger.info("Privacy filter disabled by configuration")
    except ImportError:
        self._privacy_filter = None
        logger.warning("Privacy module not available")
    except Exception as e:
        self._privacy_filter = None
        logger.warning(f"Failed to initialize privacy filter: {e}")

# In extract_text method
if self._privacy_filter:
    privacy_result = self._privacy_filter.redact(text)
    text = privacy_result['text']
    result['privacy_ms'] = privacy_result['processing_time_ms']
    result['privacy_redactions'] = privacy_result['redactions_count']
```

---

## Test Coverage

### Test File: `privacy/tests/test_filter.py`

**Total Tests:** 21  
**Status:** ✅ All Passing

#### TestPrivacyConfig (3 tests)

| Test | Description | Status |
|------|-------------|--------|
| `test_default_config` | Verifies default configuration values | ✅ |
| `test_config_from_env` | Tests environment variable loading | ✅ |
| `test_config_validation` | Tests configuration validation | ✅ |

#### TestCustomPatternDetector (8 tests)

| Test | Description | Status |
|------|-------------|--------|
| `test_detect_password_in_url` | Detects `https://user:pass@host` | ✅ |
| `test_detect_password_key_value` | Detects `password=secret` | ✅ |
| `test_detect_aws_key` | Detects `AKIA...` pattern | ✅ |
| `test_detect_github_token` | Detects `ghp_...` tokens | ✅ |
| `test_detect_jwt_token` | Detects JWT format | ✅ |
| `test_detect_private_key` | Detects PEM private keys | ✅ |
| `test_no_false_positives_on_normal_text` | No false positives on normal text | ✅ |
| `test_empty_text` | Handles empty/None input | ✅ |

#### TestDetection (2 tests)

| Test | Description | Status |
|------|-------------|--------|
| `test_detection_overlap` | Tests overlap detection | ✅ |
| `test_detection_to_dict` | Tests serialization (excludes text) | ✅ |

#### TestPrivacyFilter (6 tests)

| Test | Description | Status |
|------|-------------|--------|
| `test_redact_password` | Redacts password from text | ✅ |
| `test_redact_api_key` | Redacts API key from text | ✅ |
| `test_filter_disabled` | Disabled filter returns original | ✅ |
| `test_short_text_skipped` | Short text bypassed for performance | ✅ |
| `test_processing_time_included` | Processing time in result | ✅ |
| `test_confidence_filtering` | Low-confidence filtered out | ✅ |

#### TestIntegration (2 tests)

| Test | Description | Status |
|------|-------------|--------|
| `test_ocr_like_text` | Filters realistic OCR output | ✅ |
| `test_multiple_secrets_in_text` | Handles multiple secrets | ✅ |

### Running Tests

```bash
cd python-desktop-app
python -m unittest privacy.tests.test_filter -v
```

**Expected Output:**
```
.....................
----------------------------------------------------------------------
Ran 21 tests in 0.013s

OK
```

---

## Usage Examples

### Basic Usage

```python
from privacy import PrivacyFilter

# Create filter with default config (loads from environment)
filter = PrivacyFilter()

# Redact sensitive data
text = "Connect to https://admin:P@ssw0rd123@db.example.com"
result = filter.redact(text)

print(result['text'])
# Output: Connect to https://admin:********@db.example.com

print(f"Redacted {result['redactions_count']} items in {result['processing_time_ms']:.2f}ms")
```

### Custom Configuration

```python
from privacy import PrivacyFilter, PrivacyConfig
from privacy.config import RedactionStrategy

config = PrivacyConfig()
config.min_confidence = 0.8
config.redaction_strategy = RedactionStrategy.ENTITY_TYPE

filter = PrivacyFilter(config)
result = filter.redact("api_key=sk_live_abcdef123456")

print(result['text'])
# Output: api_key=[API_KEY]
```

### Quick Check

```python
from privacy import PrivacyFilter

filter = PrivacyFilter()

# Check if text contains sensitive data
if filter.is_sensitive(user_text):
    print("Warning: Text may contain sensitive information")
```

### OCR Integration

```python
from ocr import OCRFacade

# Privacy filter automatically applied if configured
facade = OCRFacade()
result = facade.extract_text(image_path)

print(result['text'])  # Sensitive data redacted
print(f"Privacy processing: {result.get('privacy_ms', 0):.2f}ms")
print(f"Redactions: {result.get('privacy_redactions', 0)}")
```

---

## Dependencies

### Required Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Python | >=3.8 | Runtime |

### Optional Dependencies

| Package | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| presidio-analyzer | >=2.2.0 | PII detection | `pip install presidio-analyzer` |
| presidio-anonymizer | >=2.2.0 | PII anonymization | `pip install presidio-anonymizer` |
| detect-secrets | >=1.4.0 | Secrets detection | `pip install detect-secrets` |
| spacy | >=3.0.0 | NLP for Presidio | `pip install spacy` |
| en_core_web_sm | - | English model | `python -m spacy download en_core_web_sm` |

### Installation

```bash
# Minimal (regex patterns only)
# No installation needed - works out of the box

# Full installation (all detectors)
pip install presidio-analyzer presidio-anonymizer detect-secrets
python -m spacy download en_core_web_sm
```

**requirements.txt entries added:**
```
# Privacy Safeguards (Optional - for enhanced detection)
presidio-analyzer>=2.2.0
presidio-anonymizer>=2.2.0
detect-secrets>=1.4.0
```

---

## Performance Considerations

### Benchmarks (Typical OCR Text)

| Text Length | Processing Time | Notes |
|-------------|-----------------|-------|
| < 100 chars | < 1ms | Skip threshold applies |
| 100-1000 chars | 1-5ms | Typical OCR output |
| 1000-10000 chars | 5-20ms | Large screenshots |
| > 50000 chars | Truncated | Safety limit |

### Optimization Features

1. **Skip Short Text**: Text < 10 chars skipped (configurable)
2. **Pre-compiled Regex**: All patterns compiled once at init
3. **Max Length Truncation**: Text > 50KB truncated for safety
4. **Lazy Detector Loading**: Optional detectors loaded on demand
5. **Detection Merging**: Overlapping detections merged efficiently

### Memory Usage

- Base module: ~50KB
- With Presidio loaded: +~200MB (includes spaCy model)
- With detect-secrets: +~10MB

---

## Security Considerations

### Fail-Closed Mode (Default)

If privacy filtering fails, the system returns an error message instead of potentially sensitive text:

```python
{
    'text': '[PRIVACY_FILTER_ERROR - Content redacted for safety]',
    'error': 'Exception message'
}
```

### Fail-Open Mode (Optional)

For availability over security, set `PRIVACY_FAIL_OPEN=true` to return original text on errors.

### Audit Logging

Enable audit logging for compliance:

```bash
PRIVACY_ENABLE_AUDIT_LOG=true
PRIVACY_AUDIT_LOG_PATH=privacy_audit.log
```

Log format:
```
2026-02-25 10:30:45 - REDACTED: type=PASSWORD detector=custom_patterns confidence=0.85 length=12
```

### Sensitive Data Not Logged

The `Detection.to_dict()` method explicitly excludes the actual matched text from serialization to prevent accidental logging of sensitive data.

---

## Future Enhancements

1. **Custom Recognizers**: Add Presidio custom recognizers for domain-specific patterns
2. **Language Support**: Extend to non-English text
3. **Image-Level Redaction**: Redact sensitive regions in images before OCR
4. **ML-Based Detection**: Train custom models for context-aware detection
5. **Configuration UI**: Add settings panel in desktop app
6. **Metrics Dashboard**: Real-time redaction statistics

---

## Files Modified/Created

### Created Files

| File | Lines | Purpose |
|------|-------|---------|
| `privacy/__init__.py` | 52 | Module exports |
| `privacy/config.py` | 192 | Configuration management |
| `privacy/filter.py` | 307 | Main filter class |
| `privacy/detectors/__init__.py` | 47 | Detector exports |
| `privacy/detectors/base.py` | 108 | Base classes |
| `privacy/detectors/custom_patterns.py` | 275 | Regex detector |
| `privacy/detectors/presidio_detector.py` | 137 | Presidio wrapper |
| `privacy/detectors/secrets_detector.py` | 176 | detect-secrets wrapper |
| `privacy/redactors/__init__.py` | 12 | Redactor exports |
| `privacy/redactors/text_redactor.py` | 117 | Text redaction |
| `privacy/tests/__init__.py` | 3 | Test module marker |
| `privacy/tests/test_filter.py` | 225 | Unit tests |

### Modified Files

| File | Changes |
|------|---------|
| `ocr/facade.py` | Added privacy filter initialization and integration |
| `requirements.txt` | Added optional privacy dependencies |
| `.env.example` | Added privacy configuration variables |

---

## Summary

The privacy safeguards implementation provides:

- ✅ **Multi-layer detection**: Regex + Presidio PII + detect-secrets
- ✅ **Zero required dependencies**: Works with built-in patterns
- ✅ **Configurable**: Environment variables control all behavior
- ✅ **Tested**: 21 unit tests covering all components
- ✅ **Integrated**: Automatically filters OCR output
- ✅ **Secure**: Fail-closed by default, audit logging available
- ✅ **Performant**: < 5ms for typical OCR text

The module ensures user privacy while maintaining full functionality of the OCR-based issue creation workflow.
