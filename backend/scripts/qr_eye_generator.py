from PIL import Image, ImageDraw
import math

def create_teardrop_eye(size=70, color="#FF9900", star_color=None):
    """
    Create a teardrop-shaped QR eye with star inner pupil.
    
    Args:
        size: Size of the eye in pixels (default 70 for 7 modules * 10 box_size)
        color: Color for the teardrop frame and star (default orange)
        star_color: Optional different color for the star (defaults to color)
    
    Returns:
        PIL Image with RGBA mode (transparent background)
    """
    if star_color is None:
        star_color = color
    
    # Create a transparent square canvas
    eye = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(eye)
    
    # --- 1. Draw the Teardrop (Outer Frame) ---
    # A teardrop is a circle combined with a triangle/arc at the top-left
    padding = size // 10
    circle_box = [padding, padding, size - padding, size - padding]
    
    # Draw the main circular part of the teardrop
    draw.pieslice(circle_box, 0, 360, fill=color)
    
    # Draw the "point" of the teardrop (top-left)
    # We draw a small polygon to sharpen the top-left corner
    point_coord = [(padding, padding), (size//2, padding), (padding, size//2)]
    draw.polygon(point_coord, fill=color)

    # --- 2. Cut out the White "Ring" ---
    # To make it a frame, we draw a smaller white circle inside
    inner_padding = size // 4
    white_box = [inner_padding, inner_padding, size - inner_padding, size - inner_padding]
    draw.ellipse(white_box, fill=(255, 255, 255, 255))

    # --- 3. Draw the Star (Inner Pupil) ---
    def get_star_coords(center, outer_radius, inner_radius):
        points = []
        for i in range(10):
            radius = outer_radius if i % 2 == 0 else inner_radius
            angle = math.radians(i * 36 - 90)
            x = center[0] + radius * math.cos(angle)
            y = center[1] + radius * math.sin(angle)
            points.append((x, y))
        return points

    star_center = (size // 2, size // 2)
    star_points = get_star_coords(star_center, size // 4.5, size // 10)
    draw.polygon(star_points, fill=star_color)

    return eye

def create_all_eye_assets(output_dir=".", size=70, color="#FF9900"):
    """
    Generate individual eye assets for the 3 QR code corner positions.
    
    The 3 eyes are positioned at:
    - Top-left: Normal orientation (point facing top-left)
    - Top-right: Rotated 90° clockwise
    - Bottom-left: Rotated 270° clockwise (or 90° counter-clockwise)
    """
    import os
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Create base eye
    base_eye = create_teardrop_eye(size=size, color=color)
    
    # Top-left (normal orientation - point at top-left)
    top_left = base_eye
    top_left.save(os.path.join(output_dir, "eye_top_left.png"))
    
    # Top-right (rotated 90° clockwise - point at top-right)
    top_right = base_eye.rotate(90, expand=False)
    top_right.save(os.path.join(output_dir, "eye_top_right.png"))
    
    # Bottom-left (rotated 270° clockwise / 90° counter-clockwise - point at bottom-left)
    bottom_left = base_eye.rotate(270, expand=False)
    bottom_left.save(os.path.join(output_dir, "eye_bottom_left.png"))
    
    print(f"Generated 3 eye assets in {output_dir}:")
    print(f"  - eye_top_left.png")
    print(f"  - eye_top_right.png")
    print(f"  - eye_bottom_left.png")

if __name__ == "__main__":
    # Generate individual asset
    eye_asset = create_teardrop_eye(size=70, color="#FF9900")
    eye_asset.save("custom_eye.png")
    print("Generated custom_eye.png")
    
    # Generate all 3 corner variations
    create_all_eye_assets(output_dir="qr_eyes", size=70, color="#FF9900")
