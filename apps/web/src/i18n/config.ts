/**
 * Locales intended to be live. A locale listed here MUST have a complete, valid catalogue: the build
 * and CI fail otherwise (production safeguard). A locale not listed is never built, however complete.
 * Being listed does not make a locale indexable: that needs human review (see status/<locale>.json).
 */
export const PUBLISHED_LOCALES: string[] = [
  "en", "es", "pt-BR", "fr", "de", "hi", "id", "ar", "zh-CN", "ja",
  "ru", "bn", "ur", "tr", "vi", "ko", "it", "nl", "th", "sw",
];

/** Words that legitimately stay identical to English in a translation (brands, formats, acronyms). */
export const GLOSSARY = [
  "YoniXTools", "TikTok", "Instagram", "Facebook", "Pinterest", "LinkedIn", "Dailymotion", "Twitch", "Kick", "SoundCloud", "Mixcloud",
  "Bluesky", "Streamable", "Medal", "9GAG", "YouTube", "Vimeo", "Reddit", "Twitter", "Google", "Bing", "Android", "iPhone", "iPad", "iOS", "Safari",
  "Chrome", "Edge", "Firefox", "Wi-Fi", "WiFi", "vCard", "QR", "PDF", "PDFs", "JPG", "JPEG", "PNG", "WebP", "GIF", "SVG", "BMP", "MP4", "MP3", "WAV", "WebM",
  "ZIP", "JSON", "XML", "HTML", "CSS", "JavaScript", "JS", "URL", "URLs", "UUID", "JWT", "Base64", "SHA-1", "SHA-256", "SHA-384", "SHA-512", "MD5", "HEX", "RGB",
  "HSL", "CMYK", "UTC", "GMT", "Unix", "BMI", "SEO", "SERP", "robots.txt", "Open Graph", "Schema.org", "JSON-LD", "Lorem", "ipsum", "regex", "RegExp", "API",
  "DRM", "ID", "OK", "kbps", "Hz", "fps", "KB", "MB", "GB", "px", "DPI", "ISO", "IANA", "Reels", "Shorts", "Stories",
];
