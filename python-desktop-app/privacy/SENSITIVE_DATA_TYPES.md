# Sensitive Data Types for Masking

This document lists all sensitive information types that are detected and masked in OCR screenshots to protect user privacy.

**Last Updated:** February 26, 2026

---

## Detection Architecture

The privacy filter uses a **dual detection system**:

1. **Microsoft Presidio** (ENABLED) - For structured PII data with validated patterns
2. **Custom Regex Patterns** (ENABLED) - For secrets, API keys, and credentials

---

## Currently Active - Presidio PII Detection

These types are detected via Microsoft Presidio library with high-precision recognizers.

| Type | Entity Name | Example | Notes |
|------|-------------|---------|-------|
| Phone Number | `PHONE_NUMBER` | +1-555-123-4567, (555) 123-4567 | International formats |
| IP Address | `IP_ADDRESS` | 192.168.1.1, 2001:db8::1 | IPv4 and IPv6 |
| US Bank Number | `US_BANK_NUMBER` | Routing + Account numbers | Bank account info |
| US Driver License | `US_DRIVER_LICENSE` | State-specific formats | All 50 states |
| US Passport | `US_PASSPORT` | Passport numbers | US passport format |
| IBAN | `IBAN_CODE` | DE89370400440532013000 | International bank account |
| Crypto Wallet | `CRYPTO` | 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 | Bitcoin, Ethereum, etc. |
| NRP | `NRP` | National registration numbers | Various countries |
| Medical License | `MEDICAL_LICENSE` | Medical license numbers | Healthcare provider IDs |

---

## Currently Active - Custom Patterns

### Passwords & Credentials

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| Password (URL) | Credentials in URLs | `https://user:pass123@host.com` | 0.90 |
| Password (Key-Value) | `password=`, `pwd:`, `passwd=` | `password=secret123` | 0.75 |
| SSH Password | `ssh://user:pass@host` | `ssh://admin:secret@server` | 0.90 |
| Database Password | `DB_PASSWORD=`, `MYSQL_PWD=`, etc. | `DB_PASSWORD=secret123` | 0.90 |

### API Keys - Cloud Providers

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| AWS Access Key | `AKIA` + 16 alphanumeric | `AKIA1234567890ABCDEF` | 0.95 |
| AWS Secret Key | 40-char base64 | `aws_secret_access_key=xxxxxxxx...` | 0.85 |
| Google API Key | `AIza` + 35 chars | `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` | 0.95 |
| Azure Tenant ID | GUID with `tenant_id=` | `tenant_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 0.85 |
| Azure Client ID | GUID with `client_id=` | `client_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 0.80 |
| Firebase Config | Firebase object | `firebase={...apiKey...}` | 0.85 |
| Heroku API Key | UUID with `heroku_api_key=` | `heroku_api_key=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 0.90 |

### API Keys - Developer Tools

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| GitHub Token | `ghp_`, `ghs_` + 36 chars | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 0.95 |
| GitHub PAT | `github_pat_` prefix | `github_pat_xxxxxx_xxxxxx...` | 0.95 |
| Slack Token | `xoxb-`, `xoxp-`, etc. | `xoxb-123456789-xxxxxxxxxxxx` | 0.90 |
| NPM Token | `npm_` + 36 chars | `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 0.95 |
| PyPI Token | `pypi-` + 50+ chars | `pypi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 0.95 |

### API Keys - Payment & Communication

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| Stripe Live Secret | `sk_live_` + 24+ chars | `sk_live_[REDACTED_EXAMPLE]` | 0.95 |
| Stripe Live Public | `pk_live_` + 24+ chars | `pk_live_[REDACTED_EXAMPLE]` | 0.95 |
| Twilio Account SID | `AC` + 32 hex chars | `AC[32_HEX_CHARS]` | 0.95 |
| Twilio Auth Token | 32 hex after `auth_token=` | `twilio_auth_token=[32_HEX]` | 0.90 |
| SendGrid API Key | `SG.` + base64 | `SG.[BASE64_STRING].[BASE64_STRING]` | 0.95 |
| Mailchimp API Key | Key + datacenter | `[32_CHARS]-us1` | 0.90 |
| Mailgun API Key | `key-` + 32 hex | `key-[32_HEX_CHARS]` | 0.90 |

### OAuth & Authentication

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| OAuth Client Secret | `client_secret=` + 20+ chars | `client_secret=xxxxxxxxxxxxxxxxxxxxxxxx` | 0.90 |
| Bearer Token | `Bearer` or `Authorization:` | `Authorization: Bearer eyJhbG...` | 0.85 |
| JWT | Three base64 sections | `eyJhbGciOiJIUzI1NiJ9.eyJ...` | 0.95 |
| Generic API Key | `api_key=`, `apikey:` | `api_key=abc123def456ghi789` | 0.80 |

### Private Keys

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| RSA Private Key | PEM format | `-----BEGIN RSA PRIVATE KEY-----` | 0.99 |
| EC Private Key | PEM format | `-----BEGIN EC PRIVATE KEY-----` | 0.99 |
| DSA Private Key | PEM format | `-----BEGIN DSA PRIVATE KEY-----` | 0.99 |
| OpenSSH Private Key | OpenSSH format | `-----BEGIN OPENSSH PRIVATE KEY-----` | 0.99 |
| Generic Private Key | Any PEM private key | `-----BEGIN PRIVATE KEY-----` | 0.99 |

### Connection Strings

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| MongoDB URL | `mongodb://` with creds | `mongodb://user:pass@host:27017/db` | 0.90 |
| PostgreSQL URL | `postgresql://` with creds | `postgresql://user:pass@host:5432/db` | 0.90 |
| MySQL URL | `mysql://` with creds | `mysql://user:pass@host:3306/db` | 0.90 |
| Redis URL | `redis://` with creds | `redis://user:pass@host:6379` | 0.90 |
| SQL Server URL | `mssql://` or `sqlserver://` | `mssql://user:pass@host/db` | 0.90 |
| ADO.NET Style | `Password=` in connection | `Server=x;Password=secret` | 0.85 |

### Encryption & Security

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| Encryption Key | `ENCRYPTION_KEY=`, `AES_KEY=` | `ENCRYPTION_KEY=base64string` | 0.85 |
| Docker Auth | `docker_auth=` + base64 | `docker_auth=xxxxxxxxxxxxxxxx` | 0.85 |

### Financial Data (Custom Patterns)

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| Credit Card (Visa) | 16 digits starting with 4 | `4532123456789012` | 0.85 |
| Credit Card (MasterCard) | 16 digits starting with 51-55 | `5412345678901234` | 0.85 |
| Credit Card (Amex) | 15 digits starting with 34/37 | `371234567890123` | 0.85 |
| US SSN | `XXX-XX-XXXX` format | `123-45-6789` | 0.80 |

### Internal Network Information

| Type | Pattern | Example | Confidence |
|------|---------|---------|------------|
| Internal IP (Class A) | `10.x.x.x` | `10.0.0.1` | 0.75 |
| Internal IP (Class B) | `172.16-31.x.x` | `172.16.0.1` | 0.75 |
| Internal IP (Class C) | `192.168.x.x` | `192.168.1.1` | 0.75 |

---

## Disabled Presidio Types (Available but not enabled)

These types are available in Presidio but disabled due to high false-positive rates in OCR text.

| Type | Entity Name | Why Disabled |
|------|-------------|--------------|
| Person Name | `PERSON` | NLP-based, many false positives |
| Location | `LOCATION` | NLP-based, many false positives |
| Email Address | `EMAIL_ADDRESS` | Usually not sensitive in work context |
| URL | `URL` | Too many legitimate URLs |
| Credit Card | `CREDIT_CARD` | Using custom pattern instead |
| US SSN | `US_SSN` | Using custom pattern instead |
| Date/Time | `DATE_TIME` | Rarely sensitive |

---

## Future Considerations (Not Yet Implemented)

| Type | Pattern | Example | Priority |
|------|---------|---------|----------|
| NuGet API Key | GUID format | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | 🟡 Medium |
| RubyGems API Key | 32 hex chars | `rubygems_xxxxxxxxxxxxxxxxxxxxxxxx` | 🟡 Medium |
| Session ID | Cookie values | `JSESSIONID=xxxx` | 🟡 Medium |
| CSRF Token | Form field values | `csrf_token=xxxx` | 🟡 Medium |
| OAuth Refresh Token | Long tokens | `refresh_token=xxxxx` | 🟡 Medium |
| Internal Hostname | `.local`, `.corp` | `server01.corp.company.com` | 🟡 Medium |

---

## Detection Statistics Summary

| Category | Custom Patterns | Presidio Types | Total |
|----------|-----------------|----------------|-------|
| Passwords & Credentials | 4 | 0 | 4 |
| API Keys (Cloud) | 7 | 0 | 7 |
| API Keys (Developer) | 5 | 0 | 5 |
| API Keys (Payment/Comm) | 7 | 0 | 7 |
| OAuth & Auth | 4 | 0 | 4 |
| Private Keys | 5 | 0 | 5 |
| Connection Strings | 6 | 0 | 6 |
| Encryption & Security | 2 | 0 | 2 |
| Financial Data | 4 | 0 | 4 |
| Internal Network | 3 | 0 | 3 |
| PII (Presidio) | 0 | 9 | 9 |
| **Total** | **47** | **9** | **56** |

---

## Configuration Reference

Current configuration in `privacy/config.py`:

```python
PrivacyConfig(
    detect_pii=True,            # ✅ Presidio PII detection ENABLED
    detect_secrets=False,       # detect-secrets library (disabled)
    detect_custom_patterns=True, # ✅ Custom regex patterns ENABLED
    min_confidence=0.7,         # Minimum confidence threshold
    pii_types=[
        'PHONE_NUMBER',
        'IP_ADDRESS',
        'US_BANK_NUMBER',
        'US_DRIVER_LICENSE',
        'US_PASSPORT',
        'IBAN_CODE',
        'CRYPTO',
        'NRP',
        'MEDICAL_LICENSE',
    ],
)
```

See [PRESIDIO_INTEGRATION_GUIDE.md](./PRESIDIO_INTEGRATION_GUIDE.md) for detailed setup instructions.
