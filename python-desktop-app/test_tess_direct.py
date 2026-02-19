import os
from dotenv import load_dotenv

# Load environment first
load_dotenv()

# Set TESSDATA_PREFIX before importing pytesseract
tessdata = os.getenv('TESSDATA_PREFIX')
print(f"TESSDATA_PREFIX from .env: {tessdata}")
if tessdata:
    os.environ['TESSDATA_PREFIX'] = tessdata

import pytesseract
from PIL import Image

# Set tesseract command
tesseract_cmd = os.getenv('TESSERACT_CMD')
if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
    print(f"Tesseract CMD: {tesseract_cmd}")

# Try to get version
try:
    version = pytesseract.get_tesseract_version()
    print(f"Tesseract version: {version}")
except Exception as e:
    print(f"Error getting version: {e}")

# Create a simple test image with text
img = Image.new('RGB', (200, 100), color='white')
from PIL import ImageDraw, ImageFont
draw = ImageDraw.Draw(img)
try:
    # Try to use default font
    draw.text((10, 30), "TEST", fill='black')
except:
    pass

# Try OCR with eng language
try:
    text = pytesseract.image_to_string(img, lang='eng')
    print(f"OCR Success with 'eng': {repr(text)}")
except Exception as e:
    print(f"OCR Failed with 'eng': {e}")

# Try with 'en' to see if that's the issue
try:
    text = pytesseract.image_to_string(img, lang='en')
    print(f"OCR Success with 'en': {repr(text)}")
except Exception as e:
    print(f"OCR Failed with 'en': {e}")
