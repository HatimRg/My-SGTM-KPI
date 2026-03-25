#!/bin/bash
# QR System Python Dependencies Setup Tool
# Run: chmod +x setup_python_deps.sh && ./setup_python_deps.sh

echo "=========================================="
echo "QR System Python Dependencies Setup Tool"
echo "=========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python is not installed"
    echo "Please install Python 3.8+"
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)
echo "[OK] Python detected:"
$PYTHON_CMD --version
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIREMENTS="$SCRIPT_DIR/requirements.txt"

if [ ! -f "$REQUIREMENTS" ]; then
    echo "[ERROR] requirements.txt not found at: $REQUIREMENTS"
    exit 1
fi

echo "[INFO] Installing dependencies from requirements.txt..."
echo ""

# Install/upgrade pip first
$PYTHON_CMD -m pip install --upgrade pip

# Install requirements
$PYTHON_CMD -m pip install -r "$REQUIREMENTS"

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

echo ""
echo "=========================================="
echo "[SUCCESS] All dependencies installed!"
echo "=========================================="
echo ""
echo "Installed packages:"
$PYTHON_CMD -m pip list | grep -iE "qrcode|pillow|pptx"
echo ""
