import numpy  as np
from pathlib import Path
from shinier import Options, ImageDataset, ImageProcessor

base = Path.cwd()

opts = Options(
    input_folder  = base / "input_test",
    output_folder = base / "output_final_mode2",
    mode          = 2, # Histogram matching
    # Keep 2D grayscale .npy values as raw pixel intensities.
    # Without linear_luminance=True, SHINIER converts grayscale to sRGB xyY
    # luminance before _initial_buffer, so hist_initial no longer matches input.
    as_gray=True,
    linear_luminance=True,
)

dataset = ImageDataset(options=opts)
processor = ImageProcessor(dataset=dataset)