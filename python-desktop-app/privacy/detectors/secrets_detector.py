"""
Secrets Detector

Wrapper around Yelp's detect-secrets library for finding secrets.
Requires: pip install detect-secrets
"""
import logging
from typing import List, Optional, Dict, Any

from .base import BaseDetector, Detection

logger = logging.getLogger(__name__)

# Check if detect-secrets is available
# Note: We catch (ImportError, OSError) because DLL loading can fail on Windows
SECRETS_AVAILABLE = False
try:
    from detect_secrets.core.scan import scan_line
    from detect_secrets.settings import transient_settings
    SECRETS_AVAILABLE = True
except ImportError:
    logger.debug("detect-secrets not available - install with: pip install detect-secrets")
except OSError as e:
    logger.warning(f"detect-secrets dependencies failed to load: {e}")


class SecretsDetector(BaseDetector):
    """
    Detect secrets using Yelp's detect-secrets library.
    
    Detects:
    - AWS Access Keys
    - Azure Storage Keys
    - Slack Tokens
    - Stripe Keys
    - GitHub Tokens
    - Private Keys
    - High Entropy Strings (potential passwords/keys)
    - Basic Auth Credentials
    - And more...
    
    Requires:
        pip install detect-secrets
    """
    
    # Default plugins to use (all available plugins)
    DEFAULT_PLUGINS = [
        {'name': 'ArtifactoryDetector'},
        {'name': 'AWSKeyDetector'},
        {'name': 'AzureStorageKeyDetector'},
        {'name': 'BasicAuthDetector'},
        {'name': 'CloudantDetector'},
        {'name': 'DiscordBotTokenDetector'},
        {'name': 'GitHubTokenDetector'},
        {'name': 'Base64HighEntropyString', 'limit': 4.5},
        {'name': 'HexHighEntropyString', 'limit': 3.0},
        {'name': 'IbmCloudIamDetector'},
        {'name': 'IbmCosHmacDetector'},
        {'name': 'JwtTokenDetector'},
        {'name': 'KeywordDetector'},
        {'name': 'MailchimpDetector'},
        {'name': 'NpmDetector'},
        {'name': 'PrivateKeyDetector'},
        {'name': 'SendGridDetector'},
        {'name': 'SlackDetector'},
        {'name': 'SoftlayerDetector'},
        {'name': 'SquareOAuthDetector'},
        {'name': 'StripeDetector'},
        {'name': 'TwilioKeyDetector'},
    ]
    
    # Mapping from detect-secrets plugin names to our entity types
    ENTITY_TYPE_MAP = {
        'ArtifactoryDetector': 'API_KEY',
        'AWSKeyDetector': 'API_KEY',
        'AzureStorageKeyDetector': 'API_KEY',
        'BasicAuthDetector': 'PASSWORD',
        'CloudantDetector': 'API_KEY',
        'DiscordBotTokenDetector': 'API_KEY',
        'GitHubTokenDetector': 'API_KEY',
        'Base64HighEntropyString': 'SECRET',
        'HexHighEntropyString': 'SECRET',
        'IbmCloudIamDetector': 'API_KEY',
        'IbmCosHmacDetector': 'API_KEY',
        'JwtTokenDetector': 'BEARER_TOKEN',
        'KeywordDetector': 'PASSWORD',
        'MailchimpDetector': 'API_KEY',
        'NpmDetector': 'API_KEY',
        'PrivateKeyDetector': 'PRIVATE_KEY',
        'SendGridDetector': 'API_KEY',
        'SlackDetector': 'API_KEY',
        'SoftlayerDetector': 'API_KEY',
        'SquareOAuthDetector': 'API_KEY',
        'StripeDetector': 'API_KEY',
        'TwilioKeyDetector': 'API_KEY',
    }
    
    def __init__(self, config=None):
        """
        Initialize detect-secrets detector.
        
        Args:
            config: Optional PrivacyConfig
        """
        self.config = config
        self._available = SECRETS_AVAILABLE
        self._plugins_config = self._get_plugins_config()
    
    def _get_plugins_config(self) -> List[Dict[str, Any]]:
        """Get the plugins configuration"""
        # Could be customized based on config in future
        return self.DEFAULT_PLUGINS
    
    def detect(self, text: str) -> List[Detection]:
        """
        Detect secrets in text using detect-secrets.
        
        Args:
            text: Text to scan
            
        Returns:
            List of Detection objects
        """
        if not self._available:
            return []
        
        if not text:
            return []
        
        try:
            detections = []
            
            # Configure plugins
            plugins_setting = {'plugins_used': self._plugins_config}
            
            # Process line by line (detect-secrets works line by line)
            with transient_settings(plugins_setting):
                lines = text.split('\n')
                current_pos = 0
                
                for line_num, line in enumerate(lines, 1):
                    # Scan the line
                    secrets = scan_line(line)
                    
                    for secret in secrets:
                        # Get the secret value and position
                        secret_value = secret.secret_value if hasattr(secret, 'secret_value') else str(secret)
                        plugin_name = secret.type if hasattr(secret, 'type') else 'Unknown'
                        
                        # Find position in line
                        try:
                            pos_in_line = line.index(secret_value) if secret_value in line else 0
                        except ValueError:
                            pos_in_line = 0
                        
                        # Calculate absolute position
                        start = current_pos + pos_in_line
                        end = start + len(secret_value)
                        
                        # Map to our entity type
                        entity_type = self.ENTITY_TYPE_MAP.get(plugin_name, 'SECRET')
                        
                        # Base confidence depends on detector type
                        confidence = self._get_confidence(plugin_name, secret_value)
                        
                        detection = Detection(
                            entity_type=entity_type,
                            start=start,
                            end=end,
                            confidence=confidence,
                            text=secret_value,
                            detector=self.get_name(),
                            metadata={
                                'plugin': plugin_name,
                                'line_number': line_num,
                            }
                        )
                        detections.append(detection)
                    
                    # Update position (add line length + newline char)
                    current_pos += len(line) + 1
            
            return detections
            
        except Exception as e:
            logger.warning(f"detect-secrets analysis failed: {e}")
            return []
    
    def _get_confidence(self, plugin_name: str, secret_value: str) -> float:
        """
        Get confidence score based on detector type.
        
        Args:
            plugin_name: Name of detect-secrets plugin
            secret_value: The detected secret
            
        Returns:
            Confidence score
        """
        # High entropy detectors are less certain
        if 'HighEntropy' in plugin_name:
            base_confidence = 0.6
            # Increase confidence for longer strings
            if len(secret_value) > 40:
                base_confidence = 0.75
        # Keyword detector needs context
        elif plugin_name == 'KeywordDetector':
            base_confidence = 0.7
        # Specific pattern detectors are more certain
        else:
            base_confidence = 0.85
        
        return base_confidence
    
    def get_name(self) -> str:
        """Get detector name"""
        return "detect_secrets"
    
    def is_available(self) -> bool:
        """Check if detect-secrets is available"""
        return self._available
    
    def get_supported_entities(self) -> List[str]:
        """Get list of entity types this detector can find"""
        return list(set(self.ENTITY_TYPE_MAP.values()))
