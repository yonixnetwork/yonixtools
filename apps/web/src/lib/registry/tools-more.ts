import type { Tool } from "./types";

const ADDED = "2026-11-07";
const onDevice = { q: "Is my file uploaded?", a: "No. Your browser reads the video directly. Nothing is sent to a server, so it works with private files and even offline once the page has loaded." };

export const moreTools: Tool[] = [
  // ─────────────────────────── Video ───────────────────────────
  {
    slug: "video-frame-extractor", name: "Video Frame Extractor", tagline: "Save any frame of a video as a full-resolution PNG or JPG.", category: "video", status: "live", runsIn: "browser", icon: "Camera",
    keywords: ["video frame extractor", "video to image", "screenshot from video", "extract frame from video", "video still"], synonyms: ["frame grabber", "video snapshot", "capture video frame"],
    related: ["video-audio-extractor", "video-info", "image-compressor"], addedAt: ADDED,
    seo: { title: "Video Frame Extractor – Save a Video Frame as PNG or JPG", description: "Pick the exact moment in a video and save that frame as a full-resolution PNG or JPG image. Works in your browser with no upload and no watermark." },
    content: {
      intro: "Scrub to the exact moment you want and save it as an image at the video's full resolution, not a blurry screen capture.",
      steps: ["Choose a video file.", "Play or drag the slider to the frame you want.", "Pick PNG or JPG and click Save this frame."],
      features: ["Full native resolution", "Lossless PNG or smaller JPG", "Frame-accurate slider", "Save as many frames as you like"],
      faqs: [onDevice, { q: "Which video formats work?", a: "Whatever your browser can play: MP4 (H.264), WebM and, in most browsers, MOV. Some phone formats such as HEVC only play in Safari." }],
    },
  },
  {
    slug: "video-audio-extractor", name: "Extract Audio from Video", tagline: "Pull the soundtrack out of a video and save it as WAV.", category: "video", status: "live", runsIn: "browser", icon: "Music",
    keywords: ["extract audio from video", "video to audio", "video to wav", "get sound from video", "audio extractor"], synonyms: ["video to sound", "rip audio", "separate audio from video"],
    related: ["video-frame-extractor", "video-info", "social-media-downloader"], addedAt: ADDED,
    seo: { title: "Extract Audio from Video – Video to WAV, Free & Private", description: "Take the audio track out of an MP4, WebM or MOV video and save it as a lossless WAV file. Decoded in your browser, so the video is never uploaded." },
    content: {
      intro: "Get the sound from a video as an uncompressed WAV file you can edit in any audio app. Decoding happens on your device using the browser's audio engine.",
      steps: ["Choose a video file.", "Click Extract audio.", "Download the WAV file."],
      features: ["Lossless 16-bit WAV output", "Keeps the original sample rate", "Stereo or mono, as in the source"],
      faqs: [onDevice,
        { q: "Why WAV and not MP3?", a: "WAV keeps the audio exactly as decoded and works everywhere. MP3 encoding would need a large extra library in your browser. If you need a smaller file, convert the WAV in any audio app." },
        { q: "Is there a size limit?", a: "Files up to 500 MB and 3 hours. Decoded audio uses a lot of memory, so very long videos may fail on phones." }],
    },
  },
  {
    slug: "video-info", name: "Video Info Viewer", tagline: "See a video's duration, resolution, aspect ratio and bitrate.", category: "video", status: "live", runsIn: "browser", icon: "FileVideo",
    keywords: ["video info", "video resolution checker", "video duration", "video metadata viewer", "video bitrate"], synonyms: ["video properties", "check video size", "video details"],
    related: ["video-frame-extractor", "video-audio-extractor", "image-resizer"], addedAt: ADDED,
    seo: { title: "Video Info Viewer – Check Resolution, Duration & Bitrate", description: "Check a video file's duration, resolution, aspect ratio, size and average bitrate instantly. Runs in your browser, so the video never leaves your device." },
    content: {
      intro: "Find out what's inside a video file before you upload or share it: how long it is, its resolution and aspect ratio, and its average bitrate.",
      steps: ["Choose a video file.", "Wait a moment while your browser reads it.", "Read the details and preview the video."],
      features: ["Duration to the millisecond", "Resolution and aspect ratio", "File size and average bitrate"],
      faqs: [onDevice, { q: "Why is the bitrate an average?", a: "It's the file size divided by the duration, so it includes audio. Codecs vary the bitrate from scene to scene." }],
    },
  },
  // ─────────────────────────── Converters ───────────────────────────
  {
    slug: "color-converter", name: "Color Converter", tagline: "Convert colours between HEX, RGB and HSL, with contrast ratios.", category: "converters", status: "live", runsIn: "browser", icon: "Palette",
    keywords: ["color converter", "hex to rgb", "rgb to hex", "hex to hsl", "color code converter"], synonyms: ["colour converter", "colour picker", "css color converter"],
    related: ["unit-converter", "css-minifier", "number-base-converter"], addedAt: ADDED,
    seo: { title: "Color Converter – HEX to RGB, RGB to HEX & HSL", description: "Convert any colour between HEX, RGB and HSL, with alpha. Includes a colour picker and WCAG contrast ratios against white and black text." },
    content: {
      intro: "Paste a colour in any common CSS notation and get the others instantly, plus a quick check of how readable text would be on it.",
      steps: ["Type or paste a colour, or use the picker.", "Read the HEX, RGB and HSL values.", "Copy the one you need."],
      features: ["HEX, RGB and HSL, with alpha", "Colour picker", "WCAG contrast against white and black"],
      faqs: [{ q: "What does the contrast ratio mean?", a: "It measures how readable text is on the colour. WCAG AA requires at least 4.5:1 for normal text and 3:1 for large text." }],
    },
  },
  {
    slug: "timestamp-converter", name: "Unix Timestamp Converter", tagline: "Convert Unix timestamps to dates and dates to timestamps.", category: "converters", status: "live", runsIn: "browser", icon: "Clock",
    keywords: ["unix timestamp converter", "epoch converter", "timestamp to date", "date to timestamp", "unix time"], synonyms: ["epoch time converter", "posix time", "milliseconds to date"],
    related: ["time-zone-converter", "age-calculator", "number-base-converter"], addedAt: ADDED,
    seo: { title: "Unix Timestamp Converter – Epoch to Date and Back", description: "Convert Unix timestamps in seconds or milliseconds to readable dates in UTC and your time zone, or turn any date into a timestamp. Shows the current Unix time." },
    content: {
      intro: "Paste a timestamp or a date. Seconds and milliseconds are told apart automatically, and you get UTC, ISO 8601, your local time and a relative description.",
      steps: ["Paste a timestamp or type a date.", "Check whether it was read as seconds or milliseconds.", "Copy the format you need."],
      features: ["Seconds or milliseconds detected automatically", "ISO 8601, UTC and local time", "Live current Unix time"],
      faqs: [{ q: "What is a Unix timestamp?", a: "The number of seconds since 1 January 1970 at 00:00 UTC. Many systems, including JavaScript, use milliseconds instead." }],
    },
  },
  {
    slug: "number-base-converter", name: "Number Base Converter", tagline: "Convert numbers between binary, octal, decimal, hex and any base.", category: "converters", status: "live", runsIn: "browser", icon: "Binary",
    keywords: ["number base converter", "binary to decimal", "decimal to hex", "hex to binary", "base converter"], synonyms: ["radix converter", "binary converter", "hexadecimal converter"],
    related: ["color-converter", "base64-encoder-decoder", "timestamp-converter"], addedAt: ADDED,
    seo: { title: "Number Base Converter – Binary, Octal, Decimal & Hex", description: "Convert whole numbers of any size between binary, octal, decimal, hexadecimal and any base from 2 to 36. Accepts 0x and 0b prefixes and negative numbers." },
    content: {
      intro: "Enter a number in one base and see it in all the common ones at once. Very large numbers are converted exactly, without rounding.",
      steps: ["Choose the base of your number.", "Type the number.", "Copy the result in the base you need."],
      features: ["Binary, octal, decimal and hex at once", "Any base from 2 to 36", "Exact for numbers of any size"],
      faqs: [{ q: "Does it handle fractions?", a: "No, only whole numbers (including negative ones). Fractions often can't be written exactly in another base." }],
    },
  },
  {
    slug: "time-zone-converter", name: "Time Zone Converter", tagline: "See what time it is in other cities for any date and time.", category: "converters", status: "live", runsIn: "browser", icon: "Globe",
    keywords: ["time zone converter", "time converter", "world clock", "convert time zones", "meeting time planner"], synonyms: ["timezone converter", "time difference calculator", "world time"],
    related: ["timestamp-converter", "age-calculator", "unit-converter"], addedAt: ADDED,
    seo: { title: "Time Zone Converter – Convert Times Between Cities", description: "Convert a date and time from one time zone to several others at once, with daylight saving time handled automatically. Ideal for planning calls across countries." },
    content: {
      intro: "Choose a date, a time and its time zone, and see the matching local time anywhere in the world. Daylight saving changes are applied for the exact date you pick.",
      steps: ["Set the date and time.", "Choose the time zone it's in.", "Add the cities you want to compare."],
      features: ["Every IANA time zone", "Daylight saving handled per date", "Compare several zones at once"],
      faqs: [{ q: "Where does the time zone data come from?", a: "From your browser's built-in time zone database, which is updated with your browser and operating system." }],
    },
  },
  // ─────────────────────────── Other utilities ───────────────────────────
  {
    slug: "random-number-generator", name: "Random Number Generator", tagline: "Pick random numbers in any range, with or without repeats.", category: "utilities", status: "live", runsIn: "browser", icon: "Dices",
    keywords: ["random number generator", "random number", "number picker", "lottery number generator", "pick a random number"], synonyms: ["rng", "random picker", "dice roller"],
    related: ["password-generator", "uuid-generator", "stopwatch-timer"], addedAt: ADDED,
    seo: { title: "Random Number Generator – Fair Numbers in Any Range", description: "Generate one or many random whole numbers between any minimum and maximum, with no repeats if you want. Uses your browser's cryptographic random generator." },
    content: {
      intro: "Draw fair random numbers for games, giveaways or sampling. Numbers come from your browser's cryptographic generator, without the bias of simple methods.",
      steps: ["Set the minimum and maximum.", "Choose how many numbers and whether repeats are allowed.", "Click Generate."],
      features: ["Up to 10,000 numbers at once", "Optional no-repeat mode", "Cryptographically secure and unbiased"],
      faqs: [{ q: "Is it truly random?", a: "It uses the Web Crypto API, the same source browsers use for encryption keys, with rejection sampling so every number in the range is equally likely." }],
    },
  },
  {
    slug: "stopwatch-timer", name: "Stopwatch & Timer", tagline: "An accurate online stopwatch with laps, plus a countdown timer.", category: "utilities", status: "live", runsIn: "browser", icon: "Timer",
    keywords: ["online stopwatch", "countdown timer", "timer", "stopwatch with laps", "online timer"], synonyms: ["chronometer", "kitchen timer", "lap timer"],
    related: ["random-number-generator", "time-zone-converter", "age-calculator"], addedAt: ADDED,
    seo: { title: "Online Stopwatch & Countdown Timer with Laps", description: "A precise online stopwatch with lap times and a countdown timer that beeps when time is up. No app to install, nothing to sign up for." },
    content: {
      intro: "Time anything to the millisecond, record laps, or count down from any duration with an audible alert when it ends.",
      steps: ["Choose Stopwatch or Countdown timer.", "Press Start (set the minutes and seconds first for the timer).", "Pause, record laps or reset whenever you like."],
      features: ["Millisecond stopwatch with laps", "Countdown with a sound alert", "Stays accurate even if the tab is in the background"],
      faqs: [{ q: "Will it keep time if I switch tabs?", a: "Yes. The time is calculated from the clock rather than counted tick by tick, so it stays accurate. The alert may sound slightly late in a background tab." }],
    },
  },
];
