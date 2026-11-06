import type { Category } from "./types";

export const categories: Category[] = [
  {
    id: "social",
    slug: "social-media-downloaders",
    name: "Social media downloaders",
    description: "Save public videos, Reels, Shorts and images from one link.",
    icon: "Download",
  },
  {
    id: "qr",
    slug: "qr-code-tools",
    name: "QR codes",
    description: "Create QR codes for links, Wi-Fi networks and contact cards.",
    icon: "QrCode",
  },
  {
    id: "image",
    slug: "image-tools",
    name: "Image tools",
    description: "Compress, resize and convert images privately in your browser.",
    icon: "Image",
  },
  {
    id: "pdf",
    slug: "pdf-tools",
    name: "PDF tools",
    description: "Merge, split, compress, rotate and convert PDFs without uploading them.",
    icon: "FileText",
  },
  {
    id: "seo",
    slug: "seo-tools",
    name: "SEO tools",
    description: "Meta tags, robots.txt, slugs and search snippet previews.",
    icon: "Search",
  },
  {
    id: "developer",
    slug: "developer-tools",
    name: "Developer tools",
    description: "Format JSON, encode data, decode JWTs and test regular expressions.",
    icon: "Code",
  },
  {
    id: "text",
    slug: "text-tools",
    name: "Text tools",
    description: "Count words, change case, compare text and generate passwords.",
    icon: "Type",
  },
  {
    id: "calculators",
    slug: "calculators",
    name: "Calculators",
    description: "Percentages, age, BMI, loans, compound interest and units.",
    icon: "Calculator",
  },
];
