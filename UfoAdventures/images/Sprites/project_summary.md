# Background Remover Utility - Project Summary

## Overview
This document summarizes the development of a Python script (`background_remover.py`) designed to automate background removal from images, particularly for sprite processing. It was created for a user working in the `F:\\Dynamic\\UFOAdventures\\UfoAdventures\\images\\Sprites` directory.

## Features Implemented

1.  **Core Functionality**:
    *   Scans a specified folder for images.
    *   Creates new versions with backgrounds removed, named `{original}_bkremoved.png`.
    *   Always overwrites existing output files.

2.  **Format Support**:
    *   Reads a wide range of formats: PNG, BMP, GIF, JPG, JPEG, TIFF, TIF, WebP.
    *   Saves output consistently as PNG to preserve transparency.

3.  **Multi-Tiered Background Removal**:
    *   **Primary**: `rembg` library (AI-powered).
    *   **Fallback 1**: `opencv-python` GrabCut algorithm.
    *   **Fallback 2**: Simple color-based transparency (configurable color).

4.  **User Control**:
    *   **Aggressiveness (`-a PERCENT`, default 80)**:
        *   90-100%: `u2net` model with post-processing.
        *   70-89%: `u2net` model with post-processing (default range).
        *   0-69%: `u2netp` model, post-processing disabled.
    *   **Preprocessing (Enabled by default)**:
        *   Applies a mild unsharp mask to help `rembg` detect edges.
        *   Completely reversible; the final mask is applied to the original image.
        *   Can be disabled with `--no-preprocess`.

5.  **Smart Input Handling**:
    *   Automatically skips files that already follow the `*_bkremoved.*` naming pattern.

## Files Created/Modified

*   `background_remover.py`: The main script containing all the logic.
*   `requirements.txt`: Lists required Python libraries (`Pillow`, `rembg`, `opencv-python`).
*   `README.md`: Detailed instructions on how to use the script and its features.

## Usage Examples

*   `python background_remover.py` (Runs with default settings)
*   `python background_remover.py -a 60` (Less aggressive removal)
*   `python background_remover.py --no-preprocess` (Disables edge enhancement)
*   `python background_remover.py C:\\path\\to\\other\\images` (Processes a different folder)

## Development Log

The script was developed iteratively, with features added based on user feedback:
1.  Initial version with `rembg` and color-based fallback.
2.  Added `opencv-python` GrabCut as an intermediate fallback.
3.  Expanded supported input formats.
4.  Implemented overwrite behavior and filtering of processed files.
5.  Added aggressiveness control and mapping to `rembg` models.
6.  Integrated reversible preprocessing (edge enhancement).
7.  Fixed syntax errors and finalized the command-line interface.

This tool was designed to be a robust, user-friendly alternative to online background removal services, providing fine-grained control suitable for game development workflows.