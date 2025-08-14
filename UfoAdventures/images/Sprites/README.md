# Background Remover Utility

This utility scans a folder for images and creates new versions with the background removed.

## Features

- Supports a wide range of image formats for reading (PNG, BMP, GIF, JPEG, TIFF, WebP, and more).
- Does not overwrite original files.
- New files are named `{original_name}_bkremoved.png` (always saved as PNG to preserve transparency).
- Uses `rembg` for primary background removal (AI-powered), with adjustable aggressiveness and smart preprocessing.
- Falls back to `opencv-python` GrabCut for complex backgrounds.
- Final fallback is a simple color-based transparency method.
- **Default behavior is to overwrite existing output files.**

## Requirements

- Python 3.7 or higher
- Libraries listed in `requirements.txt`:
  - `Pillow`: For basic image handling.
  - `rembg`: For AI-powered background removal (optional but recommended).
  - `opencv-python`: For the GrabCut algorithm fallback.

## Installation

1. Ensure you have Python installed.
2. Install the required libraries:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Place the `background_remover.py` script in a convenient location.
2. Configure the script:
   - Set the default input folder path by modifying the `DEFAULT_INPUT_FOLDER` variable inside the script.
   - Optionally, adjust the `FALLBACK_TRANSPARENT_COLOR` if you want to change the color made transparent by the final fallback method.
3. Run the script:
   ```bash
   python background_remover.py
   ```
   Or, specify a different folder path as an argument:
   ```bash
   python background_remover.py C:\\path\\to\\your\\images
   ```
   **To control the aggressiveness of the main `rembg` removal (0-100, where 100 is most aggressive):**
   ```bash
   python background_remover.py --aggressiveness 60
   # or
   python background_remover.py -a 95
   ```
   **To disable the default preprocessing step that enhances edges for `rembg`:**
   ```bash
   python background_remover.py --no-preprocess
   ```

## How It Works

1. The script scans the specified folder for files with supported extensions, skipping any files that look like previous outputs (`*_bkremoved.*`).
2. For each image:
   - It will process the image, **overwriting the output file if it already exists**.
   - It applies a mild, reversible preprocessing step (edge enhancement) to help `rembg` detect object boundaries more accurately. This is **enabled by default**.
   - It attempts to remove the background using `rembg`, with the aggressiveness level determining the underlying model and settings.
   - If `rembg` fails or is not installed, it tries the `opencv-python` GrabCut algorithm.
   - If both `rembg` and GrabCut fail, and a fallback color is configured, it tries the color-based method.
   - If all methods fail, an error message is printed for that file.

## Notes

- The script saves output images in PNG format to preserve transparency, even if the original was a format like JPEG.
- The GrabCut method works best on images with complex backgrounds that are distinctly different from the foreground object.
- The final fallback method makes a specific RGB color fully transparent. By default, this is white (255, 255, 255). This works best if your images have a solid, consistent background color.
- The preprocessing step (enabled by default) helps `rembg` at all aggressiveness levels by making edges slightly sharper in a temporary copy of the image. The final mask is then applied to the original, unaltered image, minimizing artifacts.
- Make sure the script has read and write permissions for the input/output folder.