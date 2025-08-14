"""
Background Remover Utility

Scans a specified folder for images (PNG, BMP, GIF) and creates new versions
with the background removed.

- Supports PNG, BMP, GIF.
- Does not overwrite originals.
- New files are named {original_name}_bkremoved{extension}.
- Uses 'rembg' for primary removal.
- Falls back to 'opencv' GrabCut for complex backgrounds.
- Final fallback is color-based transparency.
"""

import argparse
import os
import sys
from pathlib import Path

# --- Configuration ---
# You can set the default input folder path here
DEFAULT_INPUT_FOLDER = r"F:\Dynamic\UFOAdventures\UfoAdventures\images\Sprites"

# Supported image extensions
# Pillow can read many formats, but we list common ones.
# Output is always saved as PNG to preserve transparency.
SUPPORTED_EXTENSIONS = {
    '.png', '.bmp', '.gif',  # Original formats
    '.jpg', '.jpeg', '.tiff', '.tif', '.webp' # Additional common formats
}

# --- Fallback Configuration ---
# Color to make transparent if rembg fails (e.g., (255, 255, 255) for white)
# Set to None to disable color-based fallback
FALLBACK_TRANSPARENT_COLOR = (255, 255, 255) # White


def is_supported_file(file_path: Path) -> bool:
    """Check if the file has a supported extension and is not an already processed output."""
    # Check for supported extension
    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return False
    
    # Check if it's an already processed file (e.g., name_bkremoved.png)
    if file_path.name.endswith(('_bkremoved.png', '_bkremoved.jpg', '_bkremoved.jpeg', '_bkremoved.bmp', '_bkremoved.gif', '_bkremoved.tiff', '_bkremoved.tif', '_bkremoved.webp')):
        return False
        
    return True

def make_output_filename(original_path: Path) -> Path:
    """Generate the output filename."""
    stem = original_path.stem
    suffix = original_path.suffix
    new_name = f"{stem}_bkremoved{suffix}"
    return original_path.parent / new_name

def remove_background_rembg(input_path: Path, output_path: Path, aggressiveness: int, use_preprocessing: bool) -> bool:
    """
    Remove background using the 'rembg' library, adjusted by aggressiveness level.
    Aggressiveness: 0-100 (higher is more aggressive).
    use_preprocessing: If True, applies reversible preprocessing to help with edge detection.
    Returns True if successful, False otherwise.
    """
    try:
        from rembg import remove, new_session
        from PIL import Image, ImageEnhance, ImageFilter
        import io
        import numpy as np

        input_image = Image.open(input_path)

        # --- Preprocessing Step ---
        processed_image = input_image
        if use_preprocessing:
            # Enhance edges slightly to help rembg detect boundaries better.
            # This is a reversible step as the mask from rembg will be applied to the original image later.
            
            # Convert to RGB if necessary for enhancement
            if processed_image.mode != 'RGB':
                processed_image = processed_image.convert('RGB')
            
            # Apply a mild unsharp mask for edge enhancement
            # radius=1.0-2.0, percent=50-100, threshold=0-3 are common ranges.
            processed_image = processed_image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=80, threshold=2))
            
            # Optional: Slight contrast enhancement
            # enhancer = ImageEnhance.Contrast(processed_image)
            # processed_image = enhancer.enhance(1.1) # Increase contrast by 10%

            # Note: The key is that rembg generates a mask. This mask will be applied to the ORIGINAL image,
            # so artifacts from preprocessing (like sharpening halos) are not in the final output.
            # The preprocessing only aids the internal mask generation of rembg.

        # rembg expects and returns bytes
        input_bytes = io.BytesIO()
        # Save in a format rembg prefers (PNG is good)
        # Use the potentially preprocessed image for rembg's analysis
        processed_image.save(input_bytes, format='PNG') 
        input_bytes_data = input_bytes.getvalue()

        # Map aggressiveness to rembg model and settings
        # These are example mappings and can be tuned
        if aggressiveness >= 90:
            model_name = "u2net" # Most aggressive
            post_process = True
        elif aggressiveness >= 70:
            model_name = "u2net" # Default/main model
            post_process = True
        else: # < 70
            model_name = "u2netp" # Less aggressive, faster
            post_process = False # Often less aggressive without post-processing

        # Create a session for the chosen model (can improve performance if processing many images)
        session = new_session(model_name=model_name)

        # Apply rembg with specific model and settings
        # rembg returns the full image with alpha, not just a mask.
        output_bytes_data = remove(
            input_bytes_data,
            session=session,
            post_process_mask=post_process
        )

        output_image = Image.open(io.BytesIO(output_bytes_data))
        
        # Ensure output is in a format that supports transparency
        if output_image.mode != 'RGBA':
            output_image = output_image.convert('RGBA')
        
        output_image.save(output_path, format='PNG') # Save as PNG to preserve transparency
        print(f"  -> Removed background using rembg (model: {model_name}, post-process: {post_process}, preproc: {use_preprocessing}): {output_path.name}")
        return True
    except ImportError:
        print("  -> 'rembg' library not found. Skipping rembg method.")
        return False
    except Exception as e:
        print(f"  -> rembg failed for {input_path.name}: {e}")
        return False

def remove_background_fallback(input_path: Path, output_path: Path, transparent_color: tuple) -> bool:
    """
    Remove background by making a specific color transparent.
    Returns True if successful, False otherwise.
    """
    try:
        from PIL import Image

        image = Image.open(input_path)
        image = image.convert("RGBA") # Ensure RGBA for transparency
        datas = image.getdata()

        new_data = []
        for item in datas:
            # Check if pixel matches the transparent color (exact match)
            if item[0] == transparent_color[0] and item[1] == transparent_color[1] and item[2] == transparent_color[2]:
                # Change to transparent
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)

        image.putdata(new_data)
        image.save(output_path, "PNG") # Save as PNG to ensure transparency support
        print(f"  -> Removed background using fallback (color {transparent_color}): {output_path.name}")
        return True
    except Exception as e:
        print(f"  -> Fallback failed for {input_path.name}: {e}")
        return False

def remove_background_grabcut(input_path: Path, output_path: Path) -> bool:
    """
    Remove background using OpenCV's GrabCut algorithm.
    Returns True if successful, False otherwise.
    """
    try:
        import cv2
        import numpy as np
        from PIL import Image

        # Read image with OpenCV
        img = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
        if img is None:
            print(f"  -> OpenCV could not read image: {input_path.name}")
            return False

        # Handle images with an alpha channel
        if img.shape[2] == 4:
            # Use the alpha channel as the initial mask
            mask = np.where(img[:, :, 3] > 0, cv2.GC_FGD, cv2.GC_BGD).astype('uint8')
            img_bgr = img[:, :, :3]  # Remove alpha channel for processing
        else:
            img_bgr = img
            # Create an initial mask: assume background is at the borders
            mask = np.zeros(img.shape[:2], np.uint8)
            mask[1:-1, 1:-1] = cv2.GC_PR_FGD # Probable foreground in the center

        # Initialize models
        bgdModel = np.zeros((1, 65), np.float64)
        fgdModel = np.zeros((1, 65), np.float64)

        # Apply GrabCut
        cv2.grabCut(img_bgr, mask, None, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)

        # Create final mask
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8') # Background=0, Foreground=1

        # Apply mask to image
        img_result = img_bgr * mask2[:, :, np.newaxis]

        # Convert to PIL Image with transparency
        img_pil = Image.fromarray(cv2.cvtColor(img_result, cv2.COLOR_BGR2RGB))
        
        # Create alpha channel from the GrabCut mask
        alpha_channel = mask2 * 255
        img_pil.putalpha(Image.fromarray(alpha_channel, mode='L'))

        img_pil.save(output_path, "PNG")
        print(f"  -> Removed background using GrabCut (OpenCV): {output_path.name}")
        return True
    except ImportError:
        print("  -> 'opencv-python' library not found. Skipping GrabCut method.")
        return False
    except Exception as e:
        print(f"  -> GrabCut failed for {input_path.name}: {e}")
        return False

def process_image(input_path: Path, output_path: Path, aggressiveness: int, use_preprocessing: bool):
    """Process a single image."""
    print(f"Processing: {input_path.name}")

    # NOTE: Overwrite is now default behavior. No check for existing output file.

    # Try primary method (rembg) with aggressiveness and preprocessing
    success = remove_background_rembg(input_path, output_path, aggressiveness, use_preprocessing)

    # If rembg failed, try GrabCut
    if not success:
        success = remove_background_grabcut(input_path, output_path)

    # If both primary and GrabCut failed and fallback is configured, try color-based fallback
    if not success and FALLBACK_TRANSPARENT_COLOR is not None:
        success = remove_background_fallback(input_path, output_path, FALLBACK_TRANSPARENT_COLOR)

    if not success:
        print(f"  -> Failed to process {input_path.name}")


def main():
    """Main function to run the background remover."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        'input_folder',
        nargs='?', # Makes the argument optional
        default=DEFAULT_INPUT_FOLDER,
        help='Path to the folder containing images. If not provided, uses the path set in DEFAULT_INPUT_FOLDER.'
    )
    parser.add_argument(
        '-a', '--aggressiveness',
        type=int,
        default=80, # Default to 80% as requested
        help='Set the aggressiveness level for background removal (0-100). Default is 80. Lower is less aggressive.'
    )
    parser.add_argument(
        '--no-preprocess',
        action='store_true',
        help='Disable the default preprocessing step (edge enhancement) for rembg. Enabled by default.'
    )
    args = parser.parse_args()

    input_folder_path = Path(args.input_folder)
    aggressiveness = args.aggressiveness
    use_preprocessing = not args.no_preprocess # Default is True (use preprocessing)

    # Validation for aggressiveness
    if not 0 <= aggressiveness <= 100:
        print(f"Error: Aggressiveness must be between 0 and 100. You provided {aggressiveness}.", file=sys.stderr)
        sys.exit(1)

    # Validation for input folder
    if not input_folder_path.exists():
        print(f"Error: Input folder does not exist: {input_folder_path}", file=sys.stderr)
        sys.exit(1)

    if not input_folder_path.is_dir():
        print(f"Error: Input path is not a directory: {input_folder_path}", file=sys.stderr)
        sys.exit(1)
    
    if not DEFAULT_INPUT_FOLDER and args.input_folder is None:
         print("Error: No input folder specified. Please provide one as an argument or set DEFAULT_INPUT_FOLDER in the script.", file=sys.stderr)
         sys.exit(1)


    print(f"Scanning folder: {input_folder_path}")
    print(f"Aggressiveness level set to: {aggressiveness}%")
    print(f"Preprocessing for rembg is {'ENABLED' if use_preprocessing else 'DISABLED'} (use --no-preprocess to toggle).")

    # Find all supported image files
    image_files = [
        f for f in input_folder_path.iterdir()
        if f.is_file() and is_supported_file(f)
    ]

    if not image_files:
        print("No supported image files found in the folder.")
        return

    print(f"Found {len(image_files)} supported image(s). Processing...")

    processed_count = 0
    for image_file in image_files:
        output_file = make_output_filename(image_file)
        try:
            process_image(image_file, output_file, aggressiveness, use_preprocessing)
            processed_count += 1
        except Exception as e:
            print(f"Unexpected error processing {image_file.name}: {e}")

    print(f"\nFinished. Processed {processed_count} image(s).")


if __name__ == "__main__":
    main()