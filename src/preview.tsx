import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import "./design-tokens.css";
import ControlRow from "./components/ControlRow";

type XYZ = [number, number, number];
type XyY = [number, number, number];
type XY = [number, number];
type RGB255 = [number, number, number];

type SolidPoint = {
  x: number;
  y: number;
  Y: number;
  rgb: string;
  kind: "pass" | "stop" | "white" | "black" | "gray";
};

type SliceHull = {
  Y: number;
  hull: XY[];
  fill: string;
};

const WL_START = 380;
const WL_END = 780;
const WL_STEP = 10;

const WAVELENGTHS = Array.from(
  { length: Math.floor((WL_END - WL_START) / WL_STEP) + 1 },
  (_, i) => WL_START + i * WL_STEP,
);

const D65_10NM = [
  49.98, 52.31, 54.65, 68.7, 82.75, 87.12, 91.49, 92.46, 93.43, 90.06,
  86.68, 95.77, 104.87, 110.94, 117.01, 117.41, 117.81, 116.34, 114.86,
  115.39, 115.92, 112.37, 108.81, 109.08, 109.35, 108.58, 107.8, 106.3,
  104.79, 106.24, 107.69, 106.05, 104.4, 104.23, 104.05, 102.02, 100.0,
  98.17, 96.33, 96.06, 95.79,
];

const WHITE_POINT = { x: 0.3127, y: 0.3290 };
const GAMUT_EPSILON = 1e-6;

function gaussian(
  lambda: number,
  mu: number,
  sigmaScaleLeft: number,
  sigmaScaleRight: number,
) {
  const s = lambda < mu ? sigmaScaleLeft : sigmaScaleRight;
  const t = (lambda - mu) * s;
  return Math.exp(-0.5 * t * t);
}

function xBar(lambda: number) {
  return (
    0.362 * gaussian(lambda, 442.0, 0.0624, 0.0374) +
    1.056 * gaussian(lambda, 599.8, 0.0264, 0.0323) -
    0.065 * gaussian(lambda, 501.1, 0.049, 0.0382)
  );
}

function yBar(lambda: number) {
  return (
    0.821 * gaussian(lambda, 568.8, 0.0213, 0.0247) +
    0.286 * gaussian(lambda, 530.9, 0.0613, 0.0322)
  );
}

function zBar(lambda: number) {
  return (
    1.217 * gaussian(lambda, 437.0, 0.0845, 0.0278) +
    0.681 * gaussian(lambda, 459.0, 0.0385, 0.0725)
  );
}

function dotProduct(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function clamp255(v: number) {
  return Math.max(0, Math.min(255, v));
}

function cleanChannel(v: number, eps = 1e-6) {
  if (Math.abs(v) < eps) return 0;
  if (Math.abs(v - 1) < eps) return 1;
  return v;
}

function xyzToXyY([X, Y, Z]: XYZ): XyY {
  const sum = X + Y + Z;
  if (sum <= 1e-12) return [0, 0, 0];
  return [X / sum, Y / sum, Y];
}

function xyYToXYZ([x, y, Y]: XyY): XYZ {
  if (y <= 1e-12 || Y <= 0) return [0, 0, 0];
  const X = (x * Y) / y;
  const Z = ((1 - x - y) * Y) / y;
  return [X, Y, Z];
}

function xyzToLinearSRGB([X, Y, Z]: XYZ): XYZ {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}

function linearSRGBToXYZ([r, g, b]: XYZ): XYZ {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

function gammaEncode(v: number) {
  const x = clamp01(v);
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

function gammaDecode(v: number) {
  const x = clamp01(v);
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearRgbToCss([rLin, gLin, bLin]: XYZ) {
  const r = Math.round(gammaEncode(rLin) * 255);
  const g = Math.round(gammaEncode(gLin) * 255);
  const b = Math.round(gammaEncode(bLin) * 255);
  return `rgb(${r},${g},${b})`;
}

function srgb255ToLinearRgb([r, g, b]: RGB255): XYZ {
  return [
    gammaDecode(clamp255(r) / 255),
    gammaDecode(clamp255(g) / 255),
    gammaDecode(clamp255(b) / 255),
  ];
}

function linearRgbToSrgb255([r, g, b]: XYZ): RGB255 {
  return [
    Math.round(gammaEncode(clamp01(r)) * 255),
    Math.round(gammaEncode(clamp01(g)) * 255),
    Math.round(gammaEncode(clamp01(b)) * 255),
  ];
}

function clipLinearRgb([r, g, b]: XYZ): XYZ {
  return [clamp01(r), clamp01(g), clamp01(b)];
}

function xyYToRawLinearRgb(x: number, y: number, Y: number): XYZ {
  return xyzToLinearSRGB(xyYToXYZ([x, y, Y]));
}

function xyYToClippedCssRgb(x: number, y: number, Y: number) {
  return linearRgbToCss(clipLinearRgb(xyYToRawLinearRgb(x, y, Y)));
}

function xyYToDisplayInfo(x: number, y: number, Y: number) {
  const xyz = xyYToXYZ([x, y, Y]);
  const rgbLinearRaw = xyYToRawLinearRgb(x, y, Y);

  const outOfGamut = rgbLinearRaw.some((v) => v < -GAMUT_EPSILON || v > 1 + GAMUT_EPSILON);

  const rgbLinear: XYZ = [
    cleanChannel(rgbLinearRaw[0], GAMUT_EPSILON),
    cleanChannel(rgbLinearRaw[1], GAMUT_EPSILON),
    cleanChannel(rgbLinearRaw[2], GAMUT_EPSILON),
  ];

  const rgbClipped = clipLinearRgb(rgbLinear);

  return {
    xyz,
    rgbLinear,
    rgbClipped,
    rgb255: linearRgbToSrgb255(rgbClipped),
    css: linearRgbToCss(rgbClipped),
    outOfGamut,
  };
}

function rgb255ToCss(rgb: RGB255) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function srgb255ToXyY(rgb255: RGB255): XyY {
  const rgbLinear = srgb255ToLinearRgb(rgb255);
  const xyz = linearSRGBToXYZ(rgbLinear);
  return xyzToXyY(xyz);
}

function buildCMFs() {
  return {
    x: WAVELENGTHS.map(xBar),
    y: WAVELENGTHS.map(yBar),
    z: WAVELENGTHS.map(zBar),
  };
}

function computeWhiteNormalization() {
  const cmf = buildCMFs();
  const k = 1 / dotProduct(D65_10NM, cmf.y);
  return { cmf, k };
}

function reflectanceXYZ(
  reflectance: number[],
  cmf: ReturnType<typeof buildCMFs>,
  k: number,
): XYZ {
  const weighted = reflectance.map((r, i) => r * D65_10NM[i]);
  return [
    k * dotProduct(weighted, cmf.x),
    k * dotProduct(weighted, cmf.y),
    k * dotProduct(weighted, cmf.z),
  ];
}

function pushIfValid(points: SolidPoint[], xyz: XYZ, kind: SolidPoint["kind"]) {
  const [x, y, Y] = xyzToXyY(xyz);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(Y)) return;
  if (Y < 0 || Y > 1.000001) return;
  points.push({
    x,
    y,
    Y,
    rgb: linearRgbToCss(clipLinearRgb(xyzToLinearSRGB(xyz))),
    kind,
  });
}

function dedupePoints(points: SolidPoint[]) {
  const seen = new Set<string>();
  const out: SolidPoint[] = [];
  for (const p of points) {
    const key = `${p.x.toFixed(4)}|${p.y.toFixed(4)}|${p.Y.toFixed(4)}|${p.kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function buildOptimalSolid(): SolidPoint[] {
  const { cmf, k } = computeWhiteNormalization();
  const n = WAVELENGTHS.length;
  const points: SolidPoint[] = [];

  pushIfValid(points, [0, 0, 0], "black");
  pushIfValid(points, [0.95047, 1.0, 1.08883], "white");

  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const pass = new Array(n).fill(0);
      for (let kIdx = i; kIdx <= j; kIdx += 1) pass[kIdx] = 1;
      const stop = pass.map((v) => 1 - v);
      pushIfValid(points, reflectanceXYZ(pass, cmf, k), "pass");
      pushIfValid(points, reflectanceXYZ(stop, cmf, k), "stop");
    }
  }

  for (let i = 0; i <= 100; i += 1) {
    const Y = i / 100;
    points.push({
      x: WHITE_POINT.x,
      y: WHITE_POINT.y,
      Y,
      rgb: `rgb(${Math.round(Y * 255)},${Math.round(Y * 255)},${Math.round(Y * 255)})`,
      kind: "gray",
    });
  }

  return dedupePoints(points);
}

function buildSpectralLocus() {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const wl of WAVELENGTHS) {
    const [x, y] = xyzToXyY([xBar(wl), yBar(wl), zBar(wl)]);
    xs.push(x);
    ys.push(y);
  }
  xs.push(xs[0]);
  ys.push(ys[0]);
  return { x: xs, y: ys };
}

function assertBasicConsistency(points: SolidPoint[]) {
  if (!Array.isArray(points) || points.length === 0) throw new Error("No points were produced.");
  if (!points.some((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.Y))) {
    throw new Error("No finite xyY points were produced.");
  }
  if (!points.some((p) => p.kind === "gray")) {
    throw new Error("Neutral gray axis was not generated.");
  }
}

function cross(o: XY, a: XY, b: XY) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function convexHull(points: XY[]): XY[] {
  if (points.length <= 1) return points;
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const lower: XY[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: XY[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function polygonPath(points: XY[], map: (p: XY) => XY) {
  if (points.length === 0) return "";
  return (
    points
      .map((p, i) => {
        const [x, y] = map(p);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ") + " Z"
  );
}

function to2DSpace(x: number, y: number, W: number, H: number): XY {
  return [60 + (x / 0.8) * (W - 120), H - 40 - (y / 0.9) * (H - 90)];
}

function toProjectionSpaceX(x: number, Y: number, W: number, H: number): XY {
  const left = 56;
  const right = W - 28;
  const top = 24;
  const bottom = H - 34;
  return [
    left + (x / 0.8) * (right - left),
    bottom - Y * (bottom - top),
  ];
}

function toProjectionSpaceY(y: number, Y: number, W: number, H: number): XY {
  const left = 56;
  const right = W - 28;
  const top = 24;
  const bottom = H - 34;
  return [
    left + (y / 0.9) * (right - left),
    bottom - Y * (bottom - top),
  ];
}

function hueFillForSlice(Y: number) {
  const h = 220 - Y * 180;
  return `hsla(${h}, 75%, 70%, 0.10)`;
}

function sampleSliceHulls(points: SolidPoint[], levels: number, band: number) {
  const hulls: SliceHull[] = [];
  for (let i = 0; i <= levels; i += 1) {
    const level = i / levels;
    const slice = points.filter((p) => Math.abs(p.Y - level) <= band / 2);
    const hull = convexHull(slice.map((p) => [p.x, p.y] as XY));
    if (hull.length >= 3) hulls.push({ Y: level, hull, fill: hueFillForSlice(level) });
  }
  return hulls;
}

function rotatePoint(
  x: number,
  yLum: number,
  zChromY: number,
  rotX: number,
  rotY: number,
  rotZ: number,
) {
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const cz = Math.cos(rotZ);
  const sz = Math.sin(rotZ);

  const x1 = x;
  const y1 = cx * yLum - sx * zChromY;
  const z1 = sx * yLum + cx * zChromY;

  const x2 = cy * x1 - sy * y1;
  const y2 = sy * x1 + cy * y1;
  const z2 = z1;

  const x3 = cz * x2 + sz * z2;
  const y3 = y2;
  const z3 = -sz * x2 + cz * z2;

  return { x: x3, y: y3, z: z3 };
}

function fitViewerControlsFromEye(
  eye: { x: number; y: number; z: number },
  initial: { rotX: number; rotY: number; rotZ: number },
) {
  const base = { x: 0.95, y: 1.25, z: 1.55 };
  const baseNorm = Math.hypot(base.x, base.y, base.z);
  const eyeNorm = Math.max(1e-6, Math.hypot(eye.x, eye.y, eye.z));
  const target = {
    x: eye.x * (eyeNorm / baseNorm),
    y: eye.y * (eyeNorm / baseNorm),
    z: eye.z * (eyeNorm / baseNorm),
  };

  let rotX = initial.rotX;
  let rotY = initial.rotY;
  let rotZ = initial.rotZ;

  const errorFor = (rx: number, ry: number, rz: number) => {
    const r = rotatePoint(base.x, base.y, base.z, rx, ry, rz);
    const dx = r.x - target.x;
    const dy = r.y - target.y;
    const dz = r.z - target.z;
    return dx * dx + dy * dy + dz * dz;
  };

  let stepX = 0.18;
  let stepY = 0.18;
  let stepZ = 0.18;
  let best = errorFor(rotX, rotY, rotZ);

  for (let iter = 0; iter < 18; iter += 1) {
    let improved = false;
    const candidates: Array<[number, number, number]> = [
      [rotX + stepX, rotY, rotZ],
      [rotX - stepX, rotY, rotZ],
      [rotX, rotY + stepY, rotZ],
      [rotX, rotY - stepY, rotZ],
      [rotX, rotY, rotZ + stepZ],
      [rotX, rotY, rotZ - stepZ],
    ];
    for (const [rx, ry, rz] of candidates) {
      const err = errorFor(rx, ry, rz);
      if (err < best) {
        rotX = rx;
        rotY = ry;
        rotZ = rz;
        best = err;
        improved = true;
      }
    }
    if (!improved) {
      stepX *= 0.55;
      stepY *= 0.55;
      stepZ *= 0.55;
    }
  }

  const zoom = Math.max(0.65, Math.min(1.6, baseNorm / eyeNorm));
  return { rotX, rotY, rotZ, zoom };
}

function project3D(
  p: SolidPoint,
  width: number,
  height: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  zoom: number,
) {
  const cx = 0.33;
  const cy = 0.33;
  const cY = 0.5;

  const vx = p.x - cx;
  const vyLum = p.Y - cY;
  const vzChromY = p.y - cy;

  const r = rotatePoint(vx, vyLum, vzChromY, rotX, rotY, rotZ);
  const persp = 1 + 0.45 * r.z;
  const scale = 540 * zoom;

  const sx = width * 0.5 + ((1.18 * r.x + 0.55 * r.z) * scale) / persp;
  const sy = height * 0.56 - (r.y * scale) / persp;

  return { sx, sy, depth: r.z };
}

function pathFromProjectedHull(
  hull: XY[],
  Y: number,
  width: number,
  height: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  zoom: number,
) {
  const path = hull
    .map((pt, i) => {
      const { sx, sy } = project3D(
        { x: pt[0], y: pt[1], Y, rgb: "#fff", kind: "pass" },
        width,
        height,
        rotX,
        rotY,
        rotZ,
        zoom,
      );
      return `${i === 0 ? "M" : "L"}${sx},${sy}`;
    })
    .join(" ");
  return `${path} Z`;
}

function axisLine3D(
  start: [number, number, number],
  end: [number, number, number],
  width: number,
  height: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  zoom: number,
  label: string,
) {
  const a = project3D(
    { x: start[0], y: start[1], Y: start[2], rgb: "#fff", kind: "pass" },
    width,
    height,
    rotX,
    rotY,
    rotZ,
    zoom,
  );
  const b = project3D(
    { x: end[0], y: end[1], Y: end[2], rgb: "#fff", kind: "pass" },
    width,
    height,
    rotX,
    rotY,
    rotZ,
    zoom,
  );
  return { a, b, label };
}

function getMaxLuminanceForChromaticity(x: number, y: number) {
  const unitRgb = xyYToRawLinearRgb(x, y, 1);
  const cleaned: XYZ = [
    cleanChannel(unitRgb[0], GAMUT_EPSILON),
    cleanChannel(unitRgb[1], GAMUT_EPSILON),
    cleanChannel(unitRgb[2], GAMUT_EPSILON),
  ];

  if (cleaned.some((channel) => channel < 0)) {
    return 0;
  }

  const maxChannel = Math.max(cleaned[0], cleaned[1], cleaned[2]);
  if (maxChannel <= 0) return 0;
  return Math.min(1, 1 / maxChannel);
}

function constrainLuminancePoint(x: number, y: number, Y: number) {
  const Ymax = getMaxLuminanceForChromaticity(x, y);
  const scale = Y > 1e-12 ? Math.min(1, Ymax / Y) : 1;
  return { x, y, Y: Y * scale, scale, Ymax };
}

function constrainChrominancePoint(x: number, y: number, Y: number) {
  const grayXYZ = xyYToXYZ([WHITE_POINT.x, WHITE_POINT.y, Y]);
  const rgb = xyzToLinearSRGB(xyYToXYZ([x, y, Y]));
  const grayRgb = xyzToLinearSRGB(grayXYZ);
  const delta: XYZ = [rgb[0] - grayRgb[0], rgb[1] - grayRgb[1], rgb[2] - grayRgb[2]];
  const eps = 1e-9;

  const kHigh: XYZ = [0, 1, 2].map((c) =>
    rgb[c] > 1 && delta[c] > eps ? (1 - grayRgb[c]) / delta[c] : 1,
  ) as XYZ;

  const kLow: XYZ = [0, 1, 2].map((c) =>
    rgb[c] < 0 && delta[c] < -eps ? grayRgb[c] / -delta[c] : 1,
  ) as XYZ;

  const k = Math.min(kHigh[0], kHigh[1], kHigh[2], kLow[0], kLow[1], kLow[2], 1);

  return {
    x: WHITE_POINT.x + k * (x - WHITE_POINT.x),
    y: WHITE_POINT.y + k * (y - WHITE_POINT.y),
    Y,
    scale: k,
  };
}

function buildSliceColorField(sliceY: number, hull: XY[], W: number, H: number, nx = 84, ny = 84) {
  if (hull.length < 3) return [] as React.ReactElement[];

  const rects: React.ReactElement[] = [];
  const dx = 0.8 / nx;
  const dy = 0.9 / ny;
  const screenDx = (W - 120) / nx;
  const screenDy = (H - 90) / ny;

  for (let iy = 0; iy < ny; iy += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const x = (ix + 0.5) * dx;
      const y = (iy + 0.5) * dy;
      if (y <= 1e-4 || x + y >= 0.999) continue;
      const [px, py] = to2DSpace(x, y, W, H);
      rects.push(
        <rect
          key={`cell-${ix}-${iy}`}
          x={px - screenDx / 2}
          y={py - screenDy / 2}
          width={screenDx + 0.5}
          height={screenDy + 0.5}
          fill={xyYToClippedCssRgb(x, y, sliceY)}
          opacity={0.95}
        />,
      );
    }
  }
  return rects;
}

function NumericSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  invalid?: boolean;
}) {
  return (
    <div className="mb-3">
      <ControlRow
        label={<div className="panel-title">{label}</div>}
        labelClassName={invalid ? "is-invalid" : undefined}
        right={
          <input
            className="number-input"
            type="number"
            min={min}
            max={max}
            step={step}
            value={Math.abs(step) >= 1 ? Math.round(value) : Number(value.toFixed(2))}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) onChange(v);
            }}
            onBlur={(e) => {
              let v = parseFloat(e.target.value);
              if (Number.isNaN(v)) v = min;
              if (v < min) v = min;
              if (v > max) v = max;
              onChange(v);
            }}
          />
        }
      >
        <input
          className="ctrl-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </ControlRow>
    </div>
  );
}

function NumericProjection({
  title,
  axisLabel,
  points,
  sliceY,
  original,
  chroma,
  luminance,
  originalCss,
  chromaCss,
  luminanceCss,
  mapPoint,
}: {
  title: string;
  axisLabel: string;
  points: SolidPoint[];
  sliceY: number;
  original: { c: number; Y: number };
  chroma: { c: number; Y: number };
  luminance: { c: number; Y: number };
  originalCss: string;
  chromaCss: string;
  luminanceCss: string;
  mapPoint: (c: number, Y: number, W: number, H: number) => XY;
}) {
  const W = 360;
  const H = 250;

  const pOriginal = mapPoint(original.c, original.Y, W, H);
  const pChroma = mapPoint(chroma.c, chroma.Y, W, H);
  const pLum = mapPoint(luminance.c, luminance.Y, W, H);
  const pSliceA = mapPoint(0, sliceY, W, H);
  const pSliceB = mapPoint(axisLabel === "x" ? 0.8 : 0.9, sliceY, W, H);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="mb-2 text-sm font-medium text-slate-200">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[250px] w-full rounded-lg bg-slate-950">
        <rect x={56} y={24} width={W - 84} height={H - 58} fill="none" stroke="#334155" strokeWidth={1} />
        <line x1={56} y1={H - 34} x2={W - 28} y2={H - 34} stroke="#64748b" strokeWidth={1.3} />
        <line x1={56} y1={H - 34} x2={56} y2={24} stroke="#64748b" strokeWidth={1.3} />

        <text x={W - 22} y={H - 18} fill="#cbd5e1" fontSize="12">
          {axisLabel}
        </text>
        <text x={40} y={20} fill="#cbd5e1" fontSize="12">
          Y
        </text>

        <line
          x1={pSliceA[0]}
          y1={pSliceA[1]}
          x2={pSliceB[0]}
          y2={pSliceB[1]}
          stroke="rgba(255,255,255,0.14)"
          strokeDasharray="5 4"
        />
        <text x={pSliceA[0] + 6} y={pSliceA[1] - 6} fill="#cbd5e1" fontSize="10">
          current slice Y
        </text>

        {points.map((p, idx) => {
          const c = axisLabel === "x" ? p.x : p.y;
          const [px, py] = mapPoint(c, p.Y, W, H);
          return <circle key={idx} cx={px} cy={py} r={1.7} fill={p.rgb} opacity={0.28} />;
        })}

        <line
          x1={pOriginal[0]}
          y1={pOriginal[1]}
          x2={pChroma[0]}
          y2={pChroma[1]}
          stroke="#22c55e"
          strokeWidth={2.2}
        />
        <line
          x1={pOriginal[0]}
          y1={pOriginal[1]}
          x2={pLum[0]}
          y2={pLum[1]}
          stroke="#38bdf8"
          strokeWidth={2.2}
          strokeDasharray="6 5"
        />

        <circle cx={pOriginal[0]} cy={pOriginal[1]} r={6.5} fill={originalCss} stroke="#ef4444" strokeWidth={2} />
        <circle cx={pChroma[0]} cy={pChroma[1]} r={5.5} fill={chromaCss} stroke="#22c55e" strokeWidth={2} />
        <circle cx={pLum[0]} cy={pLum[1]} r={5.5} fill={luminanceCss} stroke="#38bdf8" strokeWidth={2} />

        <text x={pOriginal[0] + 8} y={pOriginal[1] - 8} fill="#fca5a5" fontSize="10" fontWeight="600">
          original
        </text>
        <text x={pChroma[0] + 8} y={pChroma[1] + 14} fill="#86efac" fontSize="10" fontWeight="600">
          chroma
        </text>
        <text x={pLum[0] + 8} y={pLum[1] - 8} fill="#7dd3fc" fontSize="10" fontWeight="600">
          luminance
        </text>
      </svg>
    </div>
  );
}

function PointMarker({
  x,
  y,
  W,
  H,
  fill,
  stroke,
  r = 6,
}: {
  x: number;
  y: number;
  W: number;
  H: number;
  fill: string;
  stroke: string;
  r?: number;
}) {
  const [px, py] = to2DSpace(x, y, W, H);
  return <circle cx={px} cy={py} r={r} fill={fill} stroke={stroke} strokeWidth={1.2} />;
}

function SafeguardDemoCard({
  tag,
  title,
  description,
  explanation,
  visual,
  expandableContent,
  expandLabel = "More information",
}: {
  tag: string;
  title: string;
  description: string;
  explanation: React.ReactNode;
  visual: React.ReactNode;
  expandableContent?: React.ReactNode;
  expandLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="safeguard-card">
      <div className="safeguard-tag">{tag}</div>
      <div className="safeguard-title">{title}</div>
      <div className="safeguard-description">{description}</div>
      <div className="safeguard-visual">{visual}</div>
      <div className="safeguard-copy">{explanation}</div>
      {expandableContent ? (
        <>
          <button
            type="button"
            className="safeguard-expand"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <span>{expandLabel}</span>
            <span className={`safeguard-chevron ${expanded ? "is-open" : ""}`}>▾</span>
          </button>
          {expanded && <div className="safeguard-details">{expandableContent}</div>}
        </>
      ) : null}
    </div>
  );
}

function LowLuminanceSafeguardVisual() {
  return (
    <svg viewBox="0 0 320 170" className="h-[170px] w-full rounded-xl bg-slate-950">
      <rect x={18} y={18} width={284} height={134} rx={14} fill="rgba(15,23,36,0.95)" stroke="rgba(255,255,255,0.08)" />
      <line x1={36} y1={136} x2={148} y2={136} stroke="#64748b" strokeWidth={1.4} />
      <line x1={36} y1={136} x2={36} y2={38} stroke="#64748b" strokeWidth={1.4} />
      <path d="M36,44 L36,44 C50,44 56,44 68,52 C82,62 90,82 103,95 C117,109 129,119 148,124" fill="none" stroke="#f59e85" strokeWidth={4} strokeLinecap="round" />
      <text x={34} y={32} fill="#cbd5e1" fontSize="11">strength</text>
      <text x={132} y={153} fill="#cbd5e1" fontSize="11">Y</text>
      <rect x={46} y={58} width={72} height={18} rx={9} fill="rgba(2,6,23,0.82)" />
      <text x={56} y={70} fill="#fde68a" fontSize="10">strong near black</text>

      <circle cx="228" cy="70" r="36" fill="none" stroke="rgba(148,163,184,0.32)" strokeWidth="1.2" />
      <circle cx="228" cy="70" r="4" fill="#ffffff" />
      <circle cx="254" cy="48" r="6" fill="#fb7185" stroke="#0f172a" strokeWidth="1.2" />
      <line x1="254" y1="48" x2="236" y2="62" stroke="#22c55e" strokeWidth="2.2" />
      <polygon points="238,58 238,66 231,63" fill="#22c55e" />
      <text x="180" y="118" fill="#86efac" fontSize="9.5">xy pulled toward</text>
      <text x="191" y="131" fill="#86efac" fontSize="9.5">white point</text>
    </svg>
  );
}

function ChromaValiditySafeguardVisual() {
  const pA = to2DSpace(0, 0, 320, 170);
  const pB = to2DSpace(0.8, 0, 320, 170);
  const pC = to2DSpace(0, 0.9, 320, 170);
  const pW = to2DSpace(WHITE_POINT.x, WHITE_POINT.y, 320, 170);
  const safeBottomY = to2DSpace(0, 0.08, 320, 170)[1];

  return (
    <svg viewBox="0 0 320 170" className="h-[170px] w-full rounded-xl bg-slate-950">
      <rect x={18} y={18} width={284} height={134} rx={14} fill="rgba(15,23,36,0.95)" stroke="rgba(255,255,255,0.08)" />
      <polygon
        points={`${pA[0]},${pA[1]} ${pB[0]},${pB[1]} ${pC[0]},${pC[1]}`}
        fill="rgba(34,197,94,0.08)"
        stroke="#94a3b8"
        strokeWidth="1.4"
      />
      <rect
        x={pA[0]}
        y={safeBottomY}
        width={pB[0] - pA[0]}
        height={pA[1] - safeBottomY}
        fill="rgba(248,113,113,0.28)"
      />
      <path
        d={`M${pB[0] - 6},${pB[1] - 4} L${pC[0] + 6},${pC[1] + 8}`}
        stroke="#f87171"
        strokeWidth="10"
        opacity="0.24"
      />
      <path
        d={`M${pB[0] - 18},${pB[1] - 15} L${pC[0] + 18},${pC[1] + 20}`}
        stroke="#f87171"
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.9"
      />
      <circle cx={pW[0]} cy={pW[1]} r={5} fill="#ffffff" stroke="#0f172a" strokeWidth={1.2} />

      <text x={48} y={44} fill="#86efac" fontSize="9.5">valid region</text>
      <text x={58} y={146} fill="#fca5a5" fontSize="9.5">y≈0 unstable</text>
      <text x={176} y={42} fill="#fca5a5" fontSize="9.5">x+y≈1 fragile</text>

      <line x1="214" y1="78" x2="214" y2="124" stroke="#64748b" strokeWidth="1.2" />
      <line x1="214" y1="124" x2="280" y2="124" stroke="#64748b" strokeWidth="1.2" />
      <path d="M218,120 C226,111 235,101 246,90 C255,80 264,70 278,58" fill="none" stroke="#f59e85" strokeWidth="3.4" strokeLinecap="round" />
      <text x="224" y="73" fill="#cbd5e1" fontSize="9.5">1 / y</text>
      <text x="231" y="137" fill="#cbd5e1" fontSize="9.5">y</text>
      <text x="222" y="149" fill="#fca5a5" fontSize="9">blows up as y→0</text>
    </svg>
  );
}

function ReliabilitySafeguardVisual() {
  return (
    <svg viewBox="0 0 320 170" className="h-[170px] w-full rounded-xl bg-slate-950">
      <rect x={18} y={18} width={284} height={134} rx={14} fill="rgba(15,23,36,0.95)" stroke="rgba(255,255,255,0.08)" />
      <line x1={36} y1={136} x2={286} y2={136} stroke="#64748b" strokeWidth={1.4} />
      <line x1={36} y1={136} x2={36} y2={38} stroke="#64748b" strokeWidth={1.4} />
      <path d="M36,136 L86,76 L160,42 L234,76 L286,136" fill="none" stroke="#38bdf8" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="86" cy="76" r="5" fill="#38bdf8" />
      <circle cx="160" cy="42" r="5" fill="#38bdf8" />
      <circle cx="234" cy="76" r="5" fill="#38bdf8" />
      <text x="34" y="32" fill="#cbd5e1" fontSize="11">reliability</text>
      <text x="277" y="153" fill="#cbd5e1" fontSize="11">Y</text>
      <text x="48" y="150" fill="#94a3b8" fontSize="10">0</text>
      <text x="155" y="150" fill="#94a3b8" fontSize="10">mid</text>
      <text x="274" y="150" fill="#94a3b8" fontSize="10">1</text>
      <rect x="110" y="62" width="88" height="18" rx="9" fill="rgba(2,6,23,0.82)" />
      <text x="118" y="74" fill="#bfdbfe" fontSize="9.5">mid-tones dominate</text>
      <rect x="44" y="88" width="102" height="30" rx="9" fill="rgba(2,6,23,0.82)" />
      <text x="52" y="100" fill="#cbd5e1" fontSize="9.5">near-black noise</text>
      <text x="52" y="112" fill="#cbd5e1" fontSize="9.5">down-weighted</text>
    </svg>
  );
}

function QuantileSafeguardVisual() {
  return (
    <svg viewBox="0 0 320 170" className="h-[170px] w-full rounded-xl bg-slate-950">
      <rect x={18} y={18} width={284} height={134} rx={14} fill="rgba(15,23,36,0.95)" stroke="rgba(255,255,255,0.08)" />
      <line x1={36} y1={136} x2={286} y2={136} stroke="#64748b" strokeWidth={1.4} />
      {[32, 44, 56, 66, 74, 84, 92, 100, 108, 112, 118, 124].map((height, idx) => {
        const x = 46 + idx * 13;
        const y = 136 - height * 0.62;
        return (
          <rect
            key={`main-${idx}`}
            x={x}
            y={y}
            width={9}
            height={height * 0.62}
            fill="rgba(245,158,133,0.88)"
            rx={3}
          />
        );
      })}
      <rect x={248} y={126} width={7} height={10} rx={3} fill="rgba(248,113,113,0.90)" />
      <rect x={268} y={122} width={7} height={14} rx={3} fill="rgba(248,113,113,0.90)" />
      <line x1={226} y1={34} x2={226} y2={136} stroke="#22c55e" strokeWidth={2.2} strokeDasharray="5 5" />
      <text x={176} y={30} fill="#86efac" fontSize="9.5">keep 99.5% of pixels</text>
      <text x={234} y={96} fill="#fca5a5" fontSize="9.5">tiny aberrant tail</text>
      <text x={232} y={108} fill="#fca5a5" fontSize="9.5">allowed to clip</text>
      <text x={232} y={151} fill="#fca5a5" fontSize="9.5">0.5% clipped</text>
      <text x={44} y={30} fill="#cbd5e1" fontSize="11">constraint strengths</text>
    </svg>
  );
}

type S2Category = "valid" | "unstable" | "invalid";

type S2Sample = {
  id: string;
  label: string;
  x: number;
  y: number;
  Y: number;
  category: S2Category;
  chromaOk: boolean;
  rgb: XYZ;
  yMax: number;
  ratio: number;
};

const S2_EPS_Y = 1e-3;
const S2_EPS_SUM_XY = 1e-6;

function getS2CategoryColor(category: S2Category) {
  if (category === "valid") return "#22c55e";
  if (category === "unstable") return "#fb923c";
  return "#f87171";
}

function buildS2Samples(): S2Sample[] {
  const valid: Array<{ x: number; y: number; Y: number; category: S2Category; label: string }> = [
    { label: "v1", x: 0.313, y: 0.329, Y: 0.35, category: "valid" },
    { label: "v2", x: 0.58, y: 0.34, Y: 0.65, category: "valid" },
    { label: "v3", x: 0.18, y: 0.72, Y: 0.55, category: "valid" },
    { label: "v4", x: 0.24, y: 0.18, Y: 0.82, category: "valid" },
    { label: "v5", x: 0.42, y: 0.26, Y: 0.72, category: "valid" },
    { label: "v6", x: 0.11, y: 0.21, Y: 0.42, category: "valid" },
    { label: "v7", x: 0.23, y: 0.58, Y: 0.44, category: "valid" },
    { label: "v8", x: 0.67, y: 0.22, Y: 0.38, category: "valid" },
    { label: "v9", x: 0.37, y: 0.47, Y: 0.52, category: "valid" },
    { label: "v10", x: 0.08, y: 0.08, Y: 0.16, category: "valid" },
  ];

  const unstable = [
    { label: "u1", x: 0.12, y: 0.00035, Y: 0.02, category: "unstable" as const },
    { label: "u2", x: 0.24, y: 0.00055, Y: 0.02, category: "unstable" as const },
    { label: "u3", x: 0.36, y: 0.00075, Y: 0.02, category: "unstable" as const },
    { label: "u4", x: 0.48, y: 0.00095, Y: 0.02, category: "unstable" as const },
    { label: "u5", x: 0.6, y: 0.00045, Y: 0.02, category: "unstable" as const },
    { label: "u6", x: 0.72, y: 0.00065, Y: 0.02, category: "unstable" as const },
  ];

  const invalid = [
    { label: "i1", x: 0.76, y: 0.32, Y: 0.03, category: "invalid" as const },
    { label: "i2", x: 0.62, y: 0.45, Y: 0.03, category: "invalid" as const },
    { label: "i3", x: 0.4, y: 0.68, Y: 0.04, category: "invalid" as const },
    { label: "i4", x: 0.27, y: 0.82, Y: 0.05, category: "invalid" as const },
    { label: "i5", x: 0.58, y: 0.52, Y: 0.04, category: "invalid" as const },
    { label: "i6", x: 0.18, y: 0.9, Y: 0.05, category: "invalid" as const },
  ];

  return valid.concat(unstable, invalid).map((sample) => {
    const chromaOk =
      sample.x >= 0 &&
      sample.y >= S2_EPS_Y &&
      sample.y >= 0 &&
      sample.x + sample.y <= 1 - S2_EPS_SUM_XY;
    const rgb = xyYToRawLinearRgb(sample.x, sample.y, sample.Y);
    const yMax = getMaxLuminanceForChromaticity(sample.x, sample.y);
    const ratio = clamp01(yMax / Math.max(sample.Y, 1e-9));

    return {
      id: sample.label,
      ...sample,
      chromaOk,
      rgb,
      yMax,
      ratio,
    };
  });
}

function getS2RgbExamples(samples: S2Sample[]) {
  return samples.filter((sample) => ["v2", "v3", "u2", "u5", "i2", "i4"].includes(sample.id));
}

function S2ChromaticityDiagramVisual({
  samples,
  showMask = true,
  width = 360,
  height = 260,
}: {
  samples: S2Sample[];
  showMask?: boolean;
  width?: number;
  height?: number;
}) {
  const locus = useMemo(() => buildSpectralLocus(), []);

  const spectralLocusPath = useMemo(() => {
    return locus.x
      .map((x, i) => {
        const [px, py] = to2DSpace(x, locus.y[i], width, height);
        return `${i === 0 ? "M" : "L"}${px},${py}`;
      })
      .join(" ");
  }, [height, locus, width]);

  const srgbTrianglePath = useMemo(() => {
    const triangle: XY[] = [
      [0.64, 0.33],
      [0.3, 0.6],
      [0.15, 0.06],
    ];
    return polygonPath(triangle, (p) => to2DSpace(p[0], p[1], width, height));
  }, [height, width]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full rounded-xl bg-slate-950">
      <rect x={60} y={40} width={width - 120} height={height - 90} fill="none" stroke="#334155" strokeWidth={1} />
      <line x1={60} y1={height - 40} x2={width - 40} y2={height - 40} stroke="#64748b" strokeWidth={1.4} />
      <line x1={60} y1={height - 40} x2={60} y2={40} stroke="#64748b" strokeWidth={1.4} />
      <text x={width - 28} y={height - 45} fill="#cbd5e1" fontSize="11">x</text>
      <text x={46} y={36} fill="#cbd5e1" fontSize="11">y</text>

      <path d={spectralLocusPath} fill="none" stroke="#94a3b8" strokeWidth={1.8} />
      <path d={srgbTrianglePath} fill="rgba(56,189,248,0.05)" stroke="#38bdf8" strokeWidth={1.6} />

      {showMask &&
        samples.map((sample) => {
          const [px, py] = to2DSpace(sample.x, sample.y, width, height);
          return (
            <circle
              key={`s2-xy-${sample.label}-${width}-${height}`}
              cx={px}
              cy={py}
              r={sample.category === "valid" ? 4 : 4.8}
              fill={getS2CategoryColor(sample.category)}
              opacity={0.92}
            />
          );
        })}

      <PointMarker x={WHITE_POINT.x} y={WHITE_POINT.y} W={width} H={height} fill="#ffffff" stroke="#0f172a" r={5.5} />
      <text x={to2DSpace(WHITE_POINT.x, WHITE_POINT.y, width, height)[0] + 8} y={to2DSpace(WHITE_POINT.x, WHITE_POINT.y, width, height)[1] - 8} fill="#e2e8f0" fontSize="10">D65</text>
    </svg>
  );
}

function S2RgbInstabilityPanelVisual({
  samples,
  showRgbOverflow = true,
}: {
  samples: S2Sample[];
  showRgbOverflow?: boolean;
}) {
  const rgbExamples = useMemo(() => getS2RgbExamples(samples), [samples]);

  const channelStatus = (value: number) => {
    if (value < 0) return "negative";
    if (value > 1) return "overflow";
    return "valid";
  };

  return (
    <div className="s2-rgb-table-wrap">
      <div className="s2-rgb-table">
        <div className="s2-rgb-head">sample</div>
        <div className="s2-rgb-head">xyY</div>
        <div className="s2-rgb-head">R</div>
        <div className="s2-rgb-head">G</div>
        <div className="s2-rgb-head">B</div>

        {showRgbOverflow &&
          rgbExamples.map((sample) => (
            <React.Fragment key={`rgb-${sample.label}`}>
              <div className={`s2-rgb-label s2-rgb-label-${sample.category}`}>{sample.label}</div>
              <div className="s2-rgb-xyy">({sample.x.toFixed(3)}, {sample.y.toExponential(1)}, {sample.Y.toFixed(2)})</div>
              {sample.rgb.map((channel, idx) => {
                const status = channelStatus(channel);
                return (
                  <div key={`${sample.label}-${idx}`} className={`s2-rgb-cell s2-rgb-cell-${status}`}>
                    {channel.toFixed(2)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
      </div>
    </div>
  );
}

function S2Legend() {
  return (
    <div className="s2-legend">
      <div className="s2-legend-item"><span className="s2-dot s2-dot-valid" /> Green : valid chromaticities (used for estimation)</div>
      <div className="s2-legend-item"><span className="s2-dot s2-dot-unstable" /> Orange : unstable chromaticities (near singularity)</div>
      <div className="s2-legend-item"><span className="s2-dot s2-dot-invalid" /> Red : invalid chromaticities (excluded)</div>
    </div>
  );
}

export default function RoeschMacAdamxyYViewer() {
  const [viewerTheme, setViewerTheme] = useState<"dark" | "light">("dark");
  const [sliceY, setSliceY] = useState(0.5);
  const [sliceThickness, setSliceThickness] = useState(0.1);
  const [showPass, setShowPass] = useState(true);
  const [showStop, setShowStop] = useState(true);
  const [showMesh, setShowMesh] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showOrthographicIn3D, setShowOrthographicIn3D] = useState(true);
  const [showChrominanceConstraint, setShowChrominanceConstraint] = useState(true);
  const [showLuminanceConstraint, setShowLuminanceConstraint] = useState(true);
  const [pointSize, setPointSize] = useState(1.7);
  const [rotX, setRotX] = useState(0.0);
  const [rotY, setRotY] = useState(0.0);
  const [rotZ, setRotZ] = useState(0.0);
  const [zoom, setZoom] = useState(0.85);
  const [cameraOverride, setCameraOverride] = useState<any | null>(null);
  const [plotlyGraphDiv, setPlotlyGraphDiv] = useState<any | null>(null);

  const [demoX, setDemoX] = useState(0.62);
  const [demoY, setDemoY] = useState(0.33);
  const [demoLum, setDemoLum] = useState(0.95);

  const [demoR, setDemoR] = useState(255);
  const [demoG, setDemoG] = useState(121);
  const [demoB, setDemoB] = useState(113);

  const points = useMemo(() => {
    const pts = buildOptimalSolid();
    assertBasicConsistency(pts);
    return pts;
  }, []);

  const locus = useMemo(() => buildSpectralLocus(), []);

  const filtered3D = useMemo(() => {
    return points.filter(
      (p) =>
        (showPass && p.kind === "pass") ||
        (showStop && p.kind === "stop") ||
        p.kind === "white" ||
        p.kind === "black" ||
        p.kind === "gray",
    );
  }, [points, showPass, showStop]);

  const slicePoints = useMemo(() => {
    return filtered3D.filter((p) => Math.abs(p.Y - sliceY) <= sliceThickness / 2);
  }, [filtered3D, sliceY, sliceThickness]);

  const sorted3D = useMemo(() => {
    return [...filtered3D]
      .map((p) => ({ p, proj: project3D(p, 760, 560, rotX, rotY, rotZ, zoom) }))
      .sort((a, b) => a.proj.depth - b.proj.depth);
  }, [filtered3D, rotX, rotY, rotZ, zoom]);

  const meshHulls = useMemo(() => sampleSliceHulls(filtered3D, 38, 0.035), [filtered3D]);

  const sortedHulls = useMemo(() => {
    return [...meshHulls]
      .map((h) => {
        const c = project3D(
          { x: WHITE_POINT.x, y: WHITE_POINT.y, Y: h.Y, rgb: "#fff", kind: "gray" },
          760,
          560,
          rotX,
          rotY,
          rotZ,
          zoom,
        );
        return { ...h, depth: c.depth };
      })
      .sort((a, b) => a.depth - b.depth);
  }, [meshHulls, rotX, rotY, rotZ, zoom]);

  const sliceHull = useMemo(() => {
    const pts: XY[] = slicePoints.map((p) => [p.x, p.y]);
    pts.push([WHITE_POINT.x, WHITE_POINT.y]);
    return convexHull(pts);
  }, [slicePoints]);

  const demoOriginal = useMemo(
    () => ({ x: demoX, y: demoY, Y: demoLum }),
    [demoX, demoY, demoLum],
  );

  const demoXYZ = useMemo(() => xyYToXYZ([demoX, demoY, demoLum]), [demoX, demoY, demoLum]);

  const demoLuminance = useMemo(
    () => constrainLuminancePoint(demoX, demoY, demoLum),
    [demoX, demoY, demoLum],
  );

  const demoChrominance = useMemo(
    () => constrainChrominancePoint(demoX, demoY, demoLum),
    [demoX, demoY, demoLum],
  );

  const demoOriginalDisplay = useMemo(
    () => xyYToDisplayInfo(demoOriginal.x, demoOriginal.y, demoOriginal.Y),
    [demoOriginal],
  );

  const demoChrominanceDisplay = useMemo(
    () => xyYToDisplayInfo(demoChrominance.x, demoChrominance.y, demoChrominance.Y),
    [demoChrominance],
  );

  const demoLuminanceDisplay = useMemo(
    () => xyYToDisplayInfo(demoLuminance.x, demoLuminance.y, demoLuminance.Y),
    [demoLuminance],
  );

  const demoXyYInvalid = demoOriginalDisplay.outOfGamut;
  const demoXYZInvalid = demoOriginalDisplay.outOfGamut;
  const demoLuminanceFixFails =
    demoOriginalDisplay.outOfGamut && demoOriginal.Y > GAMUT_EPSILON && demoLuminance.Ymax <= GAMUT_EPSILON;
  const luminanceAccent = demoLuminanceFixFails ? "#f87171" : "#38bdf8";

  const viewerPalette = viewerTheme === "light"
    ? {
        cardBg: "#ffffff",
        cardBorder: "#d7e0ea",
        title: "#0f172a",
        subtext: "#334155",
        svgBg: "#ffffff",
        axisStroke: "#64748b",
        axisLabel: "#334155",
        frameStroke: "#94a3b8",
        simplexStroke: "rgba(100,116,139,0.55)",
        locusStroke: "#475569",
        hullFill: "rgba(15,23,42,0.05)",
        hullStroke: "#0f172a",
        meshStroke: "rgba(100,116,139,0.52)",
        meshActiveStroke: "#0f172a",
        sliceMarkerFill: "#0f172a",
        sliceMarkerStroke: "#ffffff",
        segmentBg: "#e2e8f0",
        segmentText: "#334155",
        segmentActiveBg: "#0f172a",
        segmentActiveText: "#f8fafc",
      }
    : {
        cardBg: "#081726",
        cardBorder: "#1e293b",
        title: "#e2e8f0",
        subtext: "#cbd5e1",
        svgBg: "#020617",
        axisStroke: "#64748b",
        axisLabel: "#cbd5e1",
        frameStroke: "#334155",
        simplexStroke: "rgba(100,116,139,0.42)",
        locusStroke: "#94a3b8",
        hullFill: "rgba(255,255,255,0.05)",
        hullStroke: "#e2e8f0",
        meshStroke: "rgba(203,213,225,0.45)",
        meshActiveStroke: "#ffffff",
        sliceMarkerFill: "#ffffff",
        sliceMarkerStroke: "#000000",
        segmentBg: "rgba(255,255,255,0.06)",
        segmentText: "#cbd5e1",
        segmentActiveBg: "#f59e85",
        segmentActiveText: "#08111d",
      };

  const demoSliceHull = useMemo(() => {
    const pts: XY[] = filtered3D
      .filter((p) => Math.abs(p.Y - demoLum) <= sliceThickness / 2)
      .map((p) => [p.x, p.y]);
    pts.push([WHITE_POINT.x, WHITE_POINT.y]);
    return convexHull(pts);
  }, [filtered3D, demoLum, sliceThickness]);

  const demoSliceField = useMemo(
    () => buildSliceColorField(demoLum, demoSliceHull, 760, 560),
    [demoLum, demoSliceHull],
  );

  const W3 = 760;
  const H3 = 560;
  const W2 = 760;
  const H2 = 560;
  const clipId = "sliceClipPath";
  const demoClipId = "demoSliceClipPath";

  const locusPath = useMemo(() => {
    return locus.x
      .map((x, i) => {
        const [px, py] = to2DSpace(x, locus.y[i], W2, H2);
        return `${i === 0 ? "M" : "L"}${px},${py}`;
      })
      .join(" ");
  }, [locus]);

  const simplexPath = useMemo(() => {
    const simplex: XY[] = [
      [0, 0],
      [1, 0],
      [0, 1],
    ].map(([X, Y]) => {
      const Z = Math.max(0, 1 - X - Y);
      const sum = X + Y + Z;
      return [X / sum, Y / sum] as XY;
    });
    return polygonPath(simplex, (p) => to2DSpace(p[0], p[1], W2, H2));
  }, []);

  const sliceField = useMemo(
    () => buildSliceColorField(sliceY, sliceHull, W2, H2),
    [sliceY, sliceHull],
  );

  const axes = [
    axisLine3D([0, 0, 0], [0.8, 0, 0], W3, H3, rotX, rotY, rotZ, zoom, "x"),
    axisLine3D([0, 0, 0], [0, 0.9, 0], W3, H3, rotX, rotY, rotZ, zoom, "y"),
    axisLine3D([0, 0, 0], [0, 0, 1], W3, H3, rotX, rotY, rotZ, zoom, "Y"),
  ];

  const plotlyCamera = useMemo(() => {
    const baseEye = rotatePoint(0.95, 1.25, 1.55, rotX, rotY, rotZ);
    const eyeScale = 1 / Math.max(zoom, 0.2);
    return {
      eye: {
        x: baseEye.x * eyeScale,
        y: baseEye.y * eyeScale,
        z: baseEye.z * eyeScale,
      },
      up: { x: 0, y: 1, z: 0 },
      center: { x: 0, y: 0, z: 0 },
    };
  }, [rotX, rotY, rotZ, zoom]);

  const clearCameraOverride = () => setCameraOverride(null);

  const plotly3DData = useMemo(() => {
    const traces: any[] = [];

    if (showMesh) {
      sortedHulls.forEach((h, idx) => {
        if (h.hull.length < 3) return;
        const hx = h.hull.map((pt) => pt[0]);
        const hy = h.hull.map(() => h.Y);
        const hz = h.hull.map((pt) => pt[1]);
        const i: number[] = [];
        const j: number[] = [];
        const k: number[] = [];
        for (let t = 1; t < h.hull.length - 1; t += 1) {
          i.push(0);
          j.push(t);
          k.push(t + 1);
        }
        traces.push({
          type: "mesh3d",
          x: hx,
          y: hy,
          z: hz,
          i,
          j,
          k,
          color: h.fill,
          opacity: 0.42,
          hoverinfo: "skip",
          flatshading: true,
          showscale: false,
          name: `slice-${idx}`,
        });
        traces.push({
          type: "scatter3d",
          mode: "lines",
          x: [...hx, hx[0]],
          y: [...hy, hy[0]],
          z: [...hz, hz[0]],
          line: {
            color: Math.abs(h.Y - sliceY) <= sliceThickness / 2
              ? viewerPalette.meshActiveStroke
              : viewerPalette.meshStroke,
            width: Math.abs(h.Y - sliceY) <= sliceThickness / 2 ? 5 : 2,
          },
          hoverinfo: "skip",
          showlegend: false,
        });
      });
    }

    if (showPoints) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        x: filtered3D.map((p) => p.x),
        y: filtered3D.map((p) => p.Y),
        z: filtered3D.map((p) => p.y),
        marker: {
          size: Math.max(1.5, pointSize * 2.1),
          color: filtered3D.map((p) => p.rgb),
          opacity: 0.82,
        },
        hovertemplate: "x=%{x:.3f}<br>Y=%{y:.3f}<br>y=%{z:.3f}<extra></extra>",
        showlegend: false,
      });
    }

    if (slicePoints.length > 0) {
      traces.push({
        type: "scatter3d",
        mode: "markers",
        x: slicePoints.map((p) => p.x),
        y: slicePoints.map((p) => p.Y),
        z: slicePoints.map((p) => p.y),
        marker: {
          size: Math.max(2.4, pointSize * 2.8),
          color: viewerPalette.sliceMarkerFill,
          line: {
            color: viewerPalette.sliceMarkerStroke,
            width: 1.2,
          },
        },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    if (showOrthographicIn3D) {
      const a = demoOriginal;
      const b = demoChrominance;
      const c = demoLuminance;
      if (showChrominanceConstraint) {
        traces.push({
          type: "scatter3d",
          mode: "lines",
          x: [a.x, b.x],
          y: [a.Y, b.Y],
          z: [a.y, b.y],
          line: { color: "#22c55e", width: 6 },
          hoverinfo: "skip",
          showlegend: false,
        });
      }
      if (showLuminanceConstraint) {
        traces.push({
          type: "scatter3d",
          mode: "lines",
          x: [a.x, c.x],
          y: [a.Y, c.Y],
          z: [a.y, c.y],
          line: { color: luminanceAccent, width: 6, dash: "dash" },
          hoverinfo: "skip",
          showlegend: false,
        });
      }
      traces.push({
        type: "scatter3d",
        mode: "markers",
        x: [a.x],
        y: [a.Y],
        z: [a.y],
        marker: {
          size: 8,
          color: demoOriginalDisplay.css,
          line: { color: "#ef4444", width: 3 },
        },
        hoverinfo: "skip",
        showlegend: false,
      });
      if (showChrominanceConstraint) {
        traces.push({
          type: "scatter3d",
          mode: "markers",
          x: [b.x],
          y: [b.Y],
          z: [b.y],
          marker: {
            size: 7,
            color: demoChrominanceDisplay.css,
            line: { color: "#22c55e", width: 3 },
          },
          hoverinfo: "skip",
          showlegend: false,
        });
      }
      if (showLuminanceConstraint) {
        traces.push({
          type: "scatter3d",
          mode: "markers",
          x: [c.x],
          y: [c.Y],
          z: [c.y],
          marker: {
            size: 7,
            color: demoLuminanceDisplay.css,
            line: { color: luminanceAccent, width: 3 },
          },
          hoverinfo: "skip",
          showlegend: false,
        });
      }
    }

    return traces;
  }, [
    sortedHulls,
    sliceY,
    sliceThickness,
    viewerPalette,
    showMesh,
    showPoints,
    filtered3D,
    pointSize,
    slicePoints,
    showOrthographicIn3D,
    showChrominanceConstraint,
    showLuminanceConstraint,
    demoOriginal,
    demoChrominance,
    demoLuminance,
    demoOriginalDisplay.css,
    demoChrominanceDisplay.css,
    demoLuminanceDisplay.css,
    luminanceAccent,
  ]);

  const plotly3DLayout = useMemo(() => ({
    paper_bgcolor: viewerPalette.svgBg,
    plot_bgcolor: viewerPalette.svgBg,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
    font: { color: viewerPalette.axisLabel },
    scene: {
      bgcolor: viewerPalette.svgBg,
      camera: cameraOverride ?? plotlyCamera,
      aspectmode: "manual",
      aspectratio: { x: 1.15, y: 1.45, z: 1.0 },
      xaxis: {
        title: "x",
        color: viewerPalette.axisLabel,
        showbackground: false,
        gridcolor: viewerPalette.frameStroke,
        zeroline: false,
        linecolor: viewerPalette.axisStroke,
        tickcolor: viewerPalette.axisStroke,
      },
      yaxis: {
        title: "Y",
        color: viewerPalette.axisLabel,
        showbackground: false,
        gridcolor: viewerPalette.frameStroke,
        zeroline: false,
        linecolor: viewerPalette.axisStroke,
        tickcolor: viewerPalette.axisStroke,
        range: [0, 1],
      },
      zaxis: {
        title: "y",
        color: viewerPalette.axisLabel,
        showbackground: false,
        gridcolor: viewerPalette.frameStroke,
        zeroline: false,
        linecolor: viewerPalette.axisStroke,
        tickcolor: viewerPalette.axisStroke,
      },
    },
  }), [viewerPalette, plotlyCamera, cameraOverride]);

  const syncViewerControlsFromCamera = (event: any) => {
    const camera = event?.["scene.camera"] ?? event?.scene?.camera;
    const eye = camera?.eye;
    if (!eye) return;
    setCameraOverride(camera);
    const fitted = fitViewerControlsFromEye(eye, { rotX, rotY, rotZ });
    if (Math.abs(fitted.rotX - rotX) > 1e-3) setRotX(fitted.rotX);
    if (Math.abs(fitted.rotY - rotY) > 1e-3) setRotY(fitted.rotY);
    if (Math.abs(fitted.rotZ - rotZ) > 1e-3) setRotZ(fitted.rotZ);
    if (Math.abs(fitted.zoom - zoom) > 1e-3) setZoom(fitted.zoom);
  };

  useEffect(() => {
    if (!plotlyGraphDiv?.on || !plotlyGraphDiv?.removeListener) return undefined;
    const handleRelayouting = (event: any) => {
      syncViewerControlsFromCamera(event);
    };
    plotlyGraphDiv.on("plotly_relayouting", handleRelayouting);
    return () => {
      plotlyGraphDiv.removeListener("plotly_relayouting", handleRelayouting);
    };
  }, [plotlyGraphDiv, rotX, rotY, rotZ, zoom]);

  const syncFromXyY = (x: number, y: number, Y: number) => {
    const clampedY = Math.max(0, Math.min(1, Y));
    setDemoX(x);
    setDemoY(y);
    setDemoLum(clampedY);
    setSliceY(clampedY);
    const rgb255 = xyYToDisplayInfo(x, y, clampedY).rgb255;
    setDemoR(rgb255[0]);
    setDemoG(rgb255[1]);
    setDemoB(rgb255[2]);
  };

  const syncFromRgb = (r: number, g: number, b: number) => {
    const rgb: RGB255 = [clamp255(r), clamp255(g), clamp255(b)];
    setDemoR(rgb[0]);
    setDemoG(rgb[1]);
    setDemoB(rgb[2]);
    const [x, y, Y] = srgb255ToXyY(rgb);
    const clampedY = Math.max(0, Math.min(1, Y));
    setDemoX(x);
    setDemoY(y);
    setDemoLum(clampedY);
    setSliceY(clampedY);
  };

  const syncFromXyz = (X: number, Y: number, Z: number) => {
    const [x, y, lum] = xyzToXyY([Math.max(0, X), Math.max(0, Y), Math.max(0, Z)]);
    const clampedY = Math.max(0, Math.min(1, lum));
    setDemoX(x);
    setDemoY(y);
    setDemoLum(clampedY);
    setSliceY(clampedY);
    const rgb255 = xyYToDisplayInfo(x, y, clampedY).rgb255;
    setDemoR(rgb255[0]);
    setDemoG(rgb255[1]);
    setDemoB(rgb255[2]);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">CIE xyY Optimal Color Solid under D65</h1>
          <p className="max-w-5xl text-slate-300">
            Interactive browser viewer of an approximate Rösch–MacAdam color solid for reflective
            surfaces under D65 illumination. Conventions followed here: CIE 1931 xyY, D65 white
            point, normalized Y in [0,1], and sRGB / Rec.709 as the target display gamut for the
            gamut-control demonstrations.
          </p>
        </div>

        <div className="layout-grid">
          <div className="left-col space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div>
              <NumericSlider
                label="Slice luminance Y"
                min={0}
                max={1}
                step={0.005}
                value={sliceY}
                onChange={setSliceY}
              />
            </div>

            <div>
              <NumericSlider
                label="Slice thickness"
                min={0.01}
                max={0.2}
                step={0.005}
                value={sliceThickness}
                onChange={setSliceThickness}
              />
            </div>

            <div>
              <NumericSlider
                label="Point size"
                min={1.0}
                max={4.0}
                step={0.1}
                value={pointSize}
                onChange={setPointSize}
              />
            </div>

            <div className="space-y-3 flex flex-col">
              <label className="checkbox-row">
                <input
                  className="checkbox-input"
                  type="checkbox"
                  checked={showPass}
                  onChange={(e) => setShowPass(e.target.checked)}
                />
                <div className="checkbox-label">Show band-pass optimal reflectances</div>
              </label>

              <label className="checkbox-row">
                <input
                  className="checkbox-input"
                  type="checkbox"
                  checked={showStop}
                  onChange={(e) => setShowStop(e.target.checked)}
                />
                <div className="checkbox-label">Show band-stop optimal reflectances</div>
              </label>

              <label className="checkbox-row">
                <input
                  className="checkbox-input"
                  type="checkbox"
                  checked={showMesh}
                  onChange={(e) => setShowMesh(e.target.checked)}
                />
                <div className="checkbox-label">Show filled slice stack</div>
              </label>

              <label className="checkbox-row">
                <input
                  className="checkbox-input"
                  type="checkbox"
                  checked={showPoints}
                  onChange={(e) => setShowPoints(e.target.checked)}
                />
                <div className="checkbox-label">Show point cloud</div>
              </label>
              {/* 'Show orthographic constraints in 3D view' moved to the demo panel on wide screens */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <div className="mb-2 text-sm font-medium text-slate-200">View controls</div>
                <div className="mb-1 text-sm font-medium text-slate-200">Rotating axis</div>
                <div className="grid grid-cols-1 gap-3">
                  <NumericSlider
                    label="X"
                    min={-1.4}
                    max={1.4}
                    step={0.01}
                    value={rotX}
                    onChange={(value) => {
                      clearCameraOverride();
                      setRotX(value);
                    }}
                  />
                  <NumericSlider
                    label="Y (chroma)"
                    min={-3.14}
                    max={3.14}
                    step={0.01}
                    value={rotY}
                    onChange={(value) => {
                      clearCameraOverride();
                      setRotY(value);
                    }}
                  />
                  <NumericSlider
                    label="Y (lum)"
                    min={-3.14}
                    max={3.14}
                    step={0.01}
                    value={rotZ}
                    onChange={(value) => {
                      clearCameraOverride();
                      setRotZ(value);
                    }}
                  />
                </div>
                <div className="mt-3">
                  <NumericSlider
                    label="Zoom"
                    min={0.65}
                    max={1.6}
                    step={0.01}
                    value={zoom}
                    onChange={(value) => {
                      clearCameraOverride();
                      setZoom(value);
                    }}
                  />
                </div>
              </div>
            </div>

            
          </div>

          <div className="center-col grid grid-cols-1 gap-4">
            <div
              className="space-y-3 rounded-2xl border p-3"
              style={{ backgroundColor: viewerPalette.cardBg, borderColor: viewerPalette.cardBorder }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium" style={{ color: viewerPalette.title }}>
                  Interactive 3D xyY view
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    gap: 4,
                    padding: 4,
                    borderRadius: 999,
                    backgroundColor: viewerPalette.segmentBg,
                  }}
                >
                  {(["dark", "light"] as const).map((themeKey) => {
                    const active = viewerTheme === themeKey;
                    return (
                      <button
                        key={themeKey}
                        type="button"
                        onClick={() => setViewerTheme(themeKey)}
                        style={{
                          border: 0,
                          borderRadius: 999,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          backgroundColor: active ? viewerPalette.segmentActiveBg : "transparent",
                          color: active ? viewerPalette.segmentActiveText : viewerPalette.segmentText,
                        }}
                      >
                        {themeKey === "dark" ? "Dark" : "Light"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Plot
                data={plotly3DData}
                layout={plotly3DLayout as any}
                config={{
                  responsive: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ["select2d", "lasso2d"],
                }}
                onInitialized={(_, graphDiv) => setPlotlyGraphDiv(graphDiv)}
                onUpdate={(_, graphDiv) => setPlotlyGraphDiv(graphDiv)}
                onPurge={() => setPlotlyGraphDiv(null)}
                onRelayout={syncViewerControlsFromCamera}
                style={{ width: "100%", height: "560px", borderRadius: 16, overflow: "hidden" }}
                useResizeHandler
              />

                

              
            </div>

            <div
              className="rounded-2xl border p-3"
              style={{ backgroundColor: viewerPalette.cardBg, borderColor: viewerPalette.cardBorder }}
            >
              <div className="mb-2 text-sm font-medium text-slate-200">
                <span style={{ color: viewerPalette.title }}>
                  Chromaticity slice at Y ≈ {sliceY.toFixed(2)}
                </span>
              </div>
              <svg viewBox={`0 0 ${W2} ${H2}`} className="h-[560px] w-full rounded-xl" style={{ backgroundColor: viewerPalette.svgBg }}>
                <defs>
                  <clipPath id={clipId}>
                    {sliceHull.length >= 3 && (
                      <path d={polygonPath(sliceHull, (p) => to2DSpace(p[0], p[1], W2, H2))} />
                    )}
                  </clipPath>
                </defs>

                <rect
                  x={60}
                  y={40}
                  width={W2 - 120}
                  height={H2 - 90}
                  fill="none"
                  stroke={viewerPalette.frameStroke}
                  strokeWidth={1}
                />
                <line
                  x1={60}
                  y1={H2 - 40}
                  x2={W2 - 40}
                  y2={H2 - 40}
                  stroke={viewerPalette.axisStroke}
                  strokeWidth={1.5}
                />
                <line
                  x1={60}
                  y1={H2 - 40}
                  x2={60}
                  y2={40}
                  stroke={viewerPalette.axisStroke}
                  strokeWidth={1.5}
                />
                <text x={W2 - 30} y={H2 - 45} fill={viewerPalette.axisLabel} fontSize="12">
                  x
                </text>
                <text x={46} y={36} fill={viewerPalette.axisLabel} fontSize="12">
                  y
                </text>

                <path
                  d={simplexPath}
                  fill="none"
                  stroke={viewerPalette.simplexStroke}
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                />
                <path d={locusPath} fill="none" stroke={viewerPalette.locusStroke} strokeWidth={2} />

                {sliceHull.length >= 3 && <g clipPath={`url(#${clipId})`}>{sliceField}</g>}

                {sliceHull.length >= 3 && (
                  <path
                    d={polygonPath(sliceHull, (p) => to2DSpace(p[0], p[1], W2, H2))}
                    fill={viewerPalette.hullFill}
                    stroke={viewerPalette.hullStroke}
                    strokeWidth={2}
                  />
                )}

                {slicePoints.map((p, idx) => {
                  const [px, py] = to2DSpace(p.x, p.y, W2, H2);
                  return (
                    <circle
                      key={`xy-${idx}`}
                      cx={px}
                      cy={py}
                      r={3.2}
                      fill={p.rgb}
                      stroke={viewerPalette.svgBg}
                      strokeWidth={0.3}
                    />
                  );
                })}

                {showOrthographicIn3D && (
                  <g>
                    {showChrominanceConstraint && (
                      <line
                        x1={to2DSpace(demoOriginal.x, demoOriginal.y, W2, H2)[0]}
                        y1={to2DSpace(demoOriginal.x, demoOriginal.y, W2, H2)[1]}
                        x2={to2DSpace(demoChrominance.x, demoChrominance.y, W2, H2)[0]}
                        y2={to2DSpace(demoChrominance.x, demoChrominance.y, W2, H2)[1]}
                        stroke="#22c55e"
                        strokeWidth={2.2}
                      />
                    )}
                    {showLuminanceConstraint && (
                      <line
                        x1={to2DSpace(demoOriginal.x, demoOriginal.y, W2, H2)[0]}
                        y1={to2DSpace(demoOriginal.x, demoOriginal.y, W2, H2)[1]}
                        x2={to2DSpace(demoLuminance.x, demoLuminance.y, W2, H2)[0]}
                        y2={to2DSpace(demoLuminance.x, demoLuminance.y, W2, H2)[1]}
                        stroke={luminanceAccent}
                        strokeWidth={2.2}
                        strokeDasharray="6 5"
                      />
                    )}

                    <PointMarker
                      x={demoOriginal.x}
                      y={demoOriginal.y}
                      W={W2}
                      H={H2}
                      fill={demoOriginalDisplay.css}
                      stroke="#ef4444"
                      r={6.5}
                    />
                    {showChrominanceConstraint && (
                      <PointMarker
                        x={demoChrominance.x}
                        y={demoChrominance.y}
                        W={W2}
                        H={H2}
                        fill={demoChrominanceDisplay.css}
                        stroke="#22c55e"
                        r={5.5}
                      />
                    )}
                    {showLuminanceConstraint && (
                      <PointMarker
                        x={demoLuminance.x}
                        y={demoLuminance.y}
                        W={W2}
                        H={H2}
                        fill={demoLuminanceDisplay.css}
                        stroke={luminanceAccent}
                        r={5.5}
                      />
                    )}
                  </g>
                )}

                <line
                  x1={to2DSpace(WHITE_POINT.x, WHITE_POINT.y, W2, H2)[0]}
                  y1={H2 - 40}
                  x2={to2DSpace(WHITE_POINT.x, WHITE_POINT.y, W2, H2)[0]}
                  y2={40}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 4"
                />

                <PointMarker
                  x={WHITE_POINT.x}
                  y={WHITE_POINT.y}
                  W={W2}
                  H={H2}
                  fill="#ffffff"
                  stroke="#000000"
                />
              </svg>
            </div>

            </div>

            <div className="right-col space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Single-point xyY / RGB demonstration</h2>
              <p className="max-w-5xl text-sm text-slate-300">
                The xyY and RGB controls below are linked. Changing one representation updates the
                other.
              </p>
            </div>

            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showOrthographicIn3D}
                  onChange={(e) => setShowOrthographicIn3D(e.target.checked)}
                />
                Show constraint example
              </label>
            </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="mb-2 text-sm font-medium text-slate-200">Demonstration's color</div>
                  <div className={`mb-3 text-xs ${demoLuminance.Ymax <= GAMUT_EPSILON ? "is-invalid" : "text-slate-400"}`}>
                    Max feasible luminance for this chromaticity: {demoLuminance.Ymax.toFixed(3)}
                    {demoLuminance.Ymax <= GAMUT_EPSILON
                      ? " — no strictly positive Y can remain inside sRGB for this x/y."
                      : " — luminance-only correction clamps Y to this limit."}
                  </div>
                  {demoLuminanceFixFails && (
                    <div className="warning-banner">
                      <strong>Luminance-only correction cannot work here.</strong> The chromaticity
                      (`x`, `y`) is too far outside the display gamut, so reducing only `Y` still
                      leaves the transformed color out of gamut.
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className={`panel-subtitle ${demoXyYInvalid ? "is-invalid" : ""}`}>CIE xyY</div>
                      <NumericSlider
                        label="x"
                        min={0}
                        max={0.8}
                        step={0.001}
                        value={demoX}
                        onChange={(v) => syncFromXyY(v, demoY, demoLum)}
                        invalid={demoXyYInvalid}
                      />
                      <NumericSlider
                        label="y"
                        min={0.001}
                        max={0.9}
                        step={0.001}
                        value={demoY}
                        onChange={(v) => syncFromXyY(demoX, v, demoLum)}
                        invalid={demoXyYInvalid}
                      />
                      <NumericSlider
                        label="Y"
                        min={0}
                        max={1}
                        step={0.001}
                        value={demoLum}
                        onChange={(v) => syncFromXyY(demoX, demoY, v)}
                        invalid={demoXyYInvalid}
                      />
                    </div>
                    <div>
                      <div className={`panel-subtitle ${demoXYZInvalid ? "is-invalid" : ""}`}>CIE XYZ</div>
                      <NumericSlider
                        label="X"
                        min={0}
                        max={1.4}
                        step={0.001}
                        value={demoXYZ[0]}
                        onChange={(v) => syncFromXyz(v, demoXYZ[1], demoXYZ[2])}
                        invalid={demoXYZInvalid}
                      />
                      <NumericSlider
                        label="Y"
                        min={0}
                        max={1}
                        step={0.001}
                        value={demoXYZ[1]}
                        onChange={(v) => syncFromXyz(demoXYZ[0], v, demoXYZ[2])}
                        invalid={demoXYZInvalid}
                      />
                      <NumericSlider
                        label="Z"
                        min={0}
                        max={1.4}
                        step={0.001}
                        value={demoXYZ[2]}
                        onChange={(v) => syncFromXyz(demoXYZ[0], demoXYZ[1], v)}
                        invalid={demoXYZInvalid}
                      />
                    </div>
                    <div>
                      <div className="panel-subtitle">sRGB</div>
                      <NumericSlider
                        label="R"
                        min={0}
                        max={255}
                        step={1}
                        value={demoR}
                        onChange={(v) => syncFromRgb(v, demoG, demoB)}
                      />
                      <NumericSlider
                        label="G"
                        min={0}
                        max={255}
                        step={1}
                        value={demoG}
                        onChange={(v) => syncFromRgb(demoR, v, demoB)}
                      />
                      <NumericSlider
                        label="B"
                        min={0}
                        max={255}
                        step={1}
                        value={demoB}
                        onChange={(v) => syncFromRgb(demoR, demoG, v)}
                      />
                    </div>
                  </div>
                </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 text-sm font-medium text-slate-200">Legend — demo points</div>
              <div className="text-sm text-slate-300 mb-2">Markers and colors used for the demo results shown in the views:</div>

              <div className="flex flex-col gap-3 text-sm text-slate-200">
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-block h-6 w-12 rounded border ${demoOriginalDisplay.outOfGamut ? 'border-red-400' : 'border-green-400'}`}
                    style={{ backgroundColor: demoOriginalDisplay.css || rgb255ToCss(demoOriginalDisplay.rgb255) }}
                  />
                  <div>
                    <div className="font-semibold">Original point</div>
                    <div className="text-xs text-slate-400">Filled box shows the display color; red border = out of sRGB gamut.</div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-1">Chrominance-constrained result</div>
                  <div className="flex items-start gap-3">
                    <input
                      className="toggle-input"
                      type="checkbox"
                      checked={showChrominanceConstraint}
                      onChange={(e) => setShowChrominanceConstraint(e.target.checked)}
                    />
                    <svg width={48} height={12} className="mt-1 inline-block">
                      <line x1={2} y1={6} x2={46} y2={6} stroke="#22c55e" strokeWidth={3} strokeLinecap="round" />
                    </svg>
                    <div className="text-xs text-slate-400">
                      Green solid line (as shown in the graphs) — swatch shows clipped display color.
                    </div>
                  </div>
                </div>

                <div>
                  <div className={`font-semibold mb-1 ${demoLuminanceFixFails ? 'is-invalid' : ''}`}>
                    Luminance-constrained result
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      className="toggle-input"
                      type="checkbox"
                      checked={showLuminanceConstraint}
                      onChange={(e) => setShowLuminanceConstraint(e.target.checked)}
                    />
                    <svg width={48} height={12} className="mt-1 inline-block">
                      <line x1={2} y1={6} x2={46} y2={6} stroke={luminanceAccent} strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" />
                    </svg>
                    <div className={`text-xs ${demoLuminanceFixFails ? 'is-invalid' : 'text-slate-400'}`}>
                      {demoLuminanceFixFails
                        ? "This strategy fails here: changing only luminance does not bring the color back into gamut because x/y remain too extreme."
                        : "Blue dashed line (as shown in the graphs) — swatch shows clipped display color."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Understanding the two constraint results</h2>
            <p className="max-w-5xl text-sm text-slate-300">
              The two correction results shown above do not act on the same part of the color.
              One keeps luminance fixed and changes chromaticity. The other keeps chromaticity
              fixed and changes luminance.
            </p>
          </div>

          <div className="safeguard-grid">
            <SafeguardDemoCard
              tag="C"
              title="Chrominance-constrained result"
              description="This correction keeps the luminance level fixed and moves the chromaticity toward the D65 white point until the reconstructed RGB falls back inside the display gamut."
              visual={
                <svg viewBox="0 0 320 170" className="h-[170px] w-full rounded-xl bg-slate-950">
                  <rect x="18" y="18" width="284" height="134" rx="14" fill="rgba(15,23,36,0.95)" stroke="rgba(255,255,255,0.08)" />
                  <line x1="44" y1="126" x2="144" y2="126" stroke="#64748b" strokeWidth="1.3" />
                  <text x="42" y="38" fill="#cbd5e1" fontSize="11">Y</text>
                  <rect x="66" y="136" width="48" height="16" rx="8" fill="rgba(2,6,23,0.82)" />
                  <text x="90" y="147" fill="#cbd5e1" fontSize="8.8" textAnchor="middle">fixed Y</text>
                  <line x1="62" y1="52" x2="62" y2="126" stroke="#22c55e" strokeWidth="3" />
                  <line x1="90" y1="52" x2="90" y2="126" stroke="#22c55e" strokeWidth="3" opacity="0.65" />
                  <line x1="118" y1="52" x2="118" y2="126" stroke="#22c55e" strokeWidth="3" opacity="0.35" />

                  <line x1="188" y1="120" x2="264" y2="120" stroke="rgba(100,116,139,0.75)" strokeWidth="1.2" />
                  <line x1="188" y1="120" x2="188" y2="44" stroke="rgba(100,116,139,0.75)" strokeWidth="1.2" />
                  <text x="268" y="124" fill="#cbd5e1" fontSize="10">x</text>
                  <text x="183" y="40" fill="#cbd5e1" fontSize="10">y</text>
                  <circle cx="226" cy="82" r="38" fill="none" stroke="rgba(148,163,184,0.26)" strokeWidth="1.2" />
                  <circle cx="226" cy="82" r="4" fill="#ffffff" />
                  <circle cx="256" cy="56" r="6" fill="#fb7185" stroke="#0f172a" strokeWidth="1.2" />
                  <line x1="256" y1="56" x2="236" y2="74" stroke="#22c55e" strokeWidth="2.6" />
                  <polygon points="238,70 238,78 231,75" fill="#22c55e" />
                  <rect x="170" y="128" width="116" height="18" rx="9" fill="rgba(2,6,23,0.82)" />
                  <text x="172" y="140" fill="#86efac" fontSize="8.6">pull x,y inward toward D65</text>
                </svg>
              }
              explanation={
                <>
                  <p>
                    Here the vertical luminance coordinate stays unchanged, while the chromaticity
                    is desaturated toward the white point. Geometrically, the color slides inward in
                    the <strong>x,y</strong> plane until it is no longer out-of-gamut.
                  </p>
                  <ul>
                    <li>preserves the perceived brightness structure</li>
                    <li>changes hue and saturation less abruptly than hard clipping</li>
                    <li>works well when the chromaticity is only moderately outside the gamut</li>
                  </ul>
                </>
              }
              expandableContent={
                <div className="safeguard-copy">
                  <p>
                    The idea is to keep <strong>Y</strong> fixed and shrink the distance from the
                    current chromaticity to the D65 white point:
                  </p>
                  <div className="math-block">x' = x_w + k (x - x_w)</div>
                  <div className="math-block">y' = y_w + k (y - y_w)</div>
                  <p>
                    with a factor <strong>k</strong> between <strong>0</strong> and
                    <strong> 1</strong>. When <strong>k = 1</strong>, nothing changes. When
                    <strong> k = 0</strong>, the color collapses to the white point.
                  </p>
                  <p>
                    The chosen factor is the smallest reduction needed so that the reconstructed
                    linear RGB channels no longer fall below <strong>0</strong> or above
                    <strong> 1</strong>. In other words, this correction acts mainly on saturation
                    and hue while keeping the luminance slice fixed.
                  </p>
                </div>
              }
            />

            <SafeguardDemoCard
              tag="L"
              title="Luminance-constrained result"
              description="This correction keeps the chromaticity fixed and reduces luminance until the color reaches the highest displayable luminance compatible with that chromaticity."
              visual={
                <svg viewBox="0 0 320 170" className="h-[170px] w-full rounded-xl bg-slate-950">
                  <rect x="18" y="18" width="284" height="134" rx="14" fill="rgba(15,23,36,0.95)" stroke="rgba(255,255,255,0.08)" />
                  <line x1="84" y1="40" x2="84" y2="134" stroke="#64748b" strokeWidth="1.4" />
                  <line x1="84" y1="134" x2="160" y2="134" stroke="#64748b" strokeWidth="1.4" />
                  <text x="68" y="35" fill="#cbd5e1" fontSize="11">Y</text>
                  <rect x="118" y="136" width="54" height="16" rx="8" fill="rgba(2,6,23,0.82)" />
                  <text x="128" y="147" fill="#cbd5e1" fontSize="10">fixed x,y</text>
                  <rect x="96" y="46" width="190" height="44" rx="10" fill="rgba(248,113,113,0.08)" />
                  <rect x="96" y="90" width="190" height="38" rx="10" fill="rgba(74,222,128,0.08)" />
                  <line x1="122" y1="50" x2="122" y2="122" stroke="#38bdf8" strokeWidth="2.8" strokeDasharray="6 5" />
                  <line x1="96" y1="90" x2="286" y2="90" stroke="#86efac" strokeWidth="2.2" strokeDasharray="4 4" />
                  <circle cx="122" cy="58" r="6" fill="#fb7185" stroke="#0f172a" strokeWidth="1.2" />
                  <path d="M122 68 L122 99 M116 91 L122 99 L128 91" fill="none" stroke="#e2e8f0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="122" cy="102" r="6" fill="#7dd3fc" stroke="#0f172a" strokeWidth="1.2" />
                  <rect x="176" y="30" width="112" height="18" rx="9" fill="rgba(2,6,23,0.82)" />
                  <text x="186" y="42" fill="#fca5a5" fontSize="9.3">over Y limit for gamut</text>
                  <rect x="174" y="76" width="112" height="18" rx="9" fill="rgba(2,6,23,0.82)" />
                  <text x="186" y="88" fill="#86efac" fontSize="9.3">acceptable Y limit</text>
                  <rect x="176" y="114" width="102" height="18" rx="9" fill="rgba(2,6,23,0.82)" />
                  <text x="188" y="126" fill="#7dd3fc" fontSize="9.3">pull Y inward</text>
                </svg>
              }
              explanation={
                <>
                  <p>
                    Here the chromaticity is kept fixed, so the point stays at the same
                    <strong> x,y</strong> location. Only the luminance is reduced, moving the color
                    downward until it reaches the brightest value that is no longer out-of-gamut.
                  </p>
                  <ul>
                    <li>preserves chromaticity exactly</li>
                    <li>changes brightness instead of hue</li>
                    <li>can fail when the chromaticity itself is fundamentally incompatible with the display gamut</li>
                  </ul>
                </>
              }
              expandableContent={
                <div className="safeguard-copy">
                  <p>
                    The simplest form is to keep <strong>x</strong> and <strong>y</strong> fixed and
                    replace the luminance by the largest admissible value:
                  </p>
                  <div className="math-block">Y' = min(Y, Y_max)</div>
                  <p>
                    The quantity <strong>Y_max</strong> is found by reconstructing the color at unit
                    luminance, converting it through <span className="math-inline">xyY → XYZ → linear RGB</span>,
                    and determining how much the luminance must be reduced so that all RGB channels
                    lie inside <strong>[0, 1]</strong>.
                  </p>
                  <p>
                    This works well when the problem is only that the color is too bright. But if the
                    chromaticity already produces negative RGB channels, then reducing
                    <strong> Y</strong> alone cannot fix the incompatibility. In that case, no
                    positive luminance can make the color displayable without also changing
                    chromaticity.
                  </p>
                </div>
              }
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Understanding the 4 gamut-control safeguards</h2>
            <p className="max-w-5xl text-sm text-slate-300">
              The SHINIER gamut-control model does not rely on a single hard clamp. It adds four
              safeguards so that unstable pixels, singular chromaticities, and rare outliers do not
              dominate the correction factor.
            </p>
          </div>

          <div className="safeguard-grid">
            <SafeguardDemoCard
              tag="S1"
              title="Low-luminance preventive desaturation"
              description="Near Y≈0, the xyY solid becomes much wider at its base than just above it, so tiny chromaticity perturbations can correspond to very large colour changes."
              visual={<LowLuminanceSafeguardVisual />}
              explanation={
                <>
                  <p>
                    In the 3D viewer, this is visible immediately: the base of the xyY solid near
                    <strong> Y = 0</strong> spreads much more widely than the layers just above it.
                    That means a tiny perturbation in a very dark pixel can jump to a very distant
                    chromaticity. The safeguard therefore keeps <strong>Y</strong> unchanged, but
                    progressively pulls <strong>x,y</strong> toward the adapting white point.
                  </p>
                  <ul>
                    <li>strongest effect near black, where the solid is widest and least stable</li>
                    <li>optional fade window for a smooth transition</li>
                    <li>prevents low-Y chromatic noise from driving later gamut constraints</li>
                  </ul>
                </>
              }
              expandableContent={
                <div className="safeguard-copy">
                  <p>
                    The preventive desaturation strength is computed from the normalized luminance
                    <strong> Y</strong>. With a hard threshold, the rule is simply:
                  </p>
                  <div className="math-block">desaturation = 1 if Y is below the threshold, otherwise 0</div>
                  <p>
                    With a fade window, the transition becomes continuous so that there is no abrupt
                    visual break:
                  </p>
                  <div className="math-block">t = clip((threshold - Y) / transition width, 0, 1)</div>
                  <div className="math-block">desaturation = t² (3 - 2t)</div>
                  <p>
                    The chromaticity is then pulled toward the D65 adapting white point, while the
                    luminance is kept fixed:
                  </p>
                  <div className="math-block">x' = (1 - s) x + s x_w</div>
                  <div className="math-block">y' = (1 - s) y + s y_w</div>
                  <p>
                    This follows the D65-centered xy interpolation used in the color pipeline and is
                    meant to prevent low-luminance chromatic noise from being amplified by later
                    gamut constraints.
                  </p>
                </div>
              }
            />

            <SafeguardDemoCard
              tag="S2"
              title="Chroma validity mask"
              description="Only physically plausible and numerically stable chromaticities are allowed to influence the constraint estimate."
              visual={<S2ChromaticityDiagramVisual samples={buildS2Samples()} />}
              explanation={
                <>
                  <p>
                    The theoretical chromaticity constraints are <strong>x ≥ 0</strong>,
                    <strong> y ≥ 0</strong>, and <strong>x + y ≤ 1</strong>, with
                    <strong> z = 1 - x - y ≥ 0</strong>. Two extra numerical margins are then added:
                    require <strong>y &gt; εy</strong> and <strong>x + y ≤ 1 - ε</strong>.
                  </p>
                  <p>
                    This is directly tied to the <span className="math-inline">xyY → XYZ</span> equations:
                  </p>
                  <div className="math-block">X = xY / y</div>
                  <div className="math-block">Z = (1 - x - y)Y / y</div>
                  <p>
                    When <strong>y → 0</strong>, both <strong>X</strong> and <strong>Z</strong>
                    become numerically explosive because they divide by <strong>y</strong>. And when
                    <strong> x + y → 1</strong>, tiny floating-point errors can flip the sign of
                    <span className="math-inline">z = 1 - x - y</span>, creating negative or unstable RGB values.
                  </p>
                  <ul>
                    <li>rejects near-singular divisions by y</li>
                    <li>keeps the estimate safely inside the valid simplex</li>
                    <li>these epsilons are stability margins, not new colour theory constraints</li>
                  </ul>
                </>
              }
              expandableContent={
                <div className="safeguard-copy">
                  <div className="s2-card-visual-grid">
                    <div className="s2-card-visual-panel">
                      <div className="s2-card-visual-title">RGB reconstruction instability</div>
                      <S2RgbInstabilityPanelVisual samples={buildS2Samples()} />
                    </div>
                    <S2Legend />
                  </div>
                  <p>
                    The theoretical chromaticity constraints are <strong>x ≥ 0</strong>,
                    <strong> y ≥ 0</strong>, and <strong>x + y ≤ 1</strong>, with
                    <span className="math-inline">z = 1 - x - y ≥ 0</span>. Two extra numerical margins are then added:
                    require <strong>y &gt; εy</strong> and <strong>x + y ≤ 1 - ε</strong>.
                  </p>
                  <p>
                    This is directly tied to the <span className="math-inline">xyY → XYZ</span> equations:
                  </p>
                  <div className="math-block">X = xY / y</div>
                  <div className="math-block">Z = (1 - x - y)Y / y</div>
                  <p>
                    When <strong>y → 0</strong>, both <strong>X</strong> and <strong>Z</strong> become numerically explosive because they divide by <strong>y</strong>. And when <strong>x + y → 1</strong>, tiny floating-point errors can flip the sign of <span className="math-inline">z = 1 - x - y</span>, creating negative or unstable RGB values.
                  </p>
                  <ul>
                    <li>rejects near-singular divisions by y</li>
                    <li>keeps the estimate safely inside the valid simplex</li>
                    <li>these epsilons are stability margins, not new colour theory constraints</li>
                  </ul>
                </div>
              }
            />

            <SafeguardDemoCard
              tag="S3"
              title="Reliability weighting by luminance"
              description="Mid-tones are trusted more than near-black and near-white pixels when estimating a global correction factor."
              visual={<ReliabilitySafeguardVisual />}
              explanation={
                <>
                  <p>
                    The safeguard builds a reliability weight in <strong>[0, 1]</strong>. Near
                    <strong> Y = 0</strong> and <strong>Y = 1</strong>, tiny xy noise can cause very
                    large RGB excursions, so those pixels are down-weighted. Mid-tones dominate the
                    estimate instead.
                  </p>
                  <ul>
                    <li>reduces sensitivity to unstable extreme luminances</li>
                    <li>prevents a few edge pixels from controlling the whole image</li>
                    <li>works together with the chroma validity mask</li>
                  </ul>
                </>
              }
              expandableContent={
                <div className="safeguard-copy">
                  <p>
                    The first idea is to measure how far each pixel is from the luminance extremes:
                  </p>
                  <div className="math-block">distance to edge = min(Y, 1 - Y)</div>
                  <div className="math-block">w = clip(dist_to_edge / fade_width, 0, 1)</div>
                  <p>
                    So the weight is close to <strong>0</strong> near <strong>Y = 0</strong> and
                    <strong> Y = 1</strong>, and close to <strong>1</strong> in the mid-tones.
                    This means that unstable edge luminances do not fully control the correction.
                  </p>
                  <p>
                    In the image-level and dataset-level strategies, this reliability is blended with
                    the raw constraint estimate. For luminance scaling, the form is:
                  </p>
                  <div className="math-block">safe scaling = raw scaling · w + 1 · (1 - w)</div>
                  <p>
                    For chrominance scaling, the same logic is applied:
                  </p>
                  <div className="math-block">safe chroma factor = raw chroma factor · w + 1 · (1 - w)</div>
                  <p>
                    The effect is simple: unstable extremes are pulled back toward “no correction”,
                    while the mid-tones retain most of the true constraint information.
                  </p>
                </div>
              }
            />

            <SafeguardDemoCard
              tag="S4"
              title="Allowed outlier clipping"
              description="A lower quantile can be used instead of the absolute minimum, so a tiny number of pathological pixels do not force excessive compression."
              visual={<QuantileSafeguardVisual />}
              explanation={
                <>
                  <p>
                    Without this safeguard, the global correction strength is effectively set by the
                    worst pixels in the image or dataset. That is often too conservative: one or two
                    pathological pixels can force a strong luminance compression or desaturation for
                    everything else.
                  </p>
                  <p>
                    Using a lower quantile instead of the absolute minimum allows a tiny fraction of
                    the worst pixels to clip, while the rest of the image receives a much less
                    aggressive constraint.
                  </p>
                  <ul>
                    <li>minimum = constraint strength dictated by the worst pixel</li>
                    <li>quantile = more robust estimate of the needed correction strength</li>
                    <li>trades a little clipping on rare outliers for much less global compression</li>
                  </ul>
                </>
              }
              expandableContent={
                <div className="safeguard-copy">
                  <p>
                    The final global factor is not forced to come from the single worst pixel.
                    Instead, it can come from a lower quantile of the distribution.
                  </p>
                  <div className="math-block">quantile threshold = clipped percentage / 100</div>
                  <div className="math-block">chosen factor = lower quantile of the constraint distribution</div>
                  <p>
                    In the current SHINIER setup, the clipped fraction is
                    <span className="math-inline">0.5%</span>, meaning the most extreme
                    <strong> 0.5%</strong> of pixels are allowed to clip instead of dictating the full
                    compression strength.
                  </p>
                  <p>
                    This is especially important because the raw scaling values are built from the
                    maximum admissible luminance divided by the actual luminance:
                  </p>
                  <div className="math-block">raw scaling = Y_max / (Y + 10⁻⁹)</div>
                  <p>
                    Here, <span className="math-inline">Y_max</span> comes from the raw
                    <span className="math-inline">xyY → XYZ → linear RGB</span> reconstruction under
                    D65 and the target display gamut. So if a tiny aberrant set of pixels produces
                    huge excursions, a pure minimum would be far too severe.
                  </p>
                </div>
              }
            />
          </div>
        </section>

      </div>
    </div>
  );
}
