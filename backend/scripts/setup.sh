#!/bin/bash
# QR System Setup Tool
# Python Dependencies + LibreOffice
# Run: chmod +x setup.sh && ./setup.sh

echo "=========================================="
echo "QR System Setup Tool"
echo "Python Dependencies + LibreOffice"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIREMENTS="$SCRIPT_DIR/requirements.txt"

# ==========================================
# Check Python
# ==========================================
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERROR] Python is not installed"
    echo "Please install Python 3.8+"
    exit 1
fi

PYTHON_CMD=$(command -v python3 || command -v python)
echo "[OK] Python detected:"
$PYTHON_CMD --version
echo ""

# ==========================================
# Install Python Dependencies
# ==========================================
if [ ! -f "$REQUIREMENTS" ]; then
    echo "[ERROR] requirements.txt not found at: $REQUIREMENTS"
    exit 1
fi

echo "[INFO] Installing Python dependencies..."
$PYTHON_CMD -m pip install --upgrade pip -q
$PYTHON_CMD -m pip install -r "$REQUIREMENTS"
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install Python dependencies"
    exit 1
fi
echo "[OK] Python dependencies installed"
echo ""

# ==========================================
# Check / Install LibreOffice
# ==========================================
echo "[INFO] Checking for LibreOffice..."

SOFFICE_FOUND=0
SOFFICE_PATH=""

# Check common paths
if command -v soffice &> /dev/null; then
    SOFFICE_FOUND=1
    SOFFICE_PATH=$(command -v soffice)
elif [ -f "/usr/bin/soffice" ]; then
    SOFFICE_FOUND=1
    SOFFICE_PATH="/usr/bin/soffice"
elif [ -f "/usr/lib/libreoffice/program/soffice" ]; then
    SOFFICE_FOUND=1
    SOFFICE_PATH="/usr/lib/libreoffice/program/soffice"
elif [ -f "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
    SOFFICE_FOUND=1
    SOFFICE_PATH="/Applications/LibreOffice.app/Contents/MacOS/soffice"
fi

if [ $SOFFICE_FOUND -eq 1 ]; then
    echo "[OK] LibreOffice found at: $SOFFICE_PATH"
else
    echo "[WARNING] LibreOffice not found"
    echo ""
    
    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Would you like to install LibreOffice? (Required for PDF generation)"
        read -p "[Y/n]: " choice
        
        if [[ "$choice" =~ ^[Yy]$ ]] || [[ -z "$choice" ]]; then
            echo ""
            echo "[INFO] Installing LibreOffice..."
            
            # Detect package manager
            if command -v apt-get &> /dev/null; then
                # Debian/Ubuntu
                sudo apt-get update
                sudo apt-get install -y libreoffice libreoffice-writer libreoffice-calc
            elif command -v dnf &> /dev/null; then
                # Fedora
                sudo dnf install -y libreoffice
            elif command -v yum &> /dev/null; then
                # RHEL/CentOS
                sudo yum install -y libreoffice
            elif command -v pacman &> /dev/null; then
                # Arch
                sudo pacman -S --noconfirm libreoffice-still
            else
                echo "[WARNING] Unknown package manager. Please install LibreOffice manually:"
                echo "  - Debian/Ubuntu: sudo apt-get install libreoffice"
                echo "  - Fedora: sudo dnf install libreoffice"
                echo "  - Arch: sudo pacman -S libreoffice-still"
            fi
        else
            echo "[INFO] Skipping LibreOffice installation"
        fi
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "Would you like to install LibreOffice via Homebrew?"
            read -p "[Y/n]: " choice
            
            if [[ "$choice" =~ ^[Yy]$ ]] || [[ -z "$choice" ]]; then
                echo ""
                echo "[INFO] Installing LibreOffice..."
                brew install --cask libreoffice
            else
                echo "[INFO] Skipping LibreOffice installation"
                echo "Install manually with: brew install --cask libreoffice"
            fi
        else
            echo "[INFO] Homebrew not found. Please install LibreOffice manually:"
            echo "  1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "  2. Install LibreOffice: brew install --cask libreoffice"
            echo "  Or download from: https://www.libreoffice.org/download/download/"
        fi
    fi
fi

echo ""

# ==========================================
# Final Status
# ==========================================
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Python packages installed:"
$PYTHON_CMD -m pip list | grep -iE "qrcode|pillow|pptx"
echo ""

# Check soffice again
if command -v soffice &> /dev/null; then
    echo "LibreOffice: [OK] $(command -v soffice)"
else
    echo "LibreOffice: [NOT FOUND] - Install manually for PDF generation"
fi

echo ""
echo "Environment variable to set (optional):"
echo "export SDS_LIBREOFFICE_BIN=/path/to/soffice"
echo ""
