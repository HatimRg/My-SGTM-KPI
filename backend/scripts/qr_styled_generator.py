#!/usr/bin/env python3
"""
Professional QR Generator using qrcode library with PIL styling
Matches qr-code-styling capabilities in Python
"""

import sys
sys.path.insert(0, r'C:\Users\RAGHIB\AppData\Roaming\Python\Python314\site-packages')

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import (
    RoundedModuleDrawer, 
    CircleModuleDrawer,
    GappedSquareModuleDrawer,
    HorizontalBarsDrawer,
    VerticalBarsDrawer
)
from qrcode.image.styles.colormasks import (
    SolidFillColorMask,
    RadialGradiantColorMask,
    SquareGradiantColorMask,
    HorizontalGradiantColorMask,
    VerticalGradiantColorMask
)
from PIL import Image, ImageDraw
import math

# Configuration matching your style
CONFIG = {
    "url": "http://102.54.244.33/api/public/sds/test/view",
    "error_correction": "Q",  # 25% recovery
    "box_size": 12,
    "border": 4,
    
    # Body (dots) styling
    "dot_style": "rounded",  # rounded, circle, square, gapped, horizontal, vertical
    "dot_color": "#FB9D01",
    "dot_gradient": None,  # or "radial", "linear"
    
    # Eye styling  
    "eye_color": "#FB9D01",
    "eye_inner_color": "#FB9D01",
    
    # Background
    "bg_color": "#FFFFFF",
    "transparent": False,
    
    # Logo
    "logo_path": r"C:\xampp\htdocs\My-SGTM-KPI\backend\storage\app\Templates\Center logo.jpg",
    "logo_size": 15,  # percent
}

def get_module_drawer(style: str):
    """Get the appropriate module drawer for dot style."""
    drawers = {
        "rounded": RoundedModuleDrawer(),
        "circle": CircleModuleDrawer(),
        "square": None,  # Default
        "gapped": GappedSquareModuleDrawer(),
        "horizontal": HorizontalBarsDrawer(),
        "vertical": VerticalBarsDrawer()
    }
    return drawers.get(style)

def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_custom_qr(config: dict) -> Image.Image:
    """Create styled QR code matching qr-code-styling capabilities."""
    
    # Error correction mapping
    ec_levels = {
        "L": qrcode.constants.ERROR_CORRECT_L,
        "M": qrcode.constants.ERROR_CORRECT_M,
        "Q": qrcode.constants.ERROR_CORRECT_Q,
        "H": qrcode.constants.ERROR_CORRECT_H
    }
    
    # Create QR code instance
    qr = qrcode.QRCode(
        version=None,  # Auto-fit
        error_correction=ec_levels.get(config["error_correction"], qrcode.constants.ERROR_CORRECT_Q),
        box_size=config["box_size"],
        border=config["border"],
    )
    
    qr.add_data(config["url"])
    qr.make(fit=True)
    
    # Get colors
    dot_rgb = hex_to_rgb(config["dot_color"])
    eye_rgb = hex_to_rgb(config["eye_color"])
    eye_inner_rgb = hex_to_rgb(config["eye_inner_color"])
    bg_rgb = hex_to_rgb(config["bg_color"]) if not config["transparent"] else (255, 255, 255)
    
    # Create color mask
    color_mask = SolidFillColorMask(
        front_color=dot_rgb,
        back_color=bg_rgb
    )
    
    # Get module drawer
    module_drawer = get_module_drawer(config["dot_style"])
    
    # Generate styled QR
    if module_drawer:
        qr_img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=module_drawer,
            color_mask=color_mask
        )
    else:
        qr_img = qr.make_image(
            fill_color=config["dot_color"],
            back_color=config["bg_color"]
        )
    
    # Convert to RGBA for transparency support
    qr_img = qr_img.convert('RGBA')
    
    # Custom eye styling (override the standard eyes)
    draw_custom_eyes(qr_img, config)
    
    # Add logo if provided
    if config.get("logo_path"):
        add_logo(qr_img, config)
    
    return qr_img

def draw_custom_eyes(img: Image.Image, config: dict):
    """Draw custom styled eyes (corner squares) on the QR."""
    draw = ImageDraw.Draw(img)
    width, height = img.size
    
    # Calculate module size
    qr = img
    # Eye positions are at:
    # - Top-left: (border, border)
    # - Top-right: (width - border - 7, border)  
    # - Bottom-left: (border, height - border - 7)
    
    border = config["border"]
    box_size = config["box_size"]
    
    # Eye size in pixels (7 modules × box_size)
    eye_size = 7 * box_size
    
    positions = [
        (border * box_size, border * box_size),  # Top-left
        (width - (border + 7) * box_size, border * box_size),  # Top-right
        (border * box_size, height - (border + 7) * box_size)  # Bottom-left
    ]
    
    eye_color = hex_to_rgb(config["eye_color"])
    eye_inner = hex_to_rgb(config["eye_inner_color"])
    bg_color = hex_to_rgb(config["bg_color"]) if not config["transparent"] else None
    
    for x, y in positions:
        # Draw custom eye shape (rounded square with inner circle)
        # Outer rounded square
        draw.rounded_rectangle(
            [x, y, x + eye_size, y + eye_size],
            radius=eye_size // 4,
            fill=eye_color
        )
        
        # Inner ring (background color)
        inner_size = eye_size - 2 * box_size
        inner_x = x + box_size
        inner_y = y + box_size
        
        if bg_color:
            draw.ellipse(
                [inner_x, inner_y, inner_x + inner_size, inner_y + inner_size],
                fill=bg_color
            )
        else:
            # Transparent - clear the area
            # This would need a mask approach for true transparency
            pass
        
        # Center dot
        dot_size = inner_size - 2 * box_size
        dot_x = inner_x + box_size
        dot_y = inner_y + box_size
        
        draw.ellipse(
            [dot_x, dot_y, dot_x + dot_size, dot_y + dot_size],
            fill=eye_inner
        )

def add_logo(img: Image.Image, config: dict):
    """Add logo to center of QR."""
    try:
        logo = Image.open(config["logo_path"]).convert("RGBA")
        
        qr_width, qr_height = img.size
        logo_percent = config["logo_size"]
        logo_size = int(qr_width * (logo_percent / 100))
        
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        
        # Calculate center position
        logo_x = (qr_width - logo_size) // 2
        logo_y = (qr_height - logo_size) // 2
        
        # Clear area behind logo (draw white/transparent square)
        padding = 10
        overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        
        overlay_draw.rounded_rectangle(
            [logo_x - padding, logo_y - padding, 
             logo_x + logo_size + padding, logo_y + logo_size + padding],
            radius=15,
            fill=hex_to_rgb(config["bg_color"]) if not config["transparent"] else (255, 255, 255, 255)
        )
        
        # Paste overlay
        img.paste(overlay, (0, 0), overlay)
        
        # Paste logo
        img.paste(logo, (logo_x, logo_y), logo)
        
    except Exception as e:
        print(f"Error adding logo: {e}")

def main():
    # Generate QR
    qr_img = create_custom_qr(CONFIG)
    
    # Save output
    output_path = "styled_qr_output.png"
    qr_img.save(output_path, 'PNG')
    print(f"✓ Generated styled QR: {output_path}")
    print(f"  URL: {CONFIG['url']}")
    print(f"  Dot Style: {CONFIG['dot_style']}")
    print(f"  Colors: {CONFIG['dot_color']} / {CONFIG['bg_color']}")

if __name__ == "__main__":
    main()
