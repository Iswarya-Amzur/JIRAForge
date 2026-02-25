"""
Base Detector Classes

Abstract base class and data structures for privacy detectors.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class Detection:
    """
    Represents a detected piece of sensitive information.
    
    Attributes:
        entity_type: Type of sensitive data (e.g., 'PASSWORD', 'CREDIT_CARD')
        start: Start index in original text
        end: End index in original text (exclusive)
        confidence: Confidence score 0.0-1.0
        text: The matched text (for reference, should NOT be logged in production)
        detector: Name of detector that found this
        metadata: Additional detector-specific information
    """
    entity_type: str
    start: int
    end: int
    confidence: float
    text: str = ""
    detector: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def length(self) -> int:
        """Length of the detected text span"""
        return self.end - self.start
    
    def overlaps(self, other: 'Detection') -> bool:
        """Check if this detection overlaps with another"""
        return not (self.end <= other.start or self.start >= other.end)
    
    def contains(self, other: 'Detection') -> bool:
        """Check if this detection fully contains another"""
        return self.start <= other.start and self.end >= other.end
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization (excludes actual text)"""
        return {
            'entity_type': self.entity_type,
            'start': self.start,
            'end': self.end,
            'confidence': self.confidence,
            'detector': self.detector,
            'length': self.length,
        }
    
    def __repr__(self) -> str:
        return (
            f"Detection({self.entity_type}, [{self.start}:{self.end}], "
            f"conf={self.confidence:.2f}, detector={self.detector})"
        )


class BaseDetector(ABC):
    """
    Abstract base class for privacy detectors.
    
    All detector implementations should inherit from this class
    and implement the required methods.
    
    Example:
        class MyDetector(BaseDetector):
            def detect(self, text: str) -> List[Detection]:
                # Custom detection logic
                return [Detection(...)]
            
            def get_name(self) -> str:
                return "my_detector"
    """
    
    @abstractmethod
    def detect(self, text: str) -> List[Detection]:
        """
        Detect sensitive information in text.
        
        Args:
            text: The text to scan
            
        Returns:
            List of Detection objects for found sensitive data
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Get the human-readable name of this detector.
        
        Returns:
            Detector name (e.g., 'presidio', 'custom_patterns')
        """
        pass
    
    def is_available(self) -> bool:
        """
        Check if this detector is available (dependencies installed).
        
        Returns:
            True if detector can be used
        """
        return True
    
    def get_supported_entities(self) -> List[str]:
        """
        Get list of entity types this detector can find.
        
        Returns:
            List of entity type names
        """
        return []
    
    def validate_config(self) -> List[str]:
        """
        Validate detector configuration.
        
        Returns:
            List of validation issues (empty if valid)
        """
        return []
