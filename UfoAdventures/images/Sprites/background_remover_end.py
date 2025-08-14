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