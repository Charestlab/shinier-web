export type DocGroupId = "options" | "imageprocessor" | "utils";

export type DocGroup = {
  id: DocGroupId;
  title: string;
  description: string;
};

export type DocSection = {
  id: string;
  group: DocGroupId;
  title: string;
  summary: string;
  sourceLabel: string;
  sourcePath: string;
  content: string;
};

export type PackageDocs = {
  metadata: {
    packageName: string;
    documentationVersion: string;
    githubUrl: string;
    sourceBranch: string;
    lastUpdatedLabel: string;
  };
  groups: DocGroup[];
  sections: DocSection[];
};

export const SHINIER_DOCS: PackageDocs = {
  metadata: {
    packageName: "SHINIER",
    documentationVersion: "v0.2.0",
    githubUrl: "https://github.com/Charestlab/shinier/tree/main",
    sourceBranch: "main",
    lastUpdatedLabel: "Documentation updated: v0.2.0",
  },
  groups: [
    {
      id: "options",
      title: "Options",
      description:
        "All configurable package parameters exposed by the Options model, organized by topic for quick lookup.",
    },
    {
      id: "imageprocessor",
      title: "ImageProcessor",
      description:
        "Core processing methods that implement luminance, histogram, spatial-frequency, spectrum, and dithering workflows.",
    },
    {
      id: "utils",
      title: "utils",
      description:
        "Plotting, SSIM, and dithering utilities referenced by the processing pipeline and by the Options documentation.",
    },
  ],
  sections: [
    {
      id: "options-overview",
      group: "options",
      title: "Overview",
      summary:
        "The Options class holds all SHINIER processing parameters and groups them by I/O, masks, mode, color, histogram, Fourier, dithering, and verbosity.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
Class to hold SHINIER processing options.

This page mirrors the configurable arguments documented in the Python class docstring. Each topic below corresponds to modifiable parameters exposed by the model.

    This is not the full documentation set. It is the essential documentation needed to work with the package efficiently. More technical documentation and implementation details are available directly in the package source code, helper scripts, and the GitHub repository.

    For a more guided workflow, SHINIER also exposes an interactive CLI through the shell command \`shinier\`. The CLI asks configuration questions, proposes defaults, and helps users run the package without manually writing all options first.

Use the cross-reference tokens inline when a concept is defined more precisely later in the package documentation. For example, {@ref imageprocessor-lum-match|lum_match}, {@ref imageprocessor-hist-match|hist_match}, {@ref imageprocessor-sf-match|sf_match}, {@ref imageprocessor-spec-match|spec_match}, and {@ref imageprocessor-dithering|dithering} are processing methods documented in ImageProcessor.
`,
    },
    {
      id: "options-io",
      group: "options",
      title: "Input / Output",
      summary: "Defines where images are loaded from and where processed outputs are written.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### input_folder

    Default: \`REPO_ROOT / "data/INPUT"\`

Relative or absolute path of the image folder.

### output_folder

    Default: \`REPO_ROOT / "data/OUTPUT"\`

Relative or absolute path where processed images will be saved.
`,
    },
    {
      id: "options-masks",
      group: "options",
      title: "Masks and Figure-Ground Separation",
      summary: "Controls ROI masks, mask folder usage, and background handling during analysis.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### masks_folder

    Default: \`None\`

Relative or absolute path of mask data.

### whole_image

    Default: \`1\`

Binary ROI masks: analysis runs on selected pixels.

- 1 = No ROI mask: whole images are analyzed.
- 2 = ROI masks: analysis runs on pixels different from the background pixel value.
- 3 = ROI masks: masks are loaded from the MASK folder and analysis runs on pixels greater than or equal to 127.

### background

Default: \`300\`

Background grayscale intensity of mask, or 300 for automatic detection.

> By default, when background is 300, the most frequent luminance intensity in the image is used as the background value. All regions at that luminance are treated as background.
`,
    },
    {
      id: "options-mode",
      group: "options",
      title: "SHINIER Mode",
      summary:
        "Selects which processing pipeline runs, along with legacy compatibility, random seed behavior, and composite iterations.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### mode

    Default: \`8\` in the class docstring description. In the current model fields, the runtime default is \`2\`.

Image processing treatment.

- 1 = {@ref imageprocessor-lum-match|lum_match} only
- 2 = {@ref imageprocessor-hist-match|hist_match} only
- 3 = {@ref imageprocessor-sf-match|sf_match} only
- 4 = {@ref imageprocessor-spec-match|spec_match} only
- 5 = {@ref imageprocessor-hist-match|hist_match} then {@ref imageprocessor-sf-match|sf_match}
- 6 = {@ref imageprocessor-hist-match|hist_match} then {@ref imageprocessor-spec-match|spec_match}
- 7 = {@ref imageprocessor-sf-match|sf_match} then {@ref imageprocessor-hist-match|hist_match}
- 8 = {@ref imageprocessor-spec-match|spec_match} then {@ref imageprocessor-hist-match|hist_match}
- 9 = {@ref imageprocessor-dithering|dithering} only

### legacy_mode

Default: \`False\`

Enables backward compatibility with older versions while retaining recent optimizations.

When enabled, the class reproduces previous releases by forcing:

- conserve_memory = False
- as_gray = 1
- dithering = 0
- hist_specification = 1
- safe_lum_match = False

When disabled, no legacy settings are forced and all options follow current defaults.

### seed

Default: \`None\`

Seed used to initialize the pseudo-random number generator.

It is used for {@ref utils-noisy-bit-dithering|Noisy bit dithering} and for histogram specification when the tie-breaking strategy is hybrid or noise. If omitted, int(time.time()) is used.

### iterations

Default: \`2\` in the class docstring description. In the current model fields, the runtime default is \`5\`.

Number of iterations for composite modes.

For these modes, histogram specification and Fourier amplitude specification affect each other. Multiple iterations allow a high degree of joint matching.

> This iterative method recalculates the respective target at each iteration instead of keeping a fixed target histogram or spectrum.
`,
    },
    {
      id: "options-color",
      group: "options",
      title: "Grayscale / Color",
      summary:
        "Controls grayscale conversion, luminance interpretation, RGB conversion standards, and gamut handling.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### as_gray

    Default: \`False\`

Conversion into grayscale images.

- False = no conversion applied.
- True = convert into grayscale images.
- Uses rec_standard if linear_luminance is False.
- Uses simple mean(RGB) if linear_luminance is True.

### linear_luminance

Default: \`False\`

Specifies whether pixel values are linearly related to luminance.

If True, SHINIER assumes input images are linear RGB or grayscale. All transformations are applied independently to each channel and no color-space conversion is performed.

If False, SHINIER uses conversion to xyY. Input images are assumed gamma-encoded, such as sRGB, and are converted as sRGB → linRGB → XYZ → xyY. Transformations are applied only to the luminance channel Y, while x and y remain unchanged. Reconstruction proceeds as xyY → XYZ → linRGB → sRGB.

This conversion mode preserves color gamuts and is highly recommended for operations on values that should be linear with luminance, such as {@ref imageprocessor-sf-match|sf_match} and {@ref imageprocessor-lum-match|lum_match}.

### rec_standard

Default: \`2\`

Specifies the Rec. color standard used for RGB to XYZ conversion.

- 1 = Rec.601 for SDTV and legacy systems.
- 2 = Rec.709 for HDTV and sRGB-like behavior.
- 3 = Rec.2020 for UHDTV and wide-gamut HDR.

### gamut_strategy

Default: \`constrain_image_chrominance\`

Specifies the strategy used to deal with out-of-gamut problems when linear_luminance is False.

For a more visual explanation of how SHINIER handles display gamut, clipping, luminance preservation, and chrominance compression, see the {@link #viewer|Viewer}. That page defines much more of the package's color treatment behavior.

Global constraints apply the same transform to the whole dataset and are best for dataset consistency.

- constrain_dataset_luminance: scales luminance of all images down so the most saturated pixel fits. Preserves hue and saturation while compressing contrast and luminance.
- constrain_dataset_chrominance: scales saturation of all images down so the brightest pixel fits. Preserves contrast and luminance while compressing saturation.

Local repairs apply a single transform to all pixels of a given image and are best to maximize image contrast.

- constrain_image_chrominance: darkens all pixels so there are no out-of-gamut pixels.
- constrain_image_luminance: desaturates all pixels so there are no out-of-gamut pixels.
- clip: default color conversion behavior using NumPy safe clipping.
`,
    },
    {
      id: "options-dithering-memory",
      group: "options",
      title: "Dithering / Memory",
      summary: "Controls output quantization strategy and memory behavior during processing.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### dithering

    Default: \`0\`

Dithering applied before final conversion to uint8.

- 0 = no dithering.
- 1 = {@ref utils-noisy-bit-dithering|Noisy bit dithering}.
- 2 = {@ref utils-floyd-steinberg-dithering|Floyd-Steinberg dithering}.

The concrete dispatch logic is documented in {@ref imageprocessor-dithering|ImageProcessor.dithering}.

### conserve_memory

Default: \`True\`

Controls how images are loaded and stored in memory during processing.

If True, SHINIER minimizes memory usage by keeping only one image in memory at a time and by using a temporary directory to save images. If input_data is a list of NumPy arrays, the images are first saved as .npy files in a temporary directory and later loaded one at a time upon request.

If False, SHINIER loads all images into memory at once. This uses substantially more memory but may improve processing speed.
`,
    },
    {
      id: "options-luminance",
      group: "options",
      title: "Luminance Matching",
      summary: "Defines safety behavior and target luminance statistics for luminance matching.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### safe_lum_match

    Default: \`False\` in the class docstring description. In the current model fields, the runtime default is \`True\`.

Adjusts the mean and standard deviation to keep all luminance values in the interval [0, 255].

- True = no values are clipped, but resulting targets may differ from requested values.
- False = values may be clipped, but requested targets stay the same.

See {@ref imageprocessor-lum-match|lum_match} for the actual behavior.

### target_lum

Default: \`(0, 0)\`

Pair of target luminance statistics given as mean and standard deviation.

- The mean must be in [0, 255].
- The standard deviation must be greater than or equal to 0.
- If target_lum is set to (0, 0), SHINIER chooses the target automatically: the target mean becomes the average of the image means, and the target standard deviation becomes the average of the image standard deviations.
- Used only for mode 1.
`,
    },
    {
      id: "options-histogram",
      group: "options",
      title: "Histogram Matching",
      summary:
        "Configures SSIM-based optimization, tie-breaking strategy, optimization iterations, and target histograms.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### hist_optim

    Default: \`False\`

Optimization of histogram-matched images with the structural similarity index measure from Avanaki 2009.

- True = SSIM optimization is enabled.
- False = no SSIM optimization.

Following Avanaki's reported behavior, no tie-breaking strategy is applied while optimizing SSIM except for the very last iteration, where the hybrid strategy is used. The actual SSIM machinery is documented in {@ref utils-ssim-sens|ssim_sens} and the histogram pipeline itself is documented in {@ref imageprocessor-hist-match|hist_match}.

### hist_specification

Default: \`4\`

Determines how isoluminant ties are broken when matching the histogram.

Set this value to None if hist_optim is True.

- 1 = Noise. Exact specification with noise. Adds small uniform noise to break ties quickly, but results are non-deterministic unless the seed is fixed.
- 2 = Moving-average. Coltuc, Bolon, and Chassery 2006 tie-breaking strategy with moving-average filters.
- 3 = Gaussian. Coltuc's tie-breaking strategy with Gaussian filters.
- 4 = Hybrid. Gaussian tie-breaking followed by noise if isoluminant pixels persist.

### hist_iterations

Default: \`10\`

Number of iterations for SSIM optimization when hist_optim is enabled.

### target_hist

Default: \`None\`

Target histogram, image path, \`equal\`, or \`None\`.

Multiple input types are allowed:

- Histogram array:
  Can contain histogram counts or weights. Shape must be \`(256,)\` or \`(256, 1)\` for single-channel processing, or \`(256, C)\` for multi-channel processing such as RGB with \`linear_luminance=True\` and \`as_gray=False\`. Histograms are normalized internally before use.
- Input image file:
  The image is processed using the same pipeline as the dataset to compute the target histogram. Spatial dimensions must match the processed images.
- \`equal\`:
  Uses a flat histogram, i.e. histogram equalization.
- \`None\`:
  Uses the average histogram of all input images.

Used in all modes involving histogram matching: 2, 5, 6, 7, and 8.

See also {@ref utils-imhist|imhist} to compute a target histogram from an image, {@ref utils-imhist-plot|imhist_plot} for histogram visualization, and {@ref utils-show-processing-overview|show_processing_overview} for automatic before/after diagnostics.
`,
    },
    {
      id: "options-fourier",
      group: "options",
      title: "Fourier Matching",
      summary: "Controls post-processing rescaling and target Fourier spectrum selection.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### rescaling

    Default: \`2\`

Post-processing applied after {@ref imageprocessor-sf-match|sf_match} or {@ref imageprocessor-spec-match|spec_match}.

- 0 = no rescaling.
- 1 = rescale each image independently so its own min maps to 0 and max maps to 1.
- 2 = rescale using absolute max and min across the dataset.
- 3 = rescale using average max and min.

This option is not allowed for modes 1 and 2.

### target_spectrum

Default: \`None\`

Target Fourier magnitude spectrum, image path, or \`None\`.

Multiple input types are allowed:

- Magnitude spectrum array:
  Must be a float array. Spatial shape must match the processed images: \`(H, W)\`, or \`(H, W, C)\` for multi-channel processing such as RGB with \`linear_luminance=True\` and \`as_gray=False\`.
- Input image file:
  The image is processed using the same pipeline as the dataset to compute the target spectrum. Spatial dimensions must match the processed images.
- \`None\`:
  Uses the average spectrum of all input images.

Used in all modes involving Fourier matching: 3, 4, 5, 6, 7, and 8.

See also {@ref utils-image-spectrum|image_spectrum} to compute a target spectrum from an image, {@ref utils-spectrum-plot|spectrum_plot}, {@ref utils-im-power-spectrum-plot|im_power_spectrum_plot}, {@ref utils-sf-plot|sf_plot}, and {@ref utils-show-processing-overview|show_processing_overview}.
`,
    },
    {
      id: "options-misc",
      group: "options",
      title: "Misc",
      summary: "Defines verbosity levels for logs and progress reporting.",
      sourceLabel: "Options class docstring",
      sourcePath: "src/shinier/Options.py",
      content: `
### verbose

    Default: \`0\`

Controls verbosity levels.

- -1 = quiet mode.
- 0 = progress bar with ETA.
- 1 = basic progress steps without progress bar.
- 2 = additional information about image and channel processing.
- 3 = developer debug mode.
`,
    },
    {
      id: "imageprocessor-dithering",
      group: "imageprocessor",
      title: "dithering",
      summary:
        "Applies the final quantization step per image using noisy-bit, Floyd-Steinberg, or plain uint8 conversion.",
      sourceLabel: "ImageProcessor.dithering",
      sourcePath: "src/shinier/ImageProcessor.py",
      content: `
Applies a dithering effect to a collection of images based on the specified dithering mode.

This function processes each image in the input collection individually and applies the appropriate dithering method. Supported methods include noisy bit dithering, Floyd-Steinberg dithering, and a standard uint8 conversion, depending on the selected mode. The processed images are stored in the provided output collection.

### Args

- input_collection: collection of input images to be processed.
- output_collection: collection where processed images will be stored.
- dithering: integer selecting the dithering method. Value 1 corresponds to {@ref utils-noisy-bit-dithering|noisy_bit_dithering}, value 2 corresponds to {@ref utils-floyd-steinberg-dithering|floyd_steinberg_dithering}, and other values default to standard uint8 conversion.

### Returns

Collection containing the processed images after the selected dithering effect is applied.
`,
    },
    {
      id: "imageprocessor-lum-match",
      group: "imageprocessor",
      title: "lum_match",
      summary:
        "Matches the mean and standard deviation of input images to a target luminance profile with optional safe-range adjustment.",
      sourceLabel: "ImageProcessor.lum_match",
      sourcePath: "src/shinier/ImageProcessor.py",
      content: `
Matches the mean and standard deviation of a set of images.

If target_lum is provided, it matches the mean and standard deviation of target_lum, where the first value is the mean and the second is the standard deviation. If safe_values is enabled, the method finds a target mean and standard deviation close to the requested target while avoiding out-of-range values outside [0, 255].

### Warnings

- Clipping should be applied before uint8 conversion because np.uint8 and astype('uint8') wrap around for out-of-range values. Example: np.array([-2, 256]).astype('uint8') becomes [254, 0].
- When safe_values is true, the resulting target mean and standard deviation may differ from the requested or grand-average values because the method searches for a safer pair that prevents out-of-range luminance.

### Behavior summary

1. Compute the original means and standard deviations.
2. Compute target statistics if they are not provided.
3. Adjust target statistics if safe_values is enabled and predicted values would go out of range.
4. Standardize image values against the target statistics.
5. Save the transformed image and validate observed mean and standard deviation.
`,
    },
    {
      id: "imageprocessor-hist-match",
      group: "imageprocessor",
      title: "hist_match",
      summary:
        "Performs exact histogram specification, optionally optimized with SSIM, using configurable tie-breaking strategies.",
      sourceLabel: "ImageProcessor.hist_match",
      sourcePath: "src/shinier/ImageProcessor.py",
      content: `
Performs histogram matching on a collection of images to adjust their pixel intensities so they match a target histogram.

The method includes optional optimization steps that enhance the structural similarity index measure during the histogram matching process.

### Notes

- The input image collection, target histogram, and optimization options are managed as class-level attributes.
- Includes safeguards to process images with different dynamic ranges.
- Applies faster and deterministic exact histogram mapping whenever possible.
- Structural similarity and gradient maps are computed to guide optimization when enabled.

### Warnings

- Grayscale images: hist_match operates directly on intensity values and does not assume linear luminance scaling.
- Color images: by default, hist_match is applied independently to each color channel. This may produce inaccurate color relationships or out-of-gamut results.
- If joint color consistency is required, consider using joint RGB distribution matching or another color-aware strategy.

### Raises

ValueError if the target histogram's number of bins does not match the dynamic range of processed images.

### Related references

- {@ref utils-ssim-sens|ssim_sens} for SSIM gradients.
- {@ref utils-imhist-plot|imhist_plot} for histogram visualization.
`,
    },
    {
      id: "imageprocessor-sf-match",
      group: "imageprocessor",
      title: "sf_match",
      summary:
        "Matches rotational spatial-frequency energy to a target radial spectrum while preserving image phase.",
      sourceLabel: "ImageProcessor.sf_match",
      sourcePath: "src/shinier/ImageProcessor.py",
      content: `
Match spatial frequencies of input images to a target rotational spectrum.

This function performs spatial frequency matching by adjusting the rotational average of the Fourier amplitude of each input image so it matches the target spectrum. Each image's magnitude spectrum is scaled relative to the target spectrum while preserving its original phase, then reconstructed in the spatial domain.

### Notes

- get_images_spectra stretches input to [0, 1].
- Frequencies beyond the Nyquist limit are set to zero to avoid aliasing.
- The adjustment is performed independently for each channel.
- The method uses cart2pol and pol2cart to switch between Cartesian and polar Fourier representations.
- Output values are typically out of range. This is not necessarily problematic in iterative modes 5 and 7, because hist_match may benefit from images without duplicated values. Values are readjusted when the operation is the last one in the pipeline.

### Related references

- {@ref utils-sf-plot|sf_plot} for rotational spectrum plots.
- {@ref utils-spectrum-plot|spectrum_plot} for 2D spectrum display.
`,
    },
    {
      id: "imageprocessor-spec-match",
      group: "imageprocessor",
      title: "spec_match",
      summary:
        "Matches the full 2D Fourier magnitude spectrum while preserving original phase information.",
      sourceLabel: "ImageProcessor.spec_match",
      sourcePath: "src/shinier/ImageProcessor.py",
      content: `
Match the full magnitude spectrum of images to a target spectrum.

This function reconstructs images whose Fourier magnitude is replaced by the target_spectrum while preserving the original Fourier phase. The inverse FFT is then used to return to the spatial domain.

### Notes

- Phase information from each input image is preserved.
- Output values are real-valued because only the magnitude is replaced.
- Output values are typically out of range. This is not necessarily a problem in iterative modes 6 and 8, where hist_match may benefit from images without duplicated values. Values are readjusted when the operation is the last one in the pipeline.

### Related references

- {@ref utils-spectrum-plot|spectrum_plot} for visualizing the target spectrum.
- {@ref utils-im-power-spectrum-plot|im_power_spectrum_plot} for centered power-spectrum visualization.
`,
    },
    {
      id: "utils-imhist",
      group: "utils",
      title: "imhist",
      summary:
        "Computes grayscale or per-channel image histograms, optionally normalized and optionally restricted to a binary mask.",
      sourceLabel: "utils.imhist",
      sourcePath: "src/shinier/utils.py",
      content: `
Computes an image histogram over the \`[0, 255]\` intensity range.

This utility is the simplest way to derive a target histogram from an image before passing it to {@ref options-histogram|target_hist}. It can operate on grayscale or RGB arrays, and can optionally normalize the histogram into weights that sum to 1.

### Typical use

- Build a target histogram from an image.
- Compare histograms across images.
- Feed the result into {@ref utils-imhist-plot|imhist_plot} or validation helpers.

### Args

- image: input image array, grayscale or RGB.
- mask: optional binary mask restricting which pixels contribute.
- n_bins: number of histogram bins, typically 256 for 8-bit data.
- normalized: if True, returns histogram weights instead of raw counts.

### Returns

Histogram array of shape \`(256,)\` for single-channel data or \`(256, C)\` for multi-channel data.

### Related references

- {@ref options-histogram|target_hist} for how histogram targets are used in SHINIER.
- {@ref utils-imhist-plot|imhist_plot} for visualization.
- {@ref utils-show-processing-overview|show_processing_overview} for automatic before/after overview figures.
`,
    },
    {
      id: "utils-image-spectrum",
      group: "utils",
      title: "image_spectrum",
      summary:
        "Computes the Fourier magnitude and phase of an image and is the main helper for building target_spectrum arrays.",
      sourceLabel: "utils.image_spectrum",
      sourcePath: "src/shinier/utils.py",
      content: `
Computes the Fourier spectrum of an image and returns its magnitude and phase.

This is the main helper for building a \`target_spectrum\` array when you want to provide a precomputed target instead of an input image path. The returned magnitude can be used directly as a target for {@ref options-fourier|target_spectrum}.

### Typical use

- Build a Fourier magnitude target from an image.
- Inspect magnitude and phase separately.
- Prepare custom targets for {@ref imageprocessor-sf-match|sf_match} or {@ref imageprocessor-spec-match|spec_match}.

### Args

- image: input image array.
- rescale: if True, stretches the image to \`[0, 1]\` before the FFT; if False, assumes the input scale is already appropriate.

### Returns

Tuple \`(magnitude, phase)\`, each with the same spatial shape as the processed image, and with matching channels when multiple channels are processed independently.

### Related references

- {@ref options-fourier|target_spectrum} for how precomputed spectrum targets are used.
- {@ref utils-spectrum-plot|spectrum_plot}, {@ref utils-im-power-spectrum-plot|im_power_spectrum_plot}, and {@ref utils-sf-plot|sf_plot} for visualization.
- {@ref utils-show-processing-overview|show_processing_overview} for automatic before/after plotting.
`,
    },
    {
      id: "utils-show-processing-overview",
      group: "utils",
      title: "show_processing_overview",
      summary:
        "Generates the most complete automatic before/after diagnostic figure in SHINIER, with images and plots for every active processing step.",
      sourceLabel: "utils.show_processing_overview",
      sourcePath: "src/shinier/utils.py",
      content: `
Displays before/after images and diagnostics for all processing steps in one figure.

This is the clearest utility to inspect SHINIER results almost automatically. It adapts the layout to the active mode and stacks the relevant plots for each processing stage, making it the best default diagnostic figure when you want a quick visual summary of the transformation.

### Layout

- Row 1: before and after images.
- Additional rows: one row per active processing step, with before on the left and after on the right.
- Histogram, spatial-frequency, or spectrum plots are chosen automatically depending on the mode.

### Args

- processor: SHINIER \`ImageProcessor\` instance.
- img_idx: index of the image to visualize.
- show_figure: if False, returns the figure without calling \`show()\`.
- show_initial_target: if True, plots the initial target in composite modes.

### Returns

Matplotlib figure summarizing the image transformations.

### Example

\`\`\`
from shinier import ImageProcessor, ImageDataset, Options
from shinier.utils import show_processing_overview

processor = ImageProcessor(dataset=ImageDataset(options=Options(mode=2)))
fig = show_processing_overview(processor, img_idx=0, show_figure=False)
fig.savefig("processing_overview.svg", format="svg")
\`\`\`

### Related references

- {@ref utils-imhist-plot|imhist_plot}, {@ref utils-sf-plot|sf_plot}, and {@ref utils-spectrum-plot|spectrum_plot} for the underlying plots.
- {@ref options-histogram|target_hist} and {@ref options-fourier|target_spectrum} for target definitions.
`,
    },
    {
      id: "utils-imhist-plot",
      group: "utils",
      title: "imhist_plot",
      summary:
        "Displays an image together with its histogram, grayscale intensity bar, optional target histogram, and optional descriptive overlays.",
      sourceLabel: "utils.imhist_plot",
      sourcePath: "src/shinier/utils.py",
      content: `
Displays an image with its histogram and optional descriptive statistics.

The image is shown on top, with a compact horizontal histogram below. A grayscale gradient bar from 0 to 255 is placed directly under the histogram.

When descriptives is enabled, the histogram includes:

- A vertical line indicating the mean.
- A translucent band spanning mean minus standard deviation to mean plus standard deviation.

For RGB images, mean and standard deviation are computed and displayed per channel.

### Args

- img: input image. Accepts grayscale or RGB arrays. Alpha channels are ignored if present.
- bins: number of histogram bins in [0, 255].
- figsize: Matplotlib figure size.
- dpi: Matplotlib figure DPI.
- title: optional title.
- target_hist: optional target histogram overlaid on the plot.
- binary_mask: optional mask for histogram computation.
- descriptives: overlay mean and standard deviation information.
- ax: axes on which to render.
- show_normalized_rmse: shows normalized RMSE when a target histogram is provided.

### Returns

Tuple containing the created figure and the image, bar, and histogram axes.
`,
    },
    {
      id: "utils-sf-plot",
      group: "utils",
      title: "sf_plot",
      summary:
        "Plots the rotational average of Fourier energy on log-log axes and can compare it with a target radial spectrum.",
      sourceLabel: "utils.sf_plot",
      sourcePath: "src/shinier/utils.py",
      content: `
Rotational average of the Fourier energy spectrum.

### Args

- image: image array of shape (H, W) or (H, W, 3). Can be uint8 or float.
- sf_p: if provided, uses an existing spatial-frequency profile instead of generating a new one.
- target_sf: if provided, displays the target spatial-frequency profile against the measured one.
- ax: axes to use instead of creating a new figure.
- show_normalized_rmse: if True, shows normalized RMSE on the graph.

### Returns

Matplotlib figure containing the spatial-frequency plot.
`,
    },
    {
      id: "utils-spectrum-plot",
      group: "utils",
      title: "spectrum_plot",
      summary:
        "Displays a Fourier magnitude spectrum with optional log scaling, gamma correction, and colorbar.",
      sourceLabel: "utils.spectrum_plot",
      sourcePath: "src/shinier/utils.py",
      content: `
Display a Fourier magnitude spectrum with optional log and gamma scaling.

### Args

- spectrum: Fourier magnitude or power spectrum to display.
- cmap: Matplotlib colormap.
- log: apply log1p scaling before display.
- gamma: optional gamma correction after stretching to [0, 1].
- ax: optional axes for rendering.
- with_colorbar: whether to show the colorbar.
- colorbar_label: label for the colorbar.
- target_spectrum: optional target used for normalized RMSE display.
- show_normalized_rmse: if True, shows normalized RMSE above the figure.

### Returns

Matplotlib figure containing the spectrum display.
`,
    },
    {
      id: "utils-im-power-spectrum-plot",
      group: "utils",
      title: "im_power_spectrum_plot",
      summary:
        "Shows a centered 2D log-scaled Fourier power spectrum, emphasizing spatial frequency and orientation energy.",
      sourceLabel: "utils.im_power_spectrum_plot",
      sourcePath: "src/shinier/utils.py",
      content: `
2D log-scaled Fourier power spectrum, centered.

This visualization shows the distribution of image energy across spatial frequencies and orientations. The center of the plot corresponds to low spatial frequencies, while the edges represent high frequencies. Brightness indicates amplitude at a given spatial frequency and orientation.

### Args

- im: image array of shape (H, W) or (H, W, 3). Can be uint8 or float. RGB data is converted to luminance.
- with_colorbar: whether to show the colorbar on the right side.

### Returns

Matplotlib figure containing the power-spectrum image.
`,
    },
    {
      id: "utils-ssim-sens",
      group: "utils",
      title: "ssim_sens",
      summary:
        "Computes the Structural Similarity Index and the gradient of SSIM used to optimize histogram matching.",
      sourceLabel: "utils.ssim_sens",
      sourcePath: "src/shinier/utils.py",
      content: `
Compute the Structural Similarity Index and its gradient.

### Args

- image1: first image as a 3D array.
- image2: second image as a 3D array.
- data_range: dynamic range of pixel values.
- use_sample_covariance: if True, uses sample covariance for SSIM computation. Avanaki 2009 and Wang et al. 2004 used population covariance.
- binary_mask: binary mask used to zero out masked regions and normalize accordingly.

### Returns

Tuple containing:

- Gradient of SSIM, also called sensitivity, as an array.
- Mean SSIM values as floating-point results.

### References

1. Avanaki, A.N. Exact global histogram specification optimized for structural similarity.
2. Wang, Bovik, Sheikh, and Simoncelli. Image quality assessment: from error visibility to structural similarity.

### Notes

The implementation is intended to match scikit-image SSIM computations when using data_range = 255, channel_axis = -1, win_size = 11, and gaussian_weights = True.
`,
    },
    {
      id: "utils-floyd-steinberg-dithering",
      group: "utils",
      title: "floyd_steinberg_dithering",
      summary:
        "Implements classic Floyd-Steinberg error-diffusion dithering on float images in [0, 1].",
      sourceLabel: "utils.floyd_steinberg_dithering",
      sourcePath: "src/shinier/utils.py",
      content: `
Implements the dithering algorithm presented in Floyd and Steinberg, 1976.

### Args

- image: image of floats ranging from 0 to 1.
- depth: number of gray shades.
- legacy_mode: if True, uses MATLAB-style rounding.

### Returns

Processed image containing integer luminance levels. Output uses the smallest integer dtype that fits the number of levels.

### Notes

If the input is an integer array, the helper first converts it into float values in [0, 1]. Internally it delegates to a generic error-diffusion routine.
`,
    },
    {
      id: "utils-noisy-bit-dithering",
      group: "utils",
      title: "noisy_bit_dithering",
      summary:
        "Implements noisy-bit dithering by adding random perturbations before rounding luminance levels.",
      sourceLabel: "utils.noisy_bit_dithering",
      sourcePath: "src/shinier/utils.py",
      content: `
Implements the noisy-bit method for digital displays introduced by Allard and Faubert, 2008.

### Args

- image: image of floats ranging from 0 to 1.
- depth: number of gray shades.
- legacy_mode: if True, uses MATLAB-style rounding.

### Returns

Processed image containing integer luminance levels. Output uses the smallest integer dtype that fits all values.

### Example

\`\`\`
processed_image = noisy_bit_dithering(image, depth=256)
\`\`\`

### Notes

The example assumes RGB values are linearly related to luminance values. If that is not the case, a lookup table should be used to transform integer values into RGB values corresponding to evenly spaced luminance values.

The implementation includes slight modifications for MATLAB compatibility.
`,
    },
  ],
};

export const DOC_SECTION_INDEX = new Map(
  SHINIER_DOCS.sections.map((section) => [section.id, section]),
);
