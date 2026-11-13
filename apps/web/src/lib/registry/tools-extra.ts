import type { Tool } from "./types";

const ADDED = "2026-11-06";
const privatePdf = { q: "Are my PDFs uploaded?", a: "No. Everything happens in your browser using open-source PDF libraries, so your documents never leave your device." };

export const extraTools: Tool[] = [
  // ─────────────────────────── PDF ───────────────────────────
  {
    slug: "pdf-merger", name: "PDF Merger", tagline: "Combine several PDFs into one, in the order you choose.", category: "pdf", status: "live", runsIn: "browser", icon: "Merge",
    keywords: ["pdf merger", "merge pdf", "combine pdf", "join pdf files", "merge pdf online"], synonyms: ["pdf combiner", "pdf joiner", "put pdfs together"],
    related: ["pdf-splitter", "pdf-compressor", "image-to-pdf"], addedAt: ADDED,
    seo: { title: "PDF Merger – Combine PDF Files Online, Free & Private", description: "Merge multiple PDF files into one document in your browser. Drag to reorder, no upload, no watermark, no sign-up." },
    content: {
      intro: "Combine PDFs into a single file. Put the files in the order you want, and the merged document keeps every page exactly as it was.",
      steps: ["Choose two or more PDF files.", "Drag them, or use the arrows, to set the order.", "Click Merge and download the combined PDF."],
      features: ["Reorder files before merging", "Pages copied without re-compression", "No upload, no watermark"],
      faqs: [privatePdf, { q: "Can I merge password-protected PDFs?", a: "Not directly. Remove the password in a PDF reader first, then merge." }],
    },
  },
  {
    slug: "pdf-splitter", name: "PDF Splitter", tagline: "Split a PDF into single pages or custom page ranges.", category: "pdf", status: "live", runsIn: "browser", icon: "Scissors",
    keywords: ["pdf splitter", "split pdf", "extract pdf pages", "separate pdf pages", "split pdf online"], synonyms: ["pdf cutter", "divide pdf", "pdf page extractor"],
    related: ["pdf-merger", "rotate-pdf", "pdf-to-image"], addedAt: ADDED,
    seo: { title: "PDF Splitter – Split PDF Pages or Ranges Online", description: "Split a PDF into separate pages or custom ranges like 1-3, 5, 8-10. Works in your browser with no upload. Download the parts as PDFs or a ZIP." },
    content: {
      intro: "Pull out the pages you need or break a long PDF into parts. Use ranges like 1-3, 5, 8-, or split every page into its own file.",
      steps: ["Choose a PDF.", "Pick 'Every page' or type page ranges.", "Download each part or everything as a ZIP."],
      features: ["Custom ranges such as 1-3, 5, 8-", "One file per page option", "Download all as ZIP"],
      faqs: [privatePdf, { q: "What does “8-” mean?", a: "From page 8 to the last page. Likewise, “-3” means pages 1 to 3." }],
    },
  },
  {
    slug: "pdf-compressor", name: "PDF Compressor", tagline: "Reduce PDF file size, losslessly or by converting pages to images.", category: "pdf", status: "live", runsIn: "browser", icon: "FileArchive",
    keywords: ["pdf compressor", "compress pdf", "reduce pdf size", "make pdf smaller", "shrink pdf"], synonyms: ["pdf optimizer", "pdf size reducer", "compress pdf online"],
    related: ["pdf-merger", "image-compressor", "pdf-to-image"], addedAt: ADDED,
    seo: { title: "PDF Compressor – Reduce PDF File Size in Your Browser", description: "Make PDFs smaller without uploading them. Choose lossless optimisation that keeps the text, or strong compression for scans and image-heavy files." },
    content: {
      intro: "Two honest options. Lossless optimisation restructures the file and keeps text selectable. Strong compression re-renders each page as a JPEG image: it's much smaller for scanned documents, but the text stops being selectable.",
      steps: ["Choose a PDF.", "Pick lossless or strong compression (and a quality for strong).", "Compare the sizes and download."],
      features: ["Lossless mode keeps text and links", "Strong mode for scans and photos", "Before and after size comparison"],
      faqs: [privatePdf,
        { q: "Why is my PDF barely smaller in lossless mode?", a: "Most of the size is usually in embedded images or fonts, which lossless mode doesn't re-encode. Use strong mode for scanned or image-heavy PDFs." },
        { q: "Will text still be searchable after strong compression?", a: "No. Strong mode turns each page into an image. Keep the original if you need selectable or searchable text." }],
    },
  },
  {
    slug: "pdf-to-image", name: "PDF to Image", tagline: "Convert PDF pages to JPG or PNG images.", category: "pdf", status: "live", runsIn: "browser", icon: "FileImage",
    keywords: ["pdf to jpg", "pdf to png", "pdf to image", "convert pdf to image", "pdf page to picture"], synonyms: ["pdf converter", "pdf to picture", "export pdf pages"],
    related: ["image-to-pdf", "pdf-splitter", "image-compressor"], addedAt: ADDED,
    seo: { title: "PDF to JPG & PNG – Convert PDF Pages to Images Free", description: "Turn every page of a PDF into a high-resolution JPG or PNG image in your browser. Choose the resolution and download pages singly or as a ZIP." },
    content: {
      intro: "Render each PDF page as an image, at screen or print resolution, using Mozilla's open-source pdf.js engine.",
      steps: ["Choose a PDF.", "Select JPG or PNG and the resolution.", "Download single pages or all pages as a ZIP."],
      features: ["JPG or PNG output", "Resolution from 72 to 300 DPI", "Download all as ZIP"],
      faqs: [privatePdf, { q: "Which resolution should I choose?", a: "150 DPI suits screens and sharing. Use 300 DPI for printing, at the cost of much larger files." }],
    },
  },
  {
    slug: "image-to-pdf", name: "Image to PDF", tagline: "Turn JPG and PNG images into a single PDF.", category: "pdf", status: "live", runsIn: "browser", icon: "FilePlus",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf", "photos to pdf", "convert image to pdf"], synonyms: ["picture to pdf", "scan to pdf", "images into pdf"],
    related: ["pdf-merger", "pdf-to-image", "image-compressor"], addedAt: ADDED,
    seo: { title: "Image to PDF – Convert JPG & PNG to PDF Online Free", description: "Combine JPG, PNG and WebP images into one PDF in your browser. Reorder pages, choose A4, Letter or original size, and add margins. No upload." },
    content: {
      intro: "Put photos, scans or screenshots into one PDF, one image per page, in any order.",
      steps: ["Choose your images.", "Reorder them and pick the page size and margin.", "Create and download the PDF."],
      features: ["JPG, PNG and WebP input", "A4, Letter or original image size", "Automatic portrait or landscape pages"],
      faqs: [{ q: "Are my images uploaded?", a: "No. The PDF is built in your browser." }, { q: "Is image quality reduced?", a: "JPEG and PNG images are embedded as they are. WebP images are converted to PNG first, because PDF has no WebP support." }],
    },
  },
  {
    slug: "rotate-pdf", name: "Rotate PDF", tagline: "Rotate all or selected PDF pages by 90°, 180° or 270°.", category: "pdf", status: "live", runsIn: "browser", icon: "RotateCw",
    keywords: ["rotate pdf", "rotate pdf pages", "turn pdf page", "fix pdf orientation"], synonyms: ["pdf rotator", "flip pdf", "pdf page rotation"],
    related: ["pdf-splitter", "pdf-merger", "pdf-compressor"], addedAt: ADDED,
    seo: { title: "Rotate PDF – Rotate PDF Pages Permanently Online", description: "Rotate every page or just selected pages of a PDF by 90, 180 or 270 degrees, and save the result. Free, in your browser, with no upload." },
    content: {
      intro: "Fix sideways or upside-down scans. Rotate the whole document or only the pages you list.",
      steps: ["Choose a PDF.", "Pick the angle and which pages to rotate.", "Download the rotated PDF."],
      features: ["90°, 180° and 270°", "All pages or a page list such as 1, 3-4", "Lossless: the page content is not re-encoded"],
      faqs: [privatePdf],
    },
  },

  // ─────────────────────────── Image / QR ───────────────────────────
  {
    slug: "image-cropper", name: "Image Cropper", tagline: "Crop images freely or to 1:1, 4:3, 16:9 and other ratios.", category: "image", status: "live", runsIn: "browser", icon: "Crop",
    keywords: ["image cropper", "crop image", "crop photo online", "crop picture", "square crop"], synonyms: ["photo cropper", "cut image", "trim image"],
    related: ["image-resizer", "image-compressor", "image-converter"], addedAt: ADDED,
    seo: { title: "Image Cropper – Crop Photos to Any Size or Ratio", description: "Crop JPG, PNG and WebP images in your browser. Drag the crop box or type exact pixels, use 1:1, 4:5, 16:9 or free ratios, then download." },
    content: {
      intro: "Drag the crop box, or enter exact pixel values, to cut an image to the size you need, such as a square profile picture or a 16:9 thumbnail.",
      steps: ["Choose an image.", "Pick a ratio, then drag or resize the crop box.", "Download the cropped image."],
      features: ["Free, 1:1, 4:5, 4:3, 3:2 and 16:9 ratios", "Exact pixel inputs", "Keeps the original resolution"],
      faqs: [{ q: "Does cropping reduce quality?", a: "Cropping keeps the original pixels. PNG output is lossless; JPG output uses high quality." }],
    },
  },
  {
    slug: "qr-code-scanner", name: "QR Code Scanner", tagline: "Read QR codes from your camera or an image.", category: "qr", status: "live", runsIn: "browser", icon: "ScanLine",
    keywords: ["qr code scanner", "scan qr code", "qr reader", "read qr code from image", "qr code reader online"], synonyms: ["qr decoder", "scan qr online", "qr scanner camera"],
    related: ["qr-code-generator", "wifi-qr-code-generator", "url-encoder-decoder"], addedAt: ADDED,
    seo: { title: "QR Code Scanner – Scan QR Codes from Camera or Image", description: "Scan a QR code with your webcam or phone camera, or upload a screenshot. Decoded on your device. Links are shown before you open them." },
    content: {
      intro: "Point your camera at a QR code or upload an image of one. Decoding happens on your device, and links are shown to you rather than opened automatically.",
      steps: ["Choose Camera and allow access, or upload an image.", "Hold the code steady in the frame.", "Copy the result or open the link."],
      features: ["Camera and image upload", "Links shown before opening", "Wi-Fi and contact codes displayed as text"],
      faqs: [
        { q: "Is the camera feed sent anywhere?", a: "No. Frames are analysed in your browser and nothing is uploaded or recorded." },
        { q: "Why doesn't the camera start?", a: "Camera access needs HTTPS and your permission. If you blocked it, re-enable camera access for this site in your browser settings, or upload an image instead." },
      ],
    },
  },

  // ─────────────────────────── Developer ───────────────────────────
  {
    slug: "html-minifier", name: "HTML Minifier", tagline: "Minify HTML, including inline CSS and JavaScript.", category: "developer", status: "live", runsIn: "browser", icon: "FileCode",
    keywords: ["html minifier", "minify html", "compress html", "html compressor"], synonyms: ["html optimizer", "remove html whitespace"],
    related: ["css-minifier", "javascript-minifier", "json-formatter"], addedAt: ADDED,
    seo: { title: "HTML Minifier – Minify HTML Online (Inline CSS & JS)", description: "Shrink HTML by removing comments and whitespace and minifying inline CSS and JavaScript, using html-minifier-terser. See the size saved." },
    content: {
      intro: "Make HTML smaller for faster pages. Whitespace is collapsed conservatively, so your layout won't change.",
      steps: ["Paste your HTML.", "Choose whether to keep comments.", "Copy or download the minified result."],
      features: ["Inline CSS and JS minified too", "Conservative whitespace collapsing", "Size savings shown"],
      faqs: [{ q: "Can minification break my page?", a: "The settings are conservative, but test the result, especially pages that rely on whitespace between inline elements." }],
    },
  },
  {
    slug: "css-minifier", name: "CSS Minifier", tagline: "Minify and optimise CSS with csso.", category: "developer", status: "live", runsIn: "browser", icon: "FileCode",
    keywords: ["css minifier", "minify css", "compress css", "css compressor"], synonyms: ["css optimizer", "css shrink"],
    related: ["html-minifier", "javascript-minifier", "url-encoder-decoder"], addedAt: ADDED,
    seo: { title: "CSS Minifier – Minify & Optimise CSS Online", description: "Minify CSS with structural optimisations such as merging rules, shortening colours and removing redundant values. Free, in your browser." },
    content: {
      intro: "Shrink stylesheets with csso. Beyond removing whitespace, it merges rules and shortens values safely.",
      steps: ["Paste your CSS.", "Choose whether to keep /*! important comments.", "Copy or download the result."],
      features: ["Structural optimisation", "Keeps licence comments if you want", "Size savings shown"],
      faqs: [{ q: "Will it change how my site looks?", a: "csso only applies optimisations that keep the same rendering." }],
    },
  },
  {
    slug: "javascript-minifier", name: "JavaScript Minifier", tagline: "Minify and mangle JavaScript with Terser.", category: "developer", status: "live", runsIn: "browser", icon: "FileCode",
    keywords: ["javascript minifier", "minify js", "js minifier", "compress javascript", "uglify js"], synonyms: ["js compressor", "terser online", "uglify"],
    related: ["css-minifier", "html-minifier", "json-formatter"], addedAt: ADDED,
    seo: { title: "JavaScript Minifier – Minify JS Online with Terser", description: "Minify modern JavaScript (ES2015+) with Terser. Compress, mangle variable names and remove comments, and see syntax errors with their location." },
    content: {
      intro: "Compress JavaScript with Terser, the minifier behind most modern build tools. Modern syntax is supported.",
      steps: ["Paste your JavaScript.", "Choose whether to mangle names and keep comments.", "Copy or download the result."],
      features: ["ES2015+ support", "Name mangling", "Syntax errors with line and column"],
      faqs: [{ q: "Is mangling safe?", a: "Yes for normal code. Disable it if other scripts access your functions by name through strings." }],
    },
  },

  // ─────────────────────────── SEO ───────────────────────────
  {
    slug: "sitemap-generator", name: "XML Sitemap Generator", tagline: "Turn a list of URLs into a valid sitemap.xml.", category: "seo", status: "live", runsIn: "browser", icon: "Network",
    keywords: ["sitemap generator", "xml sitemap generator", "create sitemap", "sitemap.xml"], synonyms: ["sitemap maker", "sitemap builder"],
    related: ["robots-txt-generator", "meta-tag-generator", "schema-markup-generator"], addedAt: ADDED,
    seo: { title: "XML Sitemap Generator – Create sitemap.xml from URLs", description: "Paste your page URLs to generate a standards-compliant XML sitemap with optional lastmod, changefreq and priority. Duplicates and invalid URLs are flagged." },
    content: {
      intro: "Paste the URLs of your pages to get a valid sitemap.xml for Google Search Console and Bing Webmaster Tools. This tool does not crawl your site, so you control exactly which pages are listed.",
      steps: ["Paste one URL per line.", "Optionally set lastmod, changefreq and priority.", "Download sitemap.xml and upload it to your site root."],
      features: ["Valid sitemaps.org XML", "Duplicates removed, invalid URLs flagged", "Up to 50,000 URLs"],
      faqs: [{ q: "Do changefreq and priority matter?", a: "Google ignores both. An accurate lastmod is the most useful optional field." }, { q: "Where do I submit it?", a: "Upload it to your site, reference it in robots.txt, and submit it in Google Search Console." }],
    },
  },
  {
    slug: "schema-markup-generator", name: "Schema Markup Generator", tagline: "Create JSON-LD structured data for rich results.", category: "seo", status: "live", runsIn: "browser", icon: "Braces",
    keywords: ["schema markup generator", "json-ld generator", "structured data generator", "schema.org generator"], synonyms: ["rich snippet generator", "faq schema generator", "local business schema"],
    related: ["meta-tag-generator", "sitemap-generator", "serp-snippet-preview"], addedAt: ADDED,
    seo: { title: "Schema Markup Generator – JSON-LD for Rich Results", description: "Generate JSON-LD structured data for Organization, LocalBusiness, Article, Product, FAQPage, Event and Person. Empty fields are left out automatically." },
    content: {
      intro: "Fill in a form to get valid schema.org JSON-LD that you can paste into your page. Fields you leave empty are omitted.",
      steps: ["Choose a schema type.", "Fill in the fields you have.", "Copy the script tag into your page and test it with Google's Rich Results Test."],
      features: ["Seven common schema types", "Empty fields left out", "Safe script-tag output"],
      faqs: [{ q: "Does schema guarantee rich results?", a: "No. It makes pages eligible. Google decides whether to show rich results, and the markup must match what's visible on the page." }],
    },
  },
  {
    slug: "open-graph-preview", name: "Open Graph Preview", tagline: "Preview how a page looks when shared on social media.", category: "seo", status: "live", runsIn: "browser", icon: "Share2",
    keywords: ["open graph preview", "og preview", "facebook share preview", "twitter card preview", "link preview"], synonyms: ["social preview", "og checker", "share card preview"],
    related: ["meta-tag-generator", "serp-snippet-preview", "schema-markup-generator"], addedAt: ADDED,
    seo: { title: "Open Graph Preview – Check Social Share Cards", description: "Paste your page's HTML or enter tags manually to preview Facebook, X and LinkedIn share cards, with warnings for missing or invalid Open Graph tags." },
    content: {
      intro: "See your link previews before you share. Paste the page's HTML source (or just its <head>) and the tags are read locally, with no fetching. Missing tags are flagged.",
      steps: ["Paste the page's HTML, or type the title, description and image.", "Review the Facebook, X and LinkedIn previews.", "Fix any warnings with the Meta Tag Generator."],
      features: ["Reads og: and twitter: tags from HTML", "Three platform previews", "Warnings for missing tags"],
      faqs: [{ q: "Why not just enter a URL?", a: "Fetching other sites from our server would expose it to abuse. Paste the HTML instead: in most browsers, press Ctrl+U (Cmd+Option+U on a Mac) to view the source." }],
    },
  },
  {
    slug: "keyword-idea-generator", name: "Keyword Idea Generator", tagline: "Expand a seed keyword into questions and long-tail ideas.", category: "seo", status: "live", runsIn: "browser", icon: "Lightbulb",
    keywords: ["keyword idea generator", "keyword generator", "long tail keyword generator", "keyword ideas", "question keywords"], synonyms: ["keyword research tool", "keyword brainstorm", "keyword suggestions"],
    related: ["seo-title-generator", "url-slug-generator", "meta-tag-generator"], addedAt: ADDED,
    seo: { title: "Keyword Idea Generator – Questions & Long-Tail Ideas", description: "Brainstorm question, modifier and long-tail variations of a seed keyword for content planning. Pattern-based ideas without search-volume data." },
    content: {
      intro: "Turn one seed keyword into dozens of variations: questions, modifiers and long-tail phrases. It's useful for brainstorming article topics and FAQs. The ideas come from common search patterns and include no search-volume data, so check the demand in a keyword tool.",
      steps: ["Enter a seed keyword.", "Browse the questions, modifiers and long-tail ideas.", "Copy the ones worth researching further."],
      features: ["Question, modifier, long-tail and preposition patterns", "Copy all ideas", "No sign-up"],
      faqs: [{ q: "Does this show search volume?", a: "No. Volume data requires a paid data source. Use these ideas as a starting list, then check them in Google Search Console or a keyword tool." }],
    },
  },
  {
    slug: "seo-title-generator", name: "SEO Title Generator", tagline: "Generate title tag ideas and check their pixel width.", category: "seo", status: "live", runsIn: "browser", icon: "Heading",
    keywords: ["seo title generator", "title tag generator", "blog title generator", "headline generator"], synonyms: ["title ideas", "page title generator"],
    related: ["serp-snippet-preview", "keyword-idea-generator", "meta-tag-generator"], addedAt: ADDED,
    seo: { title: "SEO Title Generator – Title Tag Ideas with Length Check", description: "Generate SEO title tag ideas from a keyword and see which ones fit Google's roughly 600px title width before they get truncated." },
    content: {
      intro: "Get proven title patterns for your keyword, with each title measured in pixels the way Google measures it, so you can see which ones will be cut off.",
      steps: ["Enter your main keyword and, optionally, your brand.", "Review the titles and their widths.", "Copy one and adjust it to match your page."],
      features: ["Eight common title patterns", "Pixel-width check", "Optional brand suffix"],
      faqs: [{ q: "Should titles include the year?", a: "Only when the content really is updated for that year. Otherwise, remove it." }],
    },
  },
];
