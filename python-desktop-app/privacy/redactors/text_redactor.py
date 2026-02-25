"""
Text Redactor

Applies redaction to text based on detections.
"""
import hashlib
import logging
from typing import List, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)


class RedactionStrategy(str, Enum):
    """Available redaction strategies"""
    MASK = 'mask'              # Replace with asterisks: ********
    ENTITY_TYPE = 'entity_type'  # Replace with type: [PASSWORD]
    HASH = 'hash'              # Replace with hash: [a1b2c3d4]
    REMOVE = 'remove'          # Remove entirely


class TextRedactor:
    """
    Applies redaction to detected sensitive data.
    
    Supports multiple redaction strategies:
    - MASK: Replace with mask characters (e.g., ********)
    - ENTITY_TYPE: Replace with entity type (e.g., [PASSWORD])
    - HASH: Replace with truncated hash (for correlation without exposure)
    - REMOVE: Remove entirely
    
    Usage:
        redactor = TextRedactor(strategy=RedactionStrategy.MASK)
        clean_text = redactor.redact(text, detections)
    """
    
    def __init__(
        self,
        strategy: RedactionStrategy = RedactionStrategy.MASK,
        mask_char: str = '*',
        mask_length: int = 8
    ):
        """
        Initialize the redactor.
        
        Args:
            strategy: Redaction strategy to use
            mask_char: Character for masking (default: *)
            mask_length: Fixed mask length, 0 for variable (default: 8)
        """
        self.strategy = strategy
        self.mask_char = mask_char
        self.mask_length = mask_length
    
    def redact(self, text: str, detections: List[Dict[str, Any]]) -> str:
        """
        Apply redactions to text.
        
        Args:
            text: Original text
            detections: List of detection dicts with 'start', 'end', 'entity_type'
            
        Returns:
            Text with sensitive data redacted
        """
        if not text or not detections:
            return text
        
        # Sort detections by start position (descending) to process from end
        # This preserves positions as we modify the text
        sorted_detections = sorted(detections, key=lambda d: d['start'], reverse=True)
        
        result = text
        
        for detection in sorted_detections:
            start = detection.get('start', 0)
            end = detection.get('end', 0)
            entity_type = detection.get('entity_type', 'UNKNOWN')
            
            # Get the original text for this detection
            original = text[start:end] if end <= len(text) else ''
            
            # Generate replacement based on strategy
            replacement = self._get_replacement(original, entity_type)
            
            # Apply replacement
            result = result[:start] + replacement + result[end:]
        
        return result
    
    def _get_replacement(self, original: str, entity_type: str) -> str:
        """
        Generate replacement text based on strategy.
        
        Args:
            original: Original sensitive text
            entity_type: Type of entity
            
        Returns:
            Replacement string
        """
        if self.strategy == RedactionStrategy.MASK:
            if self.mask_length > 0:
                return self.mask_char * self.mask_length
            else:
                return self.mask_char * len(original)
        
        elif self.strategy == RedactionStrategy.ENTITY_TYPE:
            return f'[{entity_type}]'
        
        elif self.strategy == RedactionStrategy.HASH:
            # Create truncated hash for correlation
            hash_val = hashlib.sha256(original.encode()).hexdigest()[:8]
            return f'[{entity_type}:{hash_val}]'
        
        elif self.strategy == RedactionStrategy.REMOVE:
            return ''
        
        else:
            # Fallback to mask
            return self.mask_char * self.mask_length
    
    def redact_with_details(
        self,
        text: str,
        detections: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Apply redactions and return detailed results.
        
        Args:
            text: Original text
            detections: List of detection dicts
            
        Returns:
            Dict with redacted text and metadata
        """
        redacted = self.redact(text, detections)
        
        return {
            'text': redacted,
            'original_length': len(text),
            'redacted_length': len(redacted),
            'redactions_count': len(detections),
            'strategy': self.strategy.value,
        }
