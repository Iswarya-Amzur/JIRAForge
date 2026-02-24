"""
Test Fixtures Generator
Creates sample images for OCR testing

Usage:
    python -m tests.generate_fixtures
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np


class FixtureGenerator:
    """Generate test images for OCR testing"""
    
    def __init__(self, output_dir='tests/fixtures'):
        self.output_dir = Path(__file__).parent / 'fixtures'
        self.output_dir.mkdir(exist_ok=True)
        print(f"✓ Output directory: {self.output_dir}")
    
    def create_simple_text(self, text="Hello World", filename="simple_text.png"):
        """Create simple text image"""
        img = Image.new('RGB', (800, 200), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 60)
        except:
            font = ImageFont.load_default()
        
        # Center text
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((800 - text_width) // 2, (200 - text_height) // 2)
        
        draw.text(position, text, fill='black', font=font)
        
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - '{text}'")
        return img
    
    def create_multiline_text(self, filename="multiline_text.png"):
        """Create multi-line text image"""
        img = Image.new('RGB', (1000, 400), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except:
            font = ImageFont.load_default()
        
        lines = [
            "JIRAForge Time Tracker",
            "Testing OCR Functionality",
            "Multiple Lines of Text"
        ]
        
        y = 50
        for line in lines:
            draw.text((50, y), line, fill='black', font=font)
            y += 100
        
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - {len(lines)} lines")
        return img
    
    def create_low_contrast(self, filename="low_contrast.png"):
        """Create low contrast text (challenging)"""
        img = Image.new('RGB', (800, 200), color=(220, 220, 220))
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 50)
        except:
            font = ImageFont.load_default()
        
        # Gray text on light gray background
        draw.text((50, 70), "Low Contrast Text", fill=(150, 150, 150), font=font)
        
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - challenging contrast")
        return img
    
    def create_noisy_image(self, filename="noisy_text.png"):
        """Create text with noise"""
        img = Image.new('RGB', (800, 200), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 50)
        except:
            font = ImageFont.load_default()
        
        draw.text((50, 70), "Text with Noise", fill='black', font=font)
        
        # Add noise
        np_img = np.array(img)
        noise = np.random.randint(-30, 30, np_img.shape, dtype=np.int16)
        np_img = np.clip(np_img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        
        img = Image.fromarray(np_img)
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - with random noise")
        return img
    
    def create_rotated_text(self, filename="rotated_text.png"):
        """Create slightly rotated text"""
        # Create larger canvas
        img = Image.new('RGB', (1000, 400), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 50)
        except:
            font = ImageFont.load_default()
        
        draw.text((100, 150), "Slightly Rotated", fill='black', font=font)
        
        # Rotate slightly
        img = img.rotate(5, fillcolor='white', expand=False)
        
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - 5° rotation")
        return img
    
    def create_mixed_fonts(self, filename="mixed_fonts.png"):
        """Create image with different font sizes"""
        img = Image.new('RGB', (1000, 400), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font_large = ImageFont.truetype("arial.ttf", 60)
            font_medium = ImageFont.truetype("arial.ttf", 40)
            font_small = ImageFont.truetype("arial.ttf", 25)
        except:
            font_large = font_medium = font_small = ImageFont.load_default()
        
        draw.text((50, 50), "Large Text", fill='black', font=font_large)
        draw.text((50, 150), "Medium Text", fill='black', font=font_medium)
        draw.text((50, 250), "Small Text for Testing", fill='black', font=font_small)
        
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - mixed sizes")
        return img
    
    def create_document_like(self, filename="document.png"):
        """Create document-like image"""
        img = Image.new('RGB', (1200, 800), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            font_title = ImageFont.truetype("arial.ttf", 48)
            font_body = ImageFont.truetype("arial.ttf", 24)
        except:
            font_title = font_body = ImageFont.load_default()
        
        # Title
        draw.text((50, 50), "Meeting Notes - OCR Test", fill='black', font=font_title)
        
        # Body text
        body_lines = [
            "Date: February 19, 2026",
            "Attendees: John, Sarah, Mike",
            "",
            "Topics Discussed:",
            "- OCR integration for time tracking",
            "- Facade pattern implementation",
            "- Dynamic engine configuration",
            "- Database schema updates",
            "",
            "Action Items:",
            "1. Test all OCR engines",
            "2. Update documentation",
            "3. Deploy to production"
        ]
        
        y = 150
        for line in body_lines:
            draw.text((50, y), line, fill='black', font=font_body)
            y += 40
        
        filepath = self.output_dir / filename
        img.save(filepath)
        print(f"✓ Created: {filename} - document style with {len(body_lines)} lines")
        return img
    
    def create_all_fixtures(self):
        """Generate all test fixtures"""
        print("\n" + "="*70)
        print(" 🎨 GENERATING OCR TEST FIXTURES")
        print("="*70 + "\n")
        
        fixtures = [
            ("simple_text.png", lambda: self.create_simple_text("Hello World")),
            ("simple_text_long.png", lambda: self.create_simple_text("The Quick Brown Fox Jumps", "simple_text_long.png")),
            ("multiline_text.png", lambda: self.create_multiline_text()),
            ("low_contrast.png", lambda: self.create_low_contrast()),
            ("noisy_text.png", lambda: self.create_noisy_image()),
            ("rotated_text.png", lambda: self.create_rotated_text()),
            ("mixed_fonts.png", lambda: self.create_mixed_fonts()),
            ("document.png", lambda: self.create_document_like()),
        ]
        
        for name, generator in fixtures:
            try:
                generator()
            except Exception as e:
                print(f"❌ Failed to create {name}: {e}")
        
        print(f"\n{'='*70}")
        print(f" ✅ Generated {len(fixtures)} test fixtures")
        print(f" 📁 Location: {self.output_dir.absolute()}")
        print("="*70 + "\n")
        
        # Show usage
        print("💡 Usage:")
        print("  python -m tests.test_ocr_engines --image tests/fixtures/simple_text.png")
        print("  python -m tests.test_ocr_engines --image tests/fixtures/document.png")
        print()


def main():
    """Generate all fixtures"""
    generator = FixtureGenerator()
    generator.create_all_fixtures()


if __name__ == "__main__":
    main()
