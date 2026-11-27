/**
 * Every locale YoniXTools knows about: 20 priority locales plus 80 more (100 in total).
 *
 *  - `code`   BCP 47 language tag (used for <html lang>, hreflang, Intl formatting).
 *  - `prefix` URL prefix (lower case). English has none: it keeps the existing root URLs.
 *  - `native` name in its own script (shown in the language selector).
 *  - `dir`    text direction.
 *  - `latin`  written in Latin script: such locales get translated ASCII URL slugs; others keep
 *             the English slugs (readable, unencoded URLs) under their own prefix.
 *  - `og`     Open Graph locale (language_TERRITORY).
 *  - `priority` one of the 20 launch locales.
 *
 * Whether a locale is actually BUILT is not decided here: only locales whose catalogue is complete
 * (every required key, valid placeholders and plural forms) are built; see i18n/catalogue.ts.
 * Whether its pages are INDEXED depends on human review; see i18n/review.
 */
export interface LocaleInfo {
  code: string;
  prefix: string;
  name: string;
  native: string;
  dir: "ltr" | "rtl";
  latin: boolean;
  og: string;
  priority: boolean;
}

const L = (code: string, name: string, native: string, og: string, opts: { rtl?: boolean; latin?: boolean; priority?: boolean } = {}): LocaleInfo => ({
  code,
  prefix: code === "en" ? "" : code.toLowerCase(),
  name,
  native,
  dir: opts.rtl ? "rtl" : "ltr",
  latin: opts.latin ?? false,
  og,
  priority: opts.priority ?? false,
});
const P = { priority: true } as const;
const PL = { priority: true, latin: true } as const;
const LA = { latin: true } as const;

export const LOCALES: LocaleInfo[] = [
  // ── The 20 priority locales ──
  L("en", "English", "English", "en_US", PL),
  L("es", "Spanish", "Español", "es_ES", PL),
  L("pt-BR", "Portuguese (Brazil)", "Português (Brasil)", "pt_BR", PL),
  L("fr", "French", "Français", "fr_FR", PL),
  L("de", "German", "Deutsch", "de_DE", PL),
  L("hi", "Hindi", "हिन्दी", "hi_IN", P),
  L("id", "Indonesian", "Bahasa Indonesia", "id_ID", PL),
  L("ar", "Arabic", "العربية", "ar_AR", { ...P, rtl: true }),
  L("zh-CN", "Chinese (Simplified)", "简体中文", "zh_CN", P),
  L("ja", "Japanese", "日本語", "ja_JP", P),
  L("ru", "Russian", "Русский", "ru_RU", P),
  L("bn", "Bengali", "বাংলা", "bn_BD", P),
  L("ur", "Urdu", "اردو", "ur_PK", { ...P, rtl: true }),
  L("tr", "Turkish", "Türkçe", "tr_TR", PL),
  L("vi", "Vietnamese", "Tiếng Việt", "vi_VN", PL),
  L("ko", "Korean", "한국어", "ko_KR", P),
  L("it", "Italian", "Italiano", "it_IT", PL),
  L("nl", "Dutch", "Nederlands", "nl_NL", PL),
  L("th", "Thai", "ไทย", "th_TH", P),
  L("sw", "Swahili", "Kiswahili", "sw_KE", PL),
  // ── 80 further locales (catalogue entries; built only once their translation is complete) ──
  L("pl", "Polish", "Polski", "pl_PL", LA),
  L("uk", "Ukrainian", "Українська", "uk_UA"),
  L("ro", "Romanian", "Română", "ro_RO", LA),
  L("el", "Greek", "Ελληνικά", "el_GR"),
  L("cs", "Czech", "Čeština", "cs_CZ", LA),
  L("hu", "Hungarian", "Magyar", "hu_HU", LA),
  L("sv", "Swedish", "Svenska", "sv_SE", LA),
  L("da", "Danish", "Dansk", "da_DK", LA),
  L("fi", "Finnish", "Suomi", "fi_FI", LA),
  L("nb", "Norwegian Bokmål", "Norsk bokmål", "nb_NO", LA),
  L("he", "Hebrew", "עברית", "he_IL", { rtl: true }),
  L("fa", "Persian", "فارسی", "fa_IR", { rtl: true }),
  L("ms", "Malay", "Bahasa Melayu", "ms_MY", LA),
  L("fil", "Filipino", "Filipino", "fil_PH", LA),
  L("ta", "Tamil", "தமிழ்", "ta_IN"),
  L("te", "Telugu", "తెలుగు", "te_IN"),
  L("mr", "Marathi", "मराठी", "mr_IN"),
  L("gu", "Gujarati", "ગુજરાતી", "gu_IN"),
  L("kn", "Kannada", "ಕನ್ನಡ", "kn_IN"),
  L("ml", "Malayalam", "മലയാളം", "ml_IN"),
  L("pa", "Punjabi", "ਪੰਜਾਬੀ", "pa_IN"),
  L("ne", "Nepali", "नेपाली", "ne_NP"),
  L("si", "Sinhala", "සිංහල", "si_LK"),
  L("my", "Burmese", "မြန်မာ", "my_MM"),
  L("km", "Khmer", "ខ្មែរ", "km_KH"),
  L("lo", "Lao", "ລາວ", "lo_LA"),
  L("zh-TW", "Chinese (Traditional)", "繁體中文", "zh_TW"),
  L("pt-PT", "Portuguese (Portugal)", "Português (Portugal)", "pt_PT", LA),
  L("bg", "Bulgarian", "Български", "bg_BG"),
  L("sr", "Serbian", "Српски", "sr_RS"),
  L("hr", "Croatian", "Hrvatski", "hr_HR", LA),
  L("sk", "Slovak", "Slovenčina", "sk_SK", LA),
  L("sl", "Slovenian", "Slovenščina", "sl_SI", LA),
  L("lt", "Lithuanian", "Lietuvių", "lt_LT", LA),
  L("lv", "Latvian", "Latviešu", "lv_LV", LA),
  L("et", "Estonian", "Eesti", "et_EE", LA),
  L("ca", "Catalan", "Català", "ca_ES", LA),
  L("eu", "Basque", "Euskara", "eu_ES", LA),
  L("gl", "Galician", "Galego", "gl_ES", LA),
  L("sq", "Albanian", "Shqip", "sq_AL", LA),
  L("mk", "Macedonian", "Македонски", "mk_MK"),
  L("bs", "Bosnian", "Bosanski", "bs_BA", LA),
  L("be", "Belarusian", "Беларуская", "be_BY"),
  L("ka", "Georgian", "ქართული", "ka_GE"),
  L("hy", "Armenian", "Հայերեն", "hy_AM"),
  L("az", "Azerbaijani", "Azərbaycan", "az_AZ", LA),
  L("kk", "Kazakh", "Қазақ тілі", "kk_KZ"),
  L("uz", "Uzbek", "Oʻzbek", "uz_UZ", LA),
  L("ky", "Kyrgyz", "Кыргызча", "ky_KG"),
  L("tg", "Tajik", "Тоҷикӣ", "tg_TJ"),
  L("tk", "Turkmen", "Türkmen", "tk_TM", LA),
  L("mn", "Mongolian", "Монгол", "mn_MN"),
  L("ps", "Pashto", "پښتو", "ps_AF", { rtl: true }),
  L("ckb", "Central Kurdish", "کوردیی ناوەندی", "ckb_IQ", { rtl: true }),
  L("am", "Amharic", "አማርኛ", "am_ET"),
  L("ha", "Hausa", "Hausa", "ha_NG", LA),
  L("yo", "Yoruba", "Yorùbá", "yo_NG", LA),
  L("ig", "Igbo", "Igbo", "ig_NG", LA),
  L("zu", "Zulu", "isiZulu", "zu_ZA", LA),
  L("xh", "Xhosa", "isiXhosa", "xh_ZA", LA),
  L("af", "Afrikaans", "Afrikaans", "af_ZA", LA),
  L("so", "Somali", "Soomaali", "so_SO", LA),
  L("rw", "Kinyarwanda", "Kinyarwanda", "rw_RW", LA),
  L("mg", "Malagasy", "Malagasy", "mg_MG", LA),
  L("jv", "Javanese", "Basa Jawa", "jv_ID", LA),
  L("su", "Sundanese", "Basa Sunda", "su_ID", LA),
  L("ceb", "Cebuano", "Cebuano", "ceb_PH", LA),
  L("is", "Icelandic", "Íslenska", "is_IS", LA),
  L("ga", "Irish", "Gaeilge", "ga_IE", LA),
  L("cy", "Welsh", "Cymraeg", "cy_GB", LA),
  L("mt", "Maltese", "Malti", "mt_MT", LA),
  L("lb", "Luxembourgish", "Lëtzebuergesch", "lb_LU", LA),
  L("sd", "Sindhi", "سنڌي", "sd_PK", { rtl: true }),
  L("as", "Assamese", "অসমীয়া", "as_IN"),
  L("or", "Odia", "ଓଡ଼ିଆ", "or_IN"),
  L("ht", "Haitian Creole", "Kreyòl ayisyen", "ht_HT", LA),
  L("qu", "Quechua", "Runasimi", "qu_PE", LA),
  L("ny", "Chichewa", "Chichewa", "ny_MW", LA),
  L("sn", "Shona", "chiShona", "sn_ZW", LA),
  L("om", "Oromo", "Afaan Oromoo", "om_ET", LA),
];

export const DEFAULT_LOCALE = "en";
const byCode = new Map(LOCALES.map((l) => [l.code, l]));
const byPrefix = new Map(LOCALES.filter((l) => l.prefix).map((l) => [l.prefix, l]));

export const getLocale = (code: string): LocaleInfo => byCode.get(code) ?? byCode.get(DEFAULT_LOCALE)!;
export const isKnownLocale = (code: string) => byCode.has(code);
/** The locale a URL prefix ("es", "pt-br") stands for, or undefined. */
export const localeFromPrefix = (prefix: string | undefined): LocaleInfo | undefined => (prefix ? byPrefix.get(prefix.toLowerCase()) : undefined);
