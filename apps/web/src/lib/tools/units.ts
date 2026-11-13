export interface Unit {
  id: string;
  name: string;
  /** Multiply by this to get the base unit (ignored for temperature). */
  factor: number;
}

export interface UnitCategory {
  id: string;
  name: string;
  units: Unit[];
}

const u = (id: string, name: string, factor: number): Unit => ({ id, name, factor });

export const unitCategories: UnitCategory[] = [
  {
    id: "length",
    name: "Length",
    units: [u("mm", "Millimetre", 0.001), u("cm", "Centimetre", 0.01), u("m", "Metre", 1), u("km", "Kilometre", 1000), u("in", "Inch", 0.0254), u("ft", "Foot", 0.3048), u("yd", "Yard", 0.9144), u("mi", "Mile", 1609.344), u("nmi", "Nautical mile", 1852)],
  },
  {
    id: "mass",
    name: "Weight",
    units: [u("mg", "Milligram", 1e-6), u("g", "Gram", 0.001), u("kg", "Kilogram", 1), u("t", "Tonne", 1000), u("oz", "Ounce", 0.028349523125), u("lb", "Pound", 0.45359237), u("st", "Stone", 6.35029318)],
  },
  {
    id: "temperature",
    name: "Temperature",
    units: [u("c", "Celsius", 1), u("f", "Fahrenheit", 1), u("k", "Kelvin", 1)],
  },
  {
    id: "volume",
    name: "Volume",
    units: [u("ml", "Millilitre", 0.001), u("l", "Litre", 1), u("m3", "Cubic metre", 1000), u("tsp", "Teaspoon (US)", 0.00492892159375), u("tbsp", "Tablespoon (US)", 0.01478676478125), u("floz", "Fluid ounce (US)", 0.0295735295625), u("cup", "Cup (US)", 0.2365882365), u("pt", "Pint (US)", 0.473176473), u("gal", "Gallon (US)", 3.785411784), u("ukgal", "Gallon (UK)", 4.54609)],
  },
  {
    id: "area",
    name: "Area",
    units: [u("cm2", "Square centimetre", 1e-4), u("m2", "Square metre", 1), u("ha", "Hectare", 10_000), u("km2", "Square kilometre", 1e6), u("ft2", "Square foot", 0.09290304), u("ac", "Acre", 4046.8564224), u("mi2", "Square mile", 2_589_988.110336)],
  },
  {
    id: "speed",
    name: "Speed",
    units: [u("mps", "Metres per second", 1), u("kmh", "Kilometres per hour", 1 / 3.6), u("mph", "Miles per hour", 0.44704), u("kn", "Knot", 1852 / 3600), u("fps", "Feet per second", 0.3048)],
  },
  {
    id: "data",
    name: "Data storage",
    units: [u("b", "Byte", 1), u("kb", "Kilobyte (kB)", 1e3), u("mb", "Megabyte (MB)", 1e6), u("gb", "Gigabyte (GB)", 1e9), u("tb", "Terabyte (TB)", 1e12), u("kib", "Kibibyte (KiB)", 1024), u("mib", "Mebibyte (MiB)", 1024 ** 2), u("gib", "Gibibyte (GiB)", 1024 ** 3), u("tib", "Tebibyte (TiB)", 1024 ** 4)],
  },
];

function toKelvin(v: number, from: string) {
  if (from === "c") return v + 273.15;
  if (from === "f") return ((v - 32) * 5) / 9 + 273.15;
  return v;
}
function fromKelvin(k: number, to: string) {
  if (to === "c") return k - 273.15;
  if (to === "f") return ((k - 273.15) * 9) / 5 + 32;
  return k;
}

export function convertUnit(categoryId: string, value: number, from: string, to: string): number {
  if (categoryId === "temperature") return fromKelvin(toKelvin(value, from), to);
  const cat = unitCategories.find((c) => c.id === categoryId);
  const f = cat?.units.find((x) => x.id === from);
  const t = cat?.units.find((x) => x.id === to);
  if (!f || !t) return NaN;
  return (value * f.factor) / t.factor;
}

/** Human-friendly number: up to 10 significant digits, no float noise. */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e15 || abs < 1e-6) return v.toExponential(6).replace(/\.?0+e/, "e");
  return parseFloat(v.toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 10 });
}
