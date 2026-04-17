import React, { Fragment, useEffect, useMemo, useState } from "react";
import {
  DOC_SECTION_INDEX,
  SHINIER_DOCS,
  type DocGroup,
  type DocSection,
} from "../docsData";

type BuilderField = {
  key: string;
  label: string;
  description: string;
  control: "text" | "select" | "textarea";
  serializeMode: "string" | "python";
  defaultLabel: string;
  value: string;
  options?: Array<{ label: string; value: string }>;
};

type BuilderGroup = {
  id: string;
  title: string;
  description: string;
  fields: BuilderField[];
};

type BuilderState = Record<string, { enabled: boolean; value: string }>;

const OPTIONS_BUILDER_GROUPS: BuilderGroup[] = [
  {
    id: "io",
    title: "Input / Output",
    description: "Folder paths and mask loading behavior.",
    fields: [
      {
        key: "input_folder",
        label: "input_folder",
        description: "Input images folder.",
        control: "text",
        serializeMode: "string",
        defaultLabel: 'REPO_ROOT / "data/INPUT"',
        value: "data/INPUT",
      },
      {
        key: "output_folder",
        label: "output_folder",
        description: "Output folder for processed images.",
        control: "text",
        serializeMode: "string",
        defaultLabel: 'REPO_ROOT / "data/OUTPUT"',
        value: "data/OUTPUT",
      },
      {
        key: "masks_folder",
        label: "masks_folder",
        description: "Optional folder containing ROI masks.",
        control: "text",
        serializeMode: "python",
        defaultLabel: "None",
        value: "None",
      },
      {
        key: "whole_image",
        label: "whole_image",
        description: "Mask interpretation mode.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "1",
        value: "1",
        options: [
          { label: "1 · whole images", value: "1" },
          { label: "2 · ROI from non-background pixels", value: "2" },
          { label: "3 · ROI from MASK folder", value: "3" },
        ],
      },
      {
        key: "background",
        label: "background",
        description: "Mask background grayscale value or 300 for auto-detection.",
        control: "text",
        serializeMode: "python",
        defaultLabel: "300",
        value: "300",
      },
    ],
  },
  {
    id: "mode",
    title: "Mode",
    description: "Processing mode, legacy behavior, seed, and iterations.",
    fields: [
      {
        key: "mode",
        label: "mode",
        description: "Main SHINIER pipeline mode.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "runtime default 2",
        value: "2",
        options: [
          { label: "1 · lum_match", value: "1" },
          { label: "2 · hist_match", value: "2" },
          { label: "3 · sf_match", value: "3" },
          { label: "4 · spec_match", value: "4" },
          { label: "5 · hist_match then sf_match", value: "5" },
          { label: "6 · hist_match then spec_match", value: "6" },
          { label: "7 · sf_match then hist_match", value: "7" },
          { label: "8 · spec_match then hist_match", value: "8" },
          { label: "9 · dithering only", value: "9" },
        ],
      },
      {
        key: "legacy_mode",
        label: "legacy_mode",
        description: "Reproduce legacy package defaults.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "False",
        value: "False",
        options: [
          { label: "False", value: "False" },
          { label: "True", value: "True" },
        ],
      },
      {
        key: "seed",
        label: "seed",
        description: "Pseudo-random seed for histogram tie-breaking and dithering.",
        control: "text",
        serializeMode: "python",
        defaultLabel: "None",
        value: "None",
      },
      {
        key: "iterations",
        label: "iterations",
        description: "Number of composite-mode iterations.",
        control: "text",
        serializeMode: "python",
        defaultLabel: "runtime default 5",
        value: "5",
      },
    ],
  },
  {
    id: "color",
    title: "Color",
    description: "Grayscale conversion, luminance interpretation, and gamut handling.",
    fields: [
      {
        key: "as_gray",
        label: "as_gray",
        description: "Convert images to grayscale before processing.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "False",
        value: "False",
        options: [
          { label: "False", value: "False" },
          { label: "True", value: "True" },
        ],
      },
      {
        key: "linear_luminance",
        label: "linear_luminance",
        description: "Treat values as linear with luminance.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "False",
        value: "False",
        options: [
          { label: "False", value: "False" },
          { label: "True", value: "True" },
        ],
      },
      {
        key: "rec_standard",
        label: "rec_standard",
        description: "RGB to XYZ conversion standard.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "2",
        value: "2",
        options: [
          { label: "1 · Rec.601", value: "1" },
          { label: "2 · Rec.709", value: "2" },
          { label: "3 · Rec.2020", value: "3" },
        ],
      },
      {
        key: "gamut_strategy",
        label: "gamut_strategy",
        description: "Out-of-gamut repair strategy.",
        control: "select",
        serializeMode: "string",
        defaultLabel: "constrain_image_chrominance",
        value: "constrain_image_chrominance",
        options: [
          { label: "constrain_dataset_luminance", value: "constrain_dataset_luminance" },
          { label: "constrain_dataset_chrominance", value: "constrain_dataset_chrominance" },
          { label: "constrain_image_chrominance", value: "constrain_image_chrominance" },
          { label: "constrain_image_luminance", value: "constrain_image_luminance" },
          { label: "clip", value: "clip" },
        ],
      },
    ],
  },
  {
    id: "dithering-memory",
    title: "Dithering / Memory",
    description: "Output quantization and memory usage.",
    fields: [
      {
        key: "dithering",
        label: "dithering",
        description: "Dithering method before uint8 conversion.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "0",
        value: "0",
        options: [
          { label: "0 · no dithering", value: "0" },
          { label: "1 · noisy bit", value: "1" },
          { label: "2 · Floyd-Steinberg", value: "2" },
        ],
      },
      {
        key: "conserve_memory",
        label: "conserve_memory",
        description: "Process images one at a time to reduce RAM usage.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "True",
        value: "True",
        options: [
          { label: "True", value: "True" },
          { label: "False", value: "False" },
        ],
      },
    ],
  },
  {
    id: "luminance",
    title: "Luminance",
    description: "Target luminance statistics and clipping safety.",
    fields: [
      {
        key: "safe_lum_match",
        label: "safe_lum_match",
        description: "Keep luminance targets inside the valid range.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "runtime default True",
        value: "True",
        options: [
          { label: "True", value: "True" },
          { label: "False", value: "False" },
        ],
      },
      {
        key: "target_lum",
        label: "target_lum",
        description: "Target mean and standard deviation as a Python tuple. Use (0, 0) to let SHINIER compute both automatically from the dataset averages.",
        control: "text",
        serializeMode: "python",
        defaultLabel: "(0, 0) = automatic dataset averages",
        value: "(0, 0)",
      },
    ],
  },
  {
    id: "histogram",
    title: "Histogram",
    description: "Exact histogram specification and SSIM optimization parameters.",
    fields: [
      {
        key: "hist_optim",
        label: "hist_optim",
        description: "Enable SSIM optimization after histogram matching.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "False",
        value: "False",
        options: [
          { label: "False", value: "False" },
          { label: "True", value: "True" },
        ],
      },
      {
        key: "hist_specification",
        label: "hist_specification",
        description: "Tie-breaking strategy for exact histogram matching.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "4",
        value: "4",
        options: [
          { label: "None", value: "None" },
          { label: "1 · noise", value: "1" },
          { label: "2 · moving-average", value: "2" },
          { label: "3 · Gaussian", value: "3" },
          { label: "4 · hybrid", value: "4" },
        ],
      },
      {
        key: "hist_iterations",
        label: "hist_iterations",
        description: "Number of SSIM optimization iterations.",
        control: "text",
        serializeMode: "python",
        defaultLabel: "10",
        value: "10",
      },
      {
        key: "target_hist",
        label: "target_hist",
        description: "Python expression for the target histogram or None.",
        control: "textarea",
        serializeMode: "python",
        defaultLabel: "None",
        value: "None",
      },
    ],
  },
  {
    id: "fourier",
    title: "Fourier",
    description: "Spectrum rescaling and target magnitude spectrum.",
    fields: [
      {
        key: "rescaling",
        label: "rescaling",
        description: "Post-processing rescaling after spectrum-based matching.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "2",
        value: "2",
        options: [
          { label: "0 · none", value: "0" },
          { label: "1 · image min/max", value: "1" },
          { label: "2 · dataset absolute min/max", value: "2" },
          { label: "3 · dataset average min/max", value: "3" },
        ],
      },
      {
        key: "target_spectrum",
        label: "target_spectrum",
        description: "Python expression for the target spectrum or None.",
        control: "textarea",
        serializeMode: "python",
        defaultLabel: "None",
        value: "None",
      },
    ],
  },
  {
    id: "misc",
    title: "Misc",
    description: "Verbosity and diagnostics.",
    fields: [
      {
        key: "verbose",
        label: "verbose",
        description: "Logging and progress-report level.",
        control: "select",
        serializeMode: "python",
        defaultLabel: "0",
        value: "0",
        options: [
          { label: "-1 · quiet", value: "-1" },
          { label: "0 · progress bar", value: "0" },
          { label: "1 · basic steps", value: "1" },
          { label: "2 · extra image info", value: "2" },
          { label: "3 · debug", value: "3" },
        ],
      },
    ],
  },
];

function createInitialBuilderState(): BuilderState {
  return Object.fromEntries(
    OPTIONS_BUILDER_GROUPS.flatMap((group) =>
      group.fields.map((field) => [field.key, { enabled: false, value: field.value }]),
    ),
  );
}

function serializePythonValue(field: BuilderField, value: string) {
  if (field.serializeMode === "string") {
    const escaped = value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `'${escaped}'`;
  }

  return value.trim() || "None";
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseByteValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampByte(parsed) : fallback;
}

function parseTargetLumValue(value: string) {
  const matches = value.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const mean = parseByteValue(matches[0] ?? "0", 0);
  const std = parseByteValue(matches[1] ?? "0", 0);
  return { mean, std };
}

function buildOptionsSnippet(builderState: BuilderState) {
  const selectedFields = OPTIONS_BUILDER_GROUPS.flatMap((group) =>
    group.fields
      .filter((field) => builderState[field.key]?.enabled)
      .map((field) => `    ${field.key}=${serializePythonValue(field, builderState[field.key].value)},`),
  );

  if (!selectedFields.length) {
    return [
      "from shinier import ImageDataset, ImageProcessor, Options",
      "",
      "opts = Options()",
      "# Add only the parameters you want to override.",
      "",
      "dataset = ImageDataset(options=opts)",
      "results = ImageProcessor(dataset=dataset)",
      "# Processed images are saved to the configured output_folder (the OUTPUT path).",
      "# They are also available in results.dataset.images",
    ].join("\n");
  }

  return [
    "from shinier import ImageDataset, ImageProcessor, Options",
    "",
    "opts = Options(",
    ...selectedFields,
    ")",
    "",
    "dataset = ImageDataset(options=opts)",
    "results = ImageProcessor(dataset=dataset)",
    "# Processed images are saved to the configured output_folder (the OUTPUT path).",
    "# They are also available in results.dataset.images",
  ].join("\n");
}

type InlinePart =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; href: string; label: string }
  | { type: "xref"; targetId: string; label: string };

type ReferenceState = {
  section: DocSection;
  sourceLabel: string;
};

type GroupedSections = {
  group: DocGroup;
  sections: DocSection[];
};

function parseInline(content: string): InlinePart[] {
  const pattern = /(\{@ref\s+([a-z0-9-]+)\|([^}]+)\})|(\{@link\s+([^|}]+)\|([^}]+)\})|(`[^`]+`)/gi;
  const parts: InlinePart[] = [];
  let lastIndex = 0;
  let match = pattern.exec(content);

  while (match) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      parts.push({ type: "xref", targetId: match[2], label: match[3] });
    } else if (match[4]) {
      parts.push({ type: "link", href: match[5].trim(), label: match[6] });
    } else if (match[7]) {
      parts.push({ type: "code", value: match[7].slice(1, -1) });
    }

    lastIndex = pattern.lastIndex;
    match = pattern.exec(content);
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts;
}

function renderInline(
  content: string,
  onReferenceOpen: (targetId: string, sourceLabel: string) => void,
  sourceLabel: string,
) {
  return parseInline(content).map((part, index) => {
    if (part.type === "text") {
      return <Fragment key={`${sourceLabel}-text-${index}`}>{part.value}</Fragment>;
    }

    if (part.type === "code") {
      return (
        <code key={`${sourceLabel}-code-${index}`} className="docs-inline-code">
          {part.value}
        </code>
      );
    }

    if (part.type === "link") {
      return (
        <a
          key={`${sourceLabel}-link-${index}`}
          className="docs-link"
          href={part.href}
        >
          {part.label}
        </a>
      );
    }

    return (
      <button
        key={`${sourceLabel}-xref-${index}`}
        type="button"
        className="docs-xref"
        data-hint="Cliquer pour ouvrir le renvoi"
        onClick={() => onReferenceOpen(part.targetId, sourceLabel)}
      >
        {part.label}
      </button>
    );
  });
}

function renderMarkdownLite(
  content: string,
  onReferenceOpen: (targetId: string, sourceLabel: string) => void,
  sourceLabel: string,
) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let index = 0;

  const flushParagraph = (paragraphLines: string[]) => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(" ").trim();
    if (!text) return;
    elements.push(
      <p key={`${sourceLabel}-paragraph-${elements.length}`} className="docs-paragraph">
        {renderInline(text, onReferenceOpen, sourceLabel)}
      </p>,
    );
  };

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      elements.push(
        <pre key={`${sourceLabel}-codeblock-${elements.length}`} className="docs-code-block">
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`${sourceLabel}-h3-${elements.length}`} className="docs-subheading">
          {renderInline(line.slice(4).trim(), onReferenceOpen, sourceLabel)}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`${sourceLabel}-h2-${elements.length}`} className="docs-heading">
          {renderInline(line.slice(3).trim(), onReferenceOpen, sourceLabel)}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) {
        quoteLines.push(lines[index].trimStart().slice(1).trim());
        index += 1;
      }
      elements.push(
        <blockquote key={`${sourceLabel}-quote-${elements.length}`} className="docs-callout docs-callout--note">
          {renderInline(quoteLines.join(" "), onReferenceOpen, sourceLabel)}
        </blockquote>,
      );
      continue;
    }

    if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      const ordered = /^\d+\.\s+/.test(line);
      while (index < lines.length) {
        const current = lines[index].trim();
        if (ordered && /^\d+\.\s+/.test(current)) {
          items.push(current.replace(/^\d+\.\s+/, ""));
          index += 1;
          continue;
        }
        if (!ordered && /^[-*]\s+/.test(current)) {
          items.push(current.replace(/^[-*]\s+/, ""));
          index += 1;
          continue;
        }
        break;
      }
      const ListTag = ordered ? "ol" : "ul";
      elements.push(
        <ListTag key={`${sourceLabel}-list-${elements.length}`} className="docs-list">
          {items.map((item, itemIndex) => (
            <li key={`${sourceLabel}-list-item-${itemIndex}`}>{renderInline(item, onReferenceOpen, sourceLabel)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const paragraphLines: string[] = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index].trim();
      if (!nextLine) {
        index += 1;
        break;
      }
      if (
        nextLine.startsWith("## ") ||
        nextLine.startsWith("### ") ||
        nextLine.startsWith("```") ||
        nextLine.startsWith(">") ||
        /^[-*]\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    flushParagraph(paragraphLines);
  }

  return elements;
}

function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (!element) return;

  window.history.replaceState(null, "", `#docs:${sectionId}`);
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function DocsPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>(SHINIER_DOCS.sections[0]?.id ?? "");
  const [reference, setReference] = useState<ReferenceState | null>(null);
  const [isOptionsBuilderOpen, setIsOptionsBuilderOpen] = useState(false);
  const [optionsBuilderState, setOptionsBuilderState] = useState<BuilderState>(() => createInitialBuilderState());
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const sectionsByGroup = useMemo<GroupedSections[]>(() => {
    return SHINIER_DOCS.groups.map((group: DocGroup) => ({
      group,
      sections: SHINIER_DOCS.sections.filter((section: DocSection) => section.group === group.id),
    }));
  }, []);

  const optionsSnippet = useMemo(() => buildOptionsSnippet(optionsBuilderState), [optionsBuilderState]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#docs:")) {
      const sectionId = hash.slice("#docs:".length);
      requestAnimationFrame(() => scrollToSection(sectionId));
      setActiveSectionId(sectionId);
    }
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const elements = SHINIER_DOCS.sections
      .map((section: DocSection) => document.getElementById(section.id))
      .filter((element: HTMLElement | null): element is HTMLElement => Boolean(element));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries[0]) {
          setActiveSectionId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    elements.forEach((element: HTMLElement) => observer.observe(element));
    observers.push(observer);

    return () => {
      observers.forEach((currentObserver) => currentObserver.disconnect());
    };
  }, []);

  const openReference = (targetId: string, sourceLabel: string) => {
    const section = DOC_SECTION_INDEX.get(targetId);
    if (!section) return;
    setReference({ section, sourceLabel });
  };

  const setBuilderFieldEnabled = (fieldKey: string, enabled: boolean) => {
    setOptionsBuilderState((currentState) => ({
      ...currentState,
      [fieldKey]: {
        ...currentState[fieldKey],
        enabled,
      },
    }));
  };

  const setBuilderFieldValue = (fieldKey: string, value: string) => {
    setOptionsBuilderState((currentState) => ({
      ...currentState,
      [fieldKey]: {
        ...currentState[fieldKey],
        enabled: true,
        value,
      },
    }));
  };

  const setBackgroundValue = (rawValue: string) => {
    setBuilderFieldValue("background", String(parseByteValue(rawValue, 0)));
  };

  const setBackgroundAutomatic = (enabled: boolean) => {
    setBuilderFieldValue("background", enabled ? "300" : "0");
  };

  const setTargetLumPart = (part: "mean" | "std", rawValue: string) => {
    const current = parseTargetLumValue(optionsBuilderState.target_lum?.value ?? "(0, 0)");
    const nextValue = parseByteValue(rawValue, part === "mean" ? current.mean : current.std);
    const next = part === "mean" ? { mean: nextValue, std: current.std } : { mean: current.mean, std: nextValue };
    setBuilderFieldValue("target_lum", `(${next.mean}, ${next.std})`);
  };

  const resetBuilder = () => {
    setOptionsBuilderState(createInitialBuilderState());
    setCopyStatus("idle");
  };

  const copyOptionsSnippet = async () => {
    try {
      await navigator.clipboard.writeText(optionsSnippet);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch {
      setCopyStatus("idle");
    }
  };

  return (
    <div className="docs-page">
      <aside className="docs-sidebar">
        <div className="docs-sidebar__inner">
          <div className="docs-sidebar__label">Package docs</div>
          <h1 className="docs-sidebar__title">SHINIER</h1>
          <p className="docs-sidebar__version">{SHINIER_DOCS.metadata.lastUpdatedLabel}</p>
          <p className="docs-sidebar__meta">Source: GitHub {SHINIER_DOCS.metadata.sourceBranch}</p>

          <nav className="docs-toc" aria-label="Documentation table of contents">
            {sectionsByGroup.map(({ group, sections }: GroupedSections) => (
              <section key={group.id} className="docs-toc__group">
                <div className="docs-toc__group-title">{group.title}</div>
                <p className="docs-toc__group-description">{group.description}</p>
                <ul className="docs-toc__list">
                  {sections.map((section: DocSection) => (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={`docs-toc__link ${activeSectionId === section.id ? "is-active" : ""}`}
                        onClick={() => scrollToSection(section.id)}
                      >
                        {section.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </div>
      </aside>

      <section className="docs-content">
        <div className="docs-hero">
          <div>
            <div className="docs-kicker">Package reference</div>
            <h2 className="docs-title">SHINIER package documentation</h2>
            <p className="docs-lead">
              This tab centralizes the essential package usage information: the Options model, the main ImageProcessor methods, and a focused subset of utility functions needed to work effectively with SHINIER.
            </p>
          </div>
          <a className="docs-source-link" href={SHINIER_DOCS.metadata.githubUrl} target="_blank" rel="noreferrer">
            Open GitHub source
          </a>
        </div>

        <div className="docs-callout">
          This is not the full documentation set. It is the essential subset needed to use the package effectively. More technical details and additional documentation live in the package source files, scripts, and GitHub repository. SHINIER also provides a guided CLI through the shell command <code className="docs-inline-code">shinier</code>, which asks interactive questions and helps configure processing step by step.
        </div>

        {reference ? (
          <div className="docs-reference-panel" role="status">
            <div className="docs-reference-panel__header">
              <div>
                <div className="docs-reference-panel__eyebrow">Linked reference from {reference.sourceLabel}</div>
                <div className="docs-reference-panel__title">{reference.section.title}</div>
              </div>
              <button
                type="button"
                className="docs-reference-panel__close"
                onClick={() => setReference(null)}
                aria-label="Close linked reference"
              >
                ×
              </button>
            </div>
            <p className="docs-reference-panel__summary">{reference.section.summary}</p>
            <div className="docs-reference-panel__meta">{reference.section.sourceLabel} · {reference.section.sourcePath}</div>
            <div className="docs-reference-panel__actions">
              <button
                type="button"
                className="docs-reference-panel__action"
                onClick={() => scrollToSection(reference.section.id)}
              >
                Go to section
              </button>
            </div>
          </div>
        ) : null}

        <div className="docs-sections">
          {sectionsByGroup.map(({ group, sections }: GroupedSections) => (
            <section key={group.id} className={`docs-chapter docs-chapter--${group.id}`}>
              <header className="docs-chapter__header">
                <div className="docs-chapter__eyebrow">Source file / class</div>
                <h2 className="docs-chapter__title">{group.title}</h2>
                <p className="docs-chapter__description">{group.description}</p>
                <div className="docs-chapter__meta">
                  <span>{sections[0]?.sourcePath}</span>
                  <span>{sections.length} section{sections.length > 1 ? "s" : ""}</span>
                </div>
              </header>

              <div className="docs-chapter__body">
                {group.id === "options" ? (
                  <section className="docs-builder" aria-label="Options code builder">
                    <div className="docs-builder__header">
                      <div>
                        <div className="docs-builder__eyebrow">Optional helper</div>
                        <h3 className="docs-builder__title">Build an Options class snippet</h3>
                        <p className="docs-builder__description">
                          Select only the parameters you want to override and use this helper to draft a Python `Options(...)` snippet.
                        </p>
                      </div>
                      <div className="docs-builder__header-actions">
                        <button
                          type="button"
                          className="docs-builder__toggle"
                          onClick={() => setIsOptionsBuilderOpen((current) => !current)}
                        >
                          {isOptionsBuilderOpen ? "Hide builder" : "Open builder"}
                        </button>
                      </div>
                    </div>

                    {isOptionsBuilderOpen ? (
                      <>
                        <div className="docs-builder__callout">
                          No validation is performed here. Some selected values or option combinations can still be invalid for SHINIER. Unchecked fields are omitted from the snippet and therefore keep SHINIER's defaults. Editing a field adds it automatically to the generated code; uncheck it if you want to remove it again.
                        </div>

                        <div className="docs-builder__groups">
                          {OPTIONS_BUILDER_GROUPS.map((builderGroup) => (
                            <section key={builderGroup.id} className="docs-builder-group">
                              <div className="docs-builder-group__header">
                                <h4 className="docs-builder-group__title">{builderGroup.title}</h4>
                                <p className="docs-builder-group__description">{builderGroup.description}</p>
                              </div>

                              <div className="docs-builder-group__body">
                                {builderGroup.fields.map((field) => {
                                  const fieldState = optionsBuilderState[field.key];
                                  return (
                                    <div key={field.key} className="docs-builder-field">
                                      <input
                                        className="docs-builder-field__check"
                                        type="checkbox"
                                        checked={fieldState.enabled}
                                        onChange={(event) => setBuilderFieldEnabled(field.key, event.target.checked)}
                                      />

                                      <div className="docs-builder-field__info">
                                        <div className="docs-builder-field__name">{field.label}</div>
                                        <div className="docs-builder-field__text">{field.description}</div>
                                        <div className="docs-builder-field__default">Default: {field.defaultLabel}</div>
                                      </div>

                                      <div className="docs-builder-field__control-wrap">
                                        {field.key === "background" ? (
                                          <div className="docs-builder-slider">
                                            <label className="docs-builder-slider__toggle">
                                              <input
                                                type="checkbox"
                                                checked={fieldState.value.trim() === "300"}
                                                onChange={(event) => setBackgroundAutomatic(event.target.checked)}
                                              />
                                              <span>Automatic detection</span>
                                            </label>
                                            <div className="docs-builder-slider__row">
                                              <input
                                                className="docs-builder-slider__input"
                                                type="range"
                                                min="0"
                                                max="255"
                                                step="1"
                                                disabled={fieldState.value.trim() === "300"}
                                                value={parseByteValue(fieldState.value === "300" ? "0" : fieldState.value, 0)}
                                                onChange={(event) => setBackgroundValue(event.target.value)}
                                              />
                                              <input
                                                className="docs-builder-slider__number"
                                                type="number"
                                                min="0"
                                                max="255"
                                                step="1"
                                                disabled={fieldState.value.trim() === "300"}
                                                value={parseByteValue(fieldState.value === "300" ? "0" : fieldState.value, 0)}
                                                onChange={(event) => setBackgroundValue(event.target.value)}
                                              />
                                              <div className="docs-builder-slider__value">
                                                {fieldState.value.trim() === "300" ? "300 (automatic)" : parseByteValue(fieldState.value, 0)}
                                              </div>
                                            </div>
                                          </div>
                                        ) : field.key === "target_lum" ? (
                                          (() => {
                                            const targetLum = parseTargetLumValue(fieldState.value);
                                            return (
                                              <div className="docs-builder-slider docs-builder-slider--stacked">
                                                <div className="docs-builder-slider__block">
                                                  <div className="docs-builder-slider__label">Mean</div>
                                                  <div className="docs-builder-slider__row">
                                                    <input
                                                      className="docs-builder-slider__input"
                                                      type="range"
                                                      min="0"
                                                      max="255"
                                                      step="1"
                                                      value={targetLum.mean}
                                                      onChange={(event) => setTargetLumPart("mean", event.target.value)}
                                                    />
                                                    <input
                                                      className="docs-builder-slider__number"
                                                      type="number"
                                                      min="0"
                                                      max="255"
                                                      step="1"
                                                      value={targetLum.mean}
                                                      onChange={(event) => setTargetLumPart("mean", event.target.value)}
                                                    />
                                                    <div className="docs-builder-slider__value">{targetLum.mean}</div>
                                                  </div>
                                                </div>
                                                <div className="docs-builder-slider__block">
                                                  <div className="docs-builder-slider__label">Standard deviation</div>
                                                  <div className="docs-builder-slider__row">
                                                    <input
                                                      className="docs-builder-slider__input"
                                                      type="range"
                                                      min="0"
                                                      max="255"
                                                      step="1"
                                                      value={targetLum.std}
                                                      onChange={(event) => setTargetLumPart("std", event.target.value)}
                                                    />
                                                    <input
                                                      className="docs-builder-slider__number"
                                                      type="number"
                                                      min="0"
                                                      max="255"
                                                      step="1"
                                                      value={targetLum.std}
                                                      onChange={(event) => setTargetLumPart("std", event.target.value)}
                                                    />
                                                    <div className="docs-builder-slider__value">{targetLum.std}</div>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })()
                                        ) : field.control === "select" ? (
                                          <select
                                            className="docs-builder-field__control"
                                            value={fieldState.value}
                                            onChange={(event) => setBuilderFieldValue(field.key, event.target.value)}
                                          >
                                            {field.options?.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        ) : field.control === "textarea" ? (
                                          <textarea
                                            className="docs-builder-field__control docs-builder-field__control--textarea"
                                            value={fieldState.value}
                                            onChange={(event) => setBuilderFieldValue(field.key, event.target.value)}
                                            spellCheck={false}
                                            rows={3}
                                          />
                                        ) : (
                                          <input
                                            className="docs-builder-field__control"
                                            type="text"
                                            value={fieldState.value}
                                            onChange={(event) => setBuilderFieldValue(field.key, event.target.value)}
                                            spellCheck={false}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>

                        <div className="docs-builder__footer">
                          <div className="docs-builder-code">
                            <div className="docs-builder-code__header">
                              <div>
                                <div className="docs-builder__eyebrow">Generated code</div>
                                <div className="docs-builder-code__title">Python snippet ready to copy</div>
                              </div>
                              <div className="docs-builder-code__actions">
                                <button type="button" className="docs-builder__secondary" onClick={resetBuilder}>
                                  Reset
                                </button>
                                <button type="button" className="docs-builder__primary" onClick={copyOptionsSnippet}>
                                  {copyStatus === "copied" ? "Copied" : "Copy code"}
                                </button>
                              </div>
                            </div>
                            <pre className="docs-builder-code__block">
                              <code>{optionsSnippet}</code>
                            </pre>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </section>
                ) : null}

                {sections.map((section: DocSection) => (
                  <article key={section.id} id={section.id} className="docs-section">
                    <div className="docs-section__meta">
                      <span>{group.title}</span>
                      <span>{section.sourceLabel}</span>
                    </div>
                    <h3 className="docs-section__title">{section.title}</h3>
                    <p className="docs-section__summary">{section.summary}</p>
                    <div className="docs-section__body">
                      {renderMarkdownLite(section.content, openReference, section.title)}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}