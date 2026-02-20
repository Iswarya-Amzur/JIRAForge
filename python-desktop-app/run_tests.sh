#!/bin/bash
# Quick Start Script for Running Productivity Tracking System Tests
# 
# This script provides an easy way to run the test suite

echo "=========================================="
echo "Productivity Tracking System - Test Runner"
echo "=========================================="
echo ""

# Check if Python is available
if ! command -v python &> /dev/null
then
    echo "❌ Python not found. Please install Python 3.7+ first."
    exit 1
fi

echo "✓ Python found: $(python --version)"
echo ""

# Install required dependencies
echo "📦 Checking dependencies..."
pip install -q pillow psutil requests python-dotenv supabase 2>/dev/null

echo ""
echo "Available test categories:"
echo "  1) All tests (default)"
echo "  2) Classification tests only"
echo "  3) OCR tests only"
echo "  4) Session management tests only"
echo "  5) Batch analysis tests only"
echo "  6) Integration tests only"
echo ""

# Read user choice
read -p "Select option (1-6): " choice

echo ""
echo "=========================================="
echo ""

case $choice in
    2)
        echo "Running Classification Tests..."
        python test_productivity_tracking_system.py --classification
        ;;
    3)
        echo "Running OCR Tests..."
        python test_productivity_tracking_system.py --ocr
        ;;
    4)
        echo "Running Session Management Tests..."
        python test_productivity_tracking_system.py --session
        ;;
    5)
        echo "Running Batch Analysis Tests..."
        python test_productivity_tracking_system.py --batch
        ;;
    6)
        echo "Running Integration Tests..."
        python test_productivity_tracking_system.py --integration
        ;;
    *)
        echo "Running All Tests..."
        python test_productivity_tracking_system.py
        ;;
esac

echo ""
echo "=========================================="
echo "Test run complete!"
echo "=========================================="
