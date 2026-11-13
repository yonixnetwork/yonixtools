/**
 * Editorial guides: genuinely useful how-to articles that link to the tools they describe.
 * Everything stated here must match what the tools actually do (see the tool registry).
 *
 * Text may contain [link text](/path/) for internal links; nothing else is interpreted.
 * Dates are real: `published` when the guide first went live, `updated` when its content last
 * changed (also the sitemap's lastmod). A guide with `reviewBy` is year-specific and must be
 * re-checked by that date (tests/unit/guides.test.ts fails afterwards, as a reminder).
 */
export interface GuideSection {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  /** <title>, max ~60 characters. */
  title: string;
  h1: string;
  /** Meta description, 70–160 characters. */
  description: string;
  published: string;
  updated: string;
  /** Year-specific guides only: the date by which it must be reviewed and updated. */
  reviewBy?: string;
  /** Tools this guide is about (shown as "Tools in this guide" and linked back from their pages). */
  tools: string[];
  intro: string;
  sections: GuideSection[];
}

const PERMISSION =
  "Only save content you own or have permission to use, and respect copyright and each platform's terms. Saving a video doesn't give you the right to re-upload someone else's work.";

export const guides: Guide[] = [
  {
    slug: "how-to-merge-pdf-files",
    title: "How to Merge PDF Files Online for Free (No Upload)",
    h1: "How to merge PDF files online, free and without uploading",
    description: "Combine several PDFs into one document in your browser: choose the files, set the order and download. Plus how to split, compress and rotate PDFs.",
    published: "2026-11-13",
    updated: "2026-11-13",
    tools: ["pdf-merger", "pdf-splitter", "pdf-compressor", "rotate-pdf", "image-to-pdf", "pdf-to-image"],
    intro:
      "Merging PDFs is one of the most common document chores: a contract and its annex, scanned receipts for an expense claim, or chapters exported separately. You can do it in a browser in under a minute, and with the right tool your files never leave your computer.",
    sections: [
      {
        heading: "Merge PDFs step by step",
        steps: [
          "Open the [PDF Merger](/pdf-merger/) and choose two or more PDF files (or drop them onto the box).",
          "Put them in the order you want the pages to appear: drag the files, or use the arrows.",
          "Click Merge and download the combined PDF.",
        ],
        paragraphs: [
          "The pages are copied as they are, without re-compressing them, so text stays selectable and images keep their quality. There is no watermark and no sign-up.",
        ],
      },
      {
        heading: "Are my documents uploaded?",
        paragraphs: [
          "No. The PDF Merger runs entirely in your browser using open-source PDF libraries, so the files are read and combined on your own device. That matters for contracts, invoices, medical letters and anything else you'd rather not send to a stranger's server.",
        ],
      },
      {
        heading: "Common problems",
        bullets: [
          "Password-protected PDFs can't be merged directly. Open them in a PDF reader, remove the password, then merge.",
          "Pages in the wrong order: reorder the files before you click Merge. To reorder or drop individual pages, split the file first with the [PDF Splitter](/pdf-splitter/).",
          "Sideways scans: fix the page orientation with [Rotate PDF](/rotate-pdf/) before or after merging.",
        ],
      },
      {
        heading: "Other everyday PDF tasks",
        bullets: [
          "Pull out pages or split a long PDF: [PDF Splitter](/pdf-splitter/) takes ranges like 1-3, 5, 8- or one file per page.",
          "Make a PDF smaller for email: [PDF Compressor](/pdf-compressor/) has a lossless mode that keeps text selectable, and a strong mode for scans that turns pages into images.",
          "Turn photos or scans into a PDF: [Image to PDF](/image-to-pdf/) combines JPG, PNG and WebP images into one document.",
          "Turn PDF pages into images: [PDF to Image](/pdf-to-image/) renders each page as a picture.",
        ],
      },
    ],
  },
  {
    slug: "how-to-compress-images",
    title: "How to Compress Images Online Without Losing Quality",
    h1: "How to compress images online without visibly losing quality",
    description: "Make photos smaller for email, websites and upload forms: pick the right format and quality, then resize or convert if needed. All in your browser.",
    published: "2026-11-13",
    updated: "2026-11-13",
    tools: ["image-compressor", "image-resizer", "image-converter", "image-cropper"],
    intro:
      "Upload forms reject large photos, emails bounce, and heavy images slow web pages down. Shrinking an image is usually a matter of two choices: the format, and how much quality you're willing to trade for size. Here is how to get a much smaller file that looks the same.",
    sections: [
      {
        heading: "Compress an image step by step",
        steps: [
          "Open the [Image Compressor](/image-compressor/) and choose your image.",
          "Pick JPEG or WebP and move the quality slider. Between 70% and 85% usually cuts the size a lot with little visible difference.",
          "Compare the before and after sizes, then download the smaller image.",
        ],
        paragraphs: ["The image is processed by your browser's own image engine and is never uploaded."],
      },
      {
        heading: "Which format should I use?",
        bullets: [
          "Photos: JPEG works everywhere. WebP is often 25 to 35% smaller at the same quality, and modern browsers and most websites accept it.",
          "Screenshots, logos and images with transparency: PNG keeps sharp edges and transparency, but it is lossless, so a photo saved as PNG barely shrinks. Convert photos to JPEG or WebP instead.",
          "A site rejects WebP? Convert it to JPG with the [Image Converter](/image-converter/). Transparent areas are filled with a background colour you choose.",
        ],
      },
      {
        heading: "Resize before you compress",
        paragraphs: [
          "A 4000-pixel-wide phone photo shown at 1200 pixels wastes most of its size. Scaling it down first with the [Image Resizer](/image-resizer/), with the aspect ratio locked, often saves more than any quality setting. Resize down rather than up: enlarging can't add detail.",
          "Only need part of the picture? Cropping with the [Image Cropper](/image-cropper/) removes pixels you'd otherwise pay for, and gives you exact ratios such as 1:1 or 16:9 for social posts.",
        ],
      },
    ],
  },
  {
    slug: "how-to-save-public-social-media-videos",
    title: "How to Save Public TikTok, Instagram & Facebook Videos",
    h1: "How to save public TikTok, Instagram and Facebook videos (when you're allowed to)",
    description: "Copy the link, paste it and pick a quality: how to save public videos and photos from TikTok, Instagram, Facebook, X, Pinterest and Twitch clips.",
    published: "2026-11-13",
    updated: "2026-11-13",
    tools: ["social-media-downloader", "tiktok-downloader", "instagram-downloader", "facebook-downloader", "x-video-downloader", "pinterest-downloader", "twitch-clip-downloader"],
    intro:
      "Wanting an offline copy of your own clip, a tutorial you have permission to keep, or a photo a friend posted is common. YoniXTools saves publicly visible posts from a link. It never logs in to accounts, and it can't reach private or login-only content.",
    sections: [
      {
        heading: "Before you start: is it okay to save?",
        paragraphs: [PERMISSION, "Private accounts, Stories, protected posts and paid content are not supported, by design."],
      },
      {
        heading: "Save a video in three steps",
        steps: [
          "In the app, tap Share on the post, then Copy link.",
          "Paste the link into the [Universal Social Media Downloader](/social-media-downloader/). The platform is detected from the link.",
          "Preview the post, choose a quality or item, and download it.",
        ],
        paragraphs: ["The page shows the preparation progress while the file is made ready, and the download starts as soon as it is."],
      },
      {
        heading: "Platform by platform",
        bullets: [
          "TikTok: videos and photo slideshows, short vm.tiktok.com links included, with [TikTok Downloader](/tiktok-downloader/). Formats are the ones TikTok publicly provides; videos aren't edited.",
          "Instagram: Reels, video posts, photos and every item of a carousel with [Instagram Downloader](/instagram-downloader/). Stories need a login, so they aren't supported.",
          "Facebook: public videos and Reels in SD or HD, including fb.watch links, with [Facebook Video Downloader](/facebook-downloader/).",
          "X (Twitter): videos and GIFs from public posts with [X Video Downloader](/x-video-downloader/).",
          "Pinterest: video pins and full-size images with [Pinterest Downloader](/pinterest-downloader/).",
          "Twitch: clips only (not live streams or full broadcasts) with [Twitch Clip Downloader](/twitch-clip-downloader/).",
        ],
      },
      {
        heading: "When a download fails",
        bullets: [
          "The post may be private or deleted. The error message names the platform and the reason.",
          "Some platforms limit requests for a while. Trying again a few minutes later usually works.",
          "YouTube, Vimeo and Reddit aren't available at the moment, so links from them are refused with the reason.",
        ],
      },
    ],
  },
  {
    slug: "free-online-video-tools",
    title: "Free Online Video Tools: Frames, Audio & File Info",
    h1: "Free video tools that work in your browser",
    description: "Save a still frame as an image, extract the audio track as WAV, or check a video's resolution and bitrate, without uploading the video anywhere.",
    published: "2026-11-13",
    updated: "2026-11-13",
    tools: ["video-frame-extractor", "video-audio-extractor", "video-info"],
    intro:
      "Many small video jobs don't need an editor: grabbing a thumbnail, pulling out the soundtrack, or checking whether a file meets an upload limit. These three tools handle them in the browser, so even large personal videos stay on your device.",
    sections: [
      {
        heading: "Save a frame as a picture",
        paragraphs: [
          "Open the [Video Frame Extractor](/video-frame-extractor/), choose a video, move to the exact moment and save it as a full-resolution PNG or JPG. Good for thumbnails, slides and bug reports.",
        ],
      },
      {
        heading: "Extract the audio from a video",
        paragraphs: [
          "[Extract Audio from Video](/video-audio-extractor/) takes the soundtrack out of an MP4, WebM or MOV file and saves it as a lossless WAV file. It's decoded in your browser, so the video is never uploaded.",
        ],
      },
      {
        heading: "Check a video's resolution, duration and bitrate",
        paragraphs: [
          "Before uploading somewhere with limits, open the [Video Info Viewer](/video-info/) to see the duration, resolution, aspect ratio, file size and average bitrate at once.",
        ],
      },
    ],
  },
  {
    slug: "free-online-tools-2027",
    title: "Free Online Tools to Bookmark for 2027",
    h1: "Free online tools to bookmark for 2027",
    description: "A short, practical list of free browser tools for PDFs, images, QR codes, text, developers and video, reviewed for 2027. No sign-up and no watermarks.",
    published: "2026-11-13",
    updated: "2026-11-13",
    reviewBy: "2027-06-30",
    tools: ["pdf-merger", "image-compressor", "qr-code-generator", "word-counter", "json-formatter", "video-frame-extractor", "social-media-downloader"],
    intro:
      "A handful of reliable tools covers most everyday computer chores. This list sticks to the YoniXTools tools we use most, what each one is good for and its limits, so you can bookmark what you need for the year ahead. It is reviewed during the year and updated when tools change.",
    sections: [
      {
        heading: "Documents",
        bullets: [
          "[PDF Merger](/pdf-merger/): combine PDFs in the order you choose, in your browser. Our [guide to merging PDFs](/guides/how-to-merge-pdf-files/) covers splitting, compressing and rotating too.",
          "[Word & Character Counter](/word-counter/): live word and character counts with reading time, for essays, posts and meta descriptions.",
        ],
      },
      {
        heading: "Images",
        bullets: [
          "[Image Compressor](/image-compressor/): shrink JPEG and WebP photos with a before-and-after size comparison. See [how to compress images](/guides/how-to-compress-images/).",
          "[QR Code Generator](/qr-code-generator/): static QR codes for links and text that never expire, as PNG or SVG.",
        ],
      },
      {
        heading: "Developers",
        bullets: ["[JSON Formatter & Validator](/json-formatter/): format, minify and validate JSON with the exact line and column of any error."],
      },
      {
        heading: "Video and social media",
        bullets: [
          "[Video Frame Extractor](/video-frame-extractor/): save a still frame as PNG or JPG. More in [free video tools](/guides/free-online-video-tools/).",
          "[Universal Social Media Downloader](/social-media-downloader/): save public posts from supported platforms when you're allowed to. See [how to save public videos](/guides/how-to-save-public-social-media-videos/).",
        ],
      },
      {
        heading: "Why browser tools?",
        paragraphs: [
          "Most of these run entirely on your device: files aren't uploaded, there's no account to create and no watermark. The downloaders are the exception: they need the server to fetch the public post, and the temporary files are deleted afterwards.",
        ],
      },
    ],
  },
];

export const getGuide = (slug: string) => guides.find((g) => g.slug === slug);
export const guidesForTool = (slug: string) => guides.filter((g) => g.tools.includes(slug));
export const guidePath = (slug: string) => `/guides/${slug}/`;
