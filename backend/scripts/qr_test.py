#!/usr/bin/env python3
"""
QR Code Test/Development Script - Real-time QR Styling Configuration

This script allows you to test QR code configurations without reloading.
Simply edit the CONFIG dictionary below and run the script.

Usage:
    python qr_test.py                    # Generate with current config
    python qr_test.py --watch            # Watch mode - auto-regenerate on file change
    python qr_test.py --config custom    # Use custom.json config file
"""

import sys
sys.path.insert(0, r'C:\Users\RAGHIB\AppData\Roaming\Python\Python314\site-packages')

import os
import json
import argparse
from pathlib import Path
from typing import Optional, Tuple, List

try:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H
    from PIL import Image, ImageDraw, ImageFont
    import math
except Exception as e:
    print(f"Error: Missing dependencies. {e}")
    print("Install with: pip install qrcode Pillow")
    sys.exit(1)

# =============================================================================
# CONFIGURATION - EDIT THIS SECTION TO CUSTOMIZE YOUR QR CODE
# =============================================================================

CONFIG = {
    # === FRAME / TEMPLATE ===
    "frame_style": "standard",  # Options: standard, rounded, holiday, event, theme
    "frame_background": "#ffffff",  # Frame background color
    
    # === QR CODE CONTENT ===
    "url": "http://102.54.244.33/api/public/sds/test/view",
    "add_scan_me_text": True,  # Add "SCAN ME" text above QR
    "scan_me_text": "SCAN ME",
    
    # === ADDITIONAL TEXT (Below QR) ===
    "additional_text_lines": [
        "Additional text line 1",
        "Additional text line 2",
        "Additional text line 3"
    ],
    "additional_text_enabled": True,
    
    # === TEXT STYLING ===
    "font_name": "Roboto",  # System font name or path to TTF file
    "font_size": "auto",  # "auto" or integer (e.g., 24)
    "text_color": "#9c3aaf",  # Text color for additional text
    "text_alignment": "center",  # left, center, right
    
    # === QR CODE STYLING ===
    "body_pattern": "single_color",  # single_color, color_gradient
    "body_color": "#000000",  # QR module color
    "body_gradient_start": "#000000",
    "body_gradient_end": "#9c3aaf",
    
    # === ERROR CORRECTION / SCANNABILITY ===
    "error_correction": "high",  # smallest, medium, high, best
    # smallest = ERROR_CORRECT_L (7%)
    # medium = ERROR_CORRECT_M (15%)
    # high = ERROR_CORRECT_Q (25%)
    # best = ERROR_CORRECT_H (30%)
    
    # === EYE PATTERNS (Corner squares) ===
    "external_eye_style": "single_color",  # single_color, color_gradient
    "external_eye_color": "#000000",
    "external_eye_gradient_start": "#000000",
    "external_eye_gradient_end": "#9c3aaf",
    
    "internal_eye_style": "single_color",
    "internal_eye_color": "#000000",
    "internal_eye_gradient_start": "#000000",
    "internal_eye_gradient_end": "#9c3aaf",
    
    # === BACKGROUND ===
    "background_style": "transparent",  # single_color, color_gradient, transparent
    "background_color": "#ffffff",
    "background_gradient_start": "#ffffff",
    "background_gradient_end": "#000000",
    "transparent_background": True,
    
    # === LOGO ===
    "logo_path": r"C:\xampp\htdocs\My-SGTM-KPI\backend\storage\app\Templates\Center logo.jpg",
    "logo_enabled": True,
    "logo_size_percent": 15,  # Logo size as % of QR code (10-30 recommended)
    "logo_background": True,  # Add background behind logo for visibility
    "logo_background_color": "#4a4a4a",
    "logo_background_rounded": True,
    
    # === OUTPUT ===
    "output_name": "test_qr_output",
    "output_format": "png",  # png, svg (svg not implemented yet)
    "box_size": 12,  # Size of each QR module in pixels
    "border": 4,  # Border modules
    
    # === CANVAS SETTINGS ===
    "canvas_width": 800,  # Total canvas width (0 = auto)
    "canvas_height": 1000,  # Total canvas height (0 = auto)
    "padding_top": 50,
    "padding_bottom": 50,
    "padding_left": 50,
    "padding_right": 50,
    "qr_top_margin": 100,  # Space from top for "SCAN ME" text
}

# =============================================================================
# ERROR CORRECTION MAPPING
# =============================================================================

ERROR_LEVELS = {
    "smallest": ERROR_CORRECT_L,   # ~7% damage recovery
    "medium": ERROR_CORRECT_M,     # ~15% damage recovery
    "high": ERROR_CORRECT_Q,       # ~25% damage recovery
    "best": ERROR_CORRECT_H        # ~30% damage recovery
}


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def parse_color(color_str: str, default: str = "#000000") -> Tuple[int, int, int, int]:
    """Parse color string to RGBA tuple."""
    if not color_str:
        color_str = default
    if color_str.lower() == "transparent":
        return (0, 0, 0, 0)
    rgb = hex_to_rgb(color_str)
    return (*rgb, 255)


def create_gradient(size: Tuple[int, int], start_color: str, end_color: str, 
                    direction: str = "horizontal") -> Image.Image:
    """Create a gradient image."""
    width, height = size
    base = Image.new('RGBA', size, (0, 0, 0, 0))
    
    start_rgb = hex_to_rgb(start_color)
    end_rgb = hex_to_rgb(end_color)
    
    draw = ImageDraw.Draw(base)
    
    if direction == "horizontal":
        for x in range(width):
            ratio = x / width
            r = int(start_rgb[0] * (1 - ratio) + end_rgb[0] * ratio)
            g = int(start_rgb[1] * (1 - ratio) + end_rgb[1] * ratio)
            b = int(start_rgb[2] * (1 - ratio) + end_rgb[2] * ratio)
            draw.line([(x, 0), (x, height)], fill=(r, g, b, 255))
    else:
        for y in range(height):
            ratio = y / height
            r = int(start_rgb[0] * (1 - ratio) + end_rgb[0] * ratio)
            g = int(start_rgb[1] * (1 - ratio) + end_rgb[1] * ratio)
            b = int(start_rgb[2] * (1 - ratio) + end_rgb[2] * ratio)
            draw.line([(0, y), (width, y)], fill=(r, g, b, 255))
    
    return base


def get_font(config: dict, size: int) -> ImageFont.FreeTypeFont:
    """Get font with fallback."""
    font_name = config.get("font_name", "Roboto")
    
    # Try system fonts
    font_paths = [
        # Windows common paths
        f"C:/Windows/Fonts/{font_name}.ttf",
        f"C:/Windows/Fonts/{font_name}.TTF",
        f"C:/Windows/Fonts/arial.ttf",
        f"C:/Windows/Fonts/segoeui.ttf",
        f"C:/Windows/Fonts/calibri.ttf",
        # Linux/Mac paths
        f"/usr/share/fonts/truetype/{font_name.lower()}/{font_name}.ttf",
        f"/System/Library/Fonts/{font_name}.ttf",
        f"/Library/Fonts/{font_name}.ttf",
        # Current directory
        f"./fonts/{font_name}.ttf",
        f"./{font_name}.ttf",
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                pass
    
    # Fallback to default
    return ImageFont.load_default()


def calculate_font_size(config: dict, available_height: int, text: str, 
                       max_width: int) -> int:
    """Calculate optimal font size."""
    if config.get("font_size") != "auto" and isinstance(config.get("font_size"), int):
        return config["font_size"]
    
    # Auto-calculate
    test_size = 10
    while test_size < 100:
        font = get_font(config, test_size)
        bbox = font.getbbox(text) if hasattr(font, 'getbbox') else (0, 0, test_size * len(text) * 0.6, test_size)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        if text_height > available_height * 0.8 or text_width > max_width * 0.9:
            return max(10, test_size - 2)
        test_size += 2
    
    return 24


def generate_qr_code(config: dict, output_path: str) -> str:
    """Generate QR code with given configuration."""
    
    # Get error correction level
    ec_level = ERROR_LEVELS.get(config.get("error_correction", "high"), ERROR_CORRECT_Q)
    
    # Create QR code
    qr = qrcode.QRCode(
        version=None,
        error_correction=ec_level,
        box_size=config.get("box_size", 12),
        border=config.get("border", 4),
    )
    qr.add_data(config.get("url", "https://example.com"))
    qr.make(fit=True)
    
    # Generate QR image
    body_color = config.get("body_color", "#000000")
    background_style = config.get("background_style", "transparent")
    
    if background_style == "transparent":
        qr_img = qr.make_image(fill_color=body_color, back_color="transparent")
        qr_img = qr_img.convert('RGBA')
    else:
        bg_color = config.get("background_color", "#ffffff")
        qr_img = qr.make_image(fill_color=body_color, back_color=bg_color)
        qr_img = qr_img.convert('RGBA')
    
    # Get QR dimensions
    qr_width, qr_height = qr_img.size
    
    # Calculate canvas size
    padding_left = config.get("padding_left", 50)
    padding_right = config.get("padding_right", 50)
    padding_top = config.get("padding_top", 50)
    padding_bottom = config.get("padding_bottom", 50)
    
    canvas_width = config.get("canvas_width", 0)
    canvas_height = config.get("canvas_height", 0)
    
    if canvas_width == 0:
        canvas_width = qr_width + padding_left + padding_right
    if canvas_height == 0:
        # Calculate based on content
        extra_height = 0
        if config.get("add_scan_me_text"):
            extra_height += 60
        if config.get("additional_text_enabled"):
            lines = config.get("additional_text_lines", [])
            extra_height += len(lines) * 40 + 40
        canvas_height = qr_height + padding_top + padding_bottom + extra_height
    
    # Create canvas
    if background_style == "transparent":
        canvas = Image.new('RGBA', (canvas_width, canvas_height), (0, 0, 0, 0))
    elif config.get("body_pattern") == "color_gradient":
        canvas = create_gradient(
            (canvas_width, canvas_height),
            config.get("body_gradient_start", "#000000"),
            config.get("body_gradient_end", "#9c3aaf"),
            "vertical"
        )
    else:
        bg_color = parse_color(config.get("background_color", "#ffffff"))
        canvas = Image.new('RGBA', (canvas_width, canvas_height), bg_color)
    
    # Draw frame if specified
    frame_style = config.get("frame_style", "standard")
    if frame_style != "standard":
        draw_frame(canvas, frame_style, config)
    
    # Calculate QR position (center horizontally)
    qr_x = (canvas_width - qr_width) // 2
    qr_y = padding_top + (60 if config.get("add_scan_me_text") else 0)
    
    # Paste QR code
    canvas.paste(qr_img, (qr_x, qr_y), qr_img if qr_img.mode == 'RGBA' else None)
    
    # Add logo if enabled
    if config.get("logo_enabled"):
        add_logo_to_canvas(canvas, qr_x, qr_y, qr_width, config)
    
    # Add "SCAN ME" text
    if config.get("add_scan_me_text"):
        scan_text = config.get("scan_me_text", "SCAN ME")
        text_color = config.get("text_color", "#9c3aaf")
        
        font_size = calculate_font_size(config, 50, scan_text, canvas_width - 100)
        font = get_font(config, font_size)
        
        draw = ImageDraw.Draw(canvas)
        bbox = font.getbbox(scan_text) if hasattr(font, 'getbbox') else (0, 0, font_size * len(scan_text) * 0.6, font_size)
        text_width = bbox[2] - bbox[0]
        text_x = (canvas_width - text_width) // 2
        text_y = padding_top - 10
        
        draw.text((text_x, text_y), scan_text, font=font, fill=text_color)
    
    # Add additional text lines
    if config.get("additional_text_enabled"):
        lines = config.get("additional_text_lines", [])
        if lines:
            text_color = config.get("text_color", "#9c3aaf")
            available_width = canvas_width - padding_left - padding_right
            
            font_size = calculate_font_size(config, 35, max(lines, key=len), available_width)
            font = get_font(config, font_size)
            
            draw = ImageDraw.Draw(canvas)
            current_y = qr_y + qr_height + 20
            
            for line in lines:
                if not line.strip():
                    current_y += font_size // 2
                    continue
                    
                bbox = font.getbbox(line) if hasattr(font, 'getbbox') else (0, 0, font_size * len(line) * 0.6, font_size)
                text_width = bbox[2] - bbox[0]
                
                alignment = config.get("text_alignment", "center")
                if alignment == "left":
                    text_x = padding_left
                elif alignment == "right":
                    text_x = canvas_width - padding_right - text_width
                else:  # center
                    text_x = (canvas_width - text_width) // 2
                
                draw.text((text_x, current_y), line, font=font, fill=text_color)
                current_y += font_size + 10
    
    # Save output
    output_format = config.get("output_format", "png").lower()
    
    if output_format == "png":
        # Convert to appropriate mode
        if canvas.mode == 'RGBA' and not config.get("transparent_background"):
            # Flatten to RGB with white background
            background = Image.new('RGB', canvas.size, (255, 255, 255))
            background.paste(canvas, mask=canvas.split()[3])
            canvas = background
        elif canvas.mode == 'RGBA' and config.get("transparent_background"):
            pass  # Keep RGBA for transparency
        else:
            canvas = canvas.convert('RGB')
        
        canvas.save(output_path, 'PNG')
    
    print(f"✓ QR Code generated: {output_path}")
    print(f"  URL: {config.get('url')}")
    print(f"  Error Correction: {config.get('error_correction', 'high')}")
    print(f"  Size: {canvas.size}")
    
    return output_path


def draw_frame(canvas: Image.Image, frame_style: str, config: dict):
    """Draw decorative frame around the canvas."""
    draw = ImageDraw.Draw(canvas)
    width, height = canvas.size
    
    frame_bg = config.get("frame_background", "#ffffff")
    
    if frame_style == "rounded":
        # Draw rounded rectangle border
        border_width = 20
        corner_radius = 30
        draw.rounded_rectangle(
            [(border_width//2, border_width//2), 
             (width - border_width//2, height - border_width//2)],
            radius=corner_radius,
            outline=frame_bg,
            width=border_width
        )
    elif frame_style in ["holiday", "event", "theme"]:
        # Add decorative corners
        corner_size = 40
        # Top-left corner
        draw.pieslice([(0, 0), (corner_size*2, corner_size*2)], 180, 270, fill=frame_bg)
        # Top-right corner
        draw.pieslice([(width-corner_size*2, 0), (width, corner_size*2)], 270, 360, fill=frame_bg)
        # Bottom-left corner
        draw.pieslice([(0, height-corner_size*2), (corner_size*2, height)], 90, 180, fill=frame_bg)
        # Bottom-right corner
        draw.pieslice([(width-corner_size*2, height-corner_size*2), (width, height)], 0, 90, fill=frame_bg)


def add_logo_to_canvas(canvas: Image.Image, qr_x: int, qr_y: int, 
                       qr_size: int, config: dict):
    """Add logo to the center of QR code."""
    logo_path = config.get("logo_path", "")
    
    if not logo_path or not os.path.exists(logo_path):
        print(f"⚠ Logo not found: {logo_path}")
        return
    
    try:
        logo = Image.open(logo_path).convert("RGBA")
        
        # Calculate logo size
        logo_percent = config.get("logo_size_percent", 15)
        logo_size = int(qr_size * (logo_percent / 100))
        logo_size = max(30, min(logo_size, qr_size // 3))  # Clamp size
        
        logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
        
        # Calculate center position
        center_x = qr_x + (qr_size - logo_size) // 2
        center_y = qr_y + (qr_size - logo_size) // 2
        
        # Draw logo background if enabled
        if config.get("logo_background", True):
            overlay = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            
            padding = 10
            bg_color = parse_color(config.get("logo_background_color", "#4a4a4a"))
            
            box = [
                center_x - padding,
                center_y - padding,
                center_x + logo_size + padding,
                center_y + logo_size + padding
            ]
            
            if config.get("logo_background_rounded", True):
                overlay_draw.rounded_rectangle(box, radius=15, fill=bg_color)
            else:
                overlay_draw.rectangle(box, fill=bg_color)
            
            canvas.paste(overlay, (0, 0), overlay)
        
        # Paste logo
        canvas.paste(logo, (center_x, center_y), logo)
        
    except Exception as e:
        print(f"⚠ Error adding logo: {e}")


def load_config(config_name: str = "default") -> dict:
    """Load configuration from JSON file or use default."""
    config_file = f"qr_config_{config_name}.json"
    
    if os.path.exists(config_file):
        with open(config_file, 'r') as f:
            loaded = json.load(f)
            print(f"✓ Loaded config from {config_file}")
            return {**CONFIG, **loaded}  # Merge with defaults
    
    return CONFIG.copy()


def save_config_template():
    """Save the default config as a template file."""
    template_file = "qr_config_template.json"
    with open(template_file, 'w') as f:
        json.dump(CONFIG, f, indent=2)
    print(f"✓ Config template saved: {template_file}")
    print("  Copy this file to qr_config_custom.json and edit to customize")


def main():
    parser = argparse.ArgumentParser(description='QR Code Test Generator')
    parser.add_argument('--watch', action='store_true', 
                       help='Watch mode - auto-regenerate on config change')
    parser.add_argument('--config', default='default',
                       help='Config name (looks for qr_config_<name>.json)')
    parser.add_argument('--output', '-o', default='test_qr_output.png',
                       help='Output filename')
    parser.add_argument('--template', action='store_true',
                       help='Save config template file')
    parser.add_argument('--url', 
                       help='Override URL in config')
    
    args = parser.parse_args()
    
    if args.template:
        save_config_template()
        return
    
    # Load configuration
    config = load_config(args.config)
    
    # Override URL if provided
    if args.url:
        config["url"] = args.url
    
    # Determine output path
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, args.output)
    
    if args.watch:
        # Watch mode
        import time
        config_file = f"qr_config_{args.config}.json"
        
        if not os.path.exists(config_file):
            print(f"⚠ Config file not found: {config_file}")
            print("  Creating template...")
            save_config_template()
            return
        
        last_mtime = 0
        print(f"👁 Watch mode active - monitoring {config_file}")
        print("  Press Ctrl+C to stop")
        print()
        
        try:
            while True:
                current_mtime = os.path.getmtime(config_file)
                
                if current_mtime != last_mtime:
                    last_mtime = current_mtime
                    config = load_config(args.config)
                    if args.url:
                        config["url"] = args.url
                    
                    print(f"\n🔄 Config changed at {time.strftime('%H:%M:%S')}")
                    try:
                        generate_qr_code(config, output_path)
                    except Exception as e:
                        print(f"❌ Error: {e}")
                    print("\n⏳ Waiting for changes...")
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n\n👋 Watch mode stopped")
    else:
        # Single run mode
        generate_qr_code(config, output_path)
        
        # Print config summary
        print("\n📋 Configuration Summary:")
        print(f"  Frame Style: {config.get('frame_style')}")
        print(f"  Error Correction: {config.get('error_correction')}")
        print(f"  Body Color: {config.get('body_color')}")
        print(f"  Background: {config.get('background_style')}")
        print(f"  Logo: {'Enabled' if config.get('logo_enabled') else 'Disabled'}")
        print(f"  Additional Text: {'Enabled' if config.get('additional_text_enabled') else 'Disabled'}")


if __name__ == "__main__":
    main()
