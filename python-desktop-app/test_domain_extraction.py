#!/usr/bin/env python
"""Test domain extraction logic"""
import sys
sys.path.insert(0, '.')

# Import just the extraction function logic
import re

def extract_domain_from_title(window_title):
    """Extract domain/site identifier from browser window title."""
    if not window_title:
        return ''
    
    title_lower = window_title.lower()
    
    # Common site patterns to extract
    site_patterns = [
        ('youtube', 'youtube'),
        ('github', 'github'),
        ('stackoverflow', 'stackoverflow'),
        ('stack overflow', 'stackoverflow'),
        ('google', 'google'),
        ('facebook', 'facebook'),
        ('twitter', 'twitter'),
        ('linkedin', 'linkedin'),
        ('reddit', 'reddit'),
        ('instagram', 'instagram'),
        ('amazon', 'amazon'),
        ('netflix', 'netflix'),
        ('spotify', 'spotify'),
        ('slack', 'slack'),
        ('discord', 'discord'),
        ('zoom', 'zoom'),
        ('teams', 'teams'),
        ('outlook', 'outlook'),
        ('gmail', 'gmail'),
        ('jira', 'jira'),
        ('atlassian', 'atlassian'),
        ('confluence', 'confluence'),
        ('bitbucket', 'bitbucket'),
        ('trello', 'trello'),
        ('notion', 'notion'),
        ('figma', 'figma'),
        ('canva', 'canva'),
        ('anthropic', 'anthropic'),
        ('openai', 'openai'),
        ('chatgpt', 'chatgpt'),
    ]
    
    for pattern, site_id in site_patterns:
        if pattern in title_lower:
            return site_id
    
    # Try to extract from URL-like patterns in title
    url_match = re.search(r'([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}', title_lower)
    if url_match:
        domain = url_match.group(0)
        parts = domain.split('.')
        if len(parts) >= 2:
            return parts[-2]
    
    # Fallback: use first word of title as identifier
    words = title_lower.split()
    if words:
        first_word = re.sub(r'[^a-z0-9]', '', words[0])
        if len(first_word) >= 3:
            return first_word
    
    return ''

# Test with actual window titles from the logs
titles = [
    'Anthropic Caught 3 Chinese AI Labs Stealing From C',
    'Fa9la | Official Flim Version | Rehman Dakait | Ra',
    'YouTube - AI Tutorial Video',
    'YouTube - Music Video Song',
    '(1) YouTube',
    'GitHub - AmzurATG/JIRAForge',
]

print('Domain extraction results:')
print('=' * 70)
for title in titles:
    domain = extract_domain_from_title(title)
    app_key = f"chrome.exe|{domain}" if domain else "chrome.exe"
    print(f'Title: "{title[:50]}"')
    print(f'  -> Domain: "{domain}"')
    print(f'  -> Key: "{app_key}"')
    print()
