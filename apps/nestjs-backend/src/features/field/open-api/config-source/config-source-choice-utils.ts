import { ColorUtils, Colors } from '@teable/core';

export function normalizeChoiceColor(color: string | null, seed: string): Colors {
  if (color && Object.values(Colors).includes(color as Colors)) {
    return color as Colors;
  }

  if (color?.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (rgb) {
      return findNearestColor(rgb);
    }
  }

  return ColorUtils.getRandomColorFromStr(seed);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim();
  const normalized =
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;

  const matched = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!matched) {
    return null;
  }

  const num = Number.parseInt(matched[1], 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function findNearestColor(rgb: { r: number; g: number; b: number }): Colors {
  let nearest = Colors.Blue;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const token of Object.values(Colors)) {
    const tokenHex = ColorUtils.getHexForColor(token);
    if (!tokenHex) {
      continue;
    }
    const tokenRgb = hexToRgb(tokenHex);
    if (!tokenRgb) {
      continue;
    }

    const dr = tokenRgb.r - rgb.r;
    const dg = tokenRgb.g - rgb.g;
    const db = tokenRgb.b - rgb.b;
    const distance = dr * dr + dg * dg + db * db;

    if (distance < minDistance) {
      minDistance = distance;
      nearest = token;
    }
  }

  return nearest;
}
