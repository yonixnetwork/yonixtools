# Keyword research for localized landing pages

Research date: **2026-11-14**. Status of every keyword in this document and in the data files: **UNVALIDATED RESEARCH CANDIDATE (autocomplete evidence, no volume)**.

Files:

- `docs/i18n/keywords.csv`: every autocomplete suggestion observed (one row per suggestion per query), classified.
- `docs/i18n/keyword-candidates.json`: one primary query, alternatives and a slug suggestion per locale and tool.
- This document: method, per-locale tables, on-page guidance, regional notes, caveats and gaps.

## 1. Scope: which tools may get landing pages

The tools come from `apps/web/src/lib/registry/tools.ts`, `tools-extra.ts` and `tools-more.ts`. Downloader platform status comes from `apps/web/src/lib/downloader/platform-status.ts` (verified 7 November 2026).

- **Excluded (no landing pages proposed):** `youtube-downloader` and `reddit-downloader` (both `hidden: true`), and Vimeo (no tool; it refuses our server). Suggestions that mention YouTube, Reddit or Vimeo are kept in the CSV marked *needs a feature/platform we do not offer*, with an empty `proposed_landing_page`.
- **Working downloaders covered:** TikTok, Instagram, Facebook, X/Twitter (all locales); Pinterest (en baseline only, see gaps). The downloader tools have `status: "awaiting-backend"`, so they are indexable only when the production backend is configured (`isAvailable`). Publish localized downloader pages only where that holds.
- **Unsupported intents seen in suggestions, recorded but not targeted:** PDF to Word/Excel/PowerPoint, PDF editing/signing/unlocking, background removal, AI image tools, video to MP3 (our audio extractor outputs WAV), Instagram Stories (need a login), Douyin. These are product gaps, not landing pages.

## 2. Method

1. **Source:** Google autocomplete, `https://suggestqueries.google.com/complete/search?client=firefox&ie=UTF-8&oe=UTF-8&hl=<hl>&gl=<cc>&q=<seed>`. The query was URL-encoded with Python `urllib.parse.quote`. Results were collected on 2026-11-14 from a cloud server, with about 0.35 s between requests. Autocomplete is personalised and changes over time, so another run may differ.
2. **Seeds:** for each locale I wrote one natural local phrasing per tool (24 tools: the 23 required slugs plus `age-calculator`). They are in the native script, using the verb and noun forms people really use (e.g. `juntar pdf` in pt-BR, `pdf 結合` in ja, `pdf 합치기` in ko). When a local seed returned nothing, I sent the English seed under the same hl and gl as a fallback. For the worst gaps (hi, bn, ur, th, ko, ja, es Instagram, sw TikTok) I tried 19 extra phrasings, such as Roman Urdu, `パスワード生成` without the space, and `틱톡 다운로드`.
3. **Countries:** the main country per locale for all tools. Secondary countries for 6 core tools (merge PDF, compress PDF, compress image, TikTok, QR generator, percentage): es-MX, ar-SA, sw-TZ, en-GB, en-IN. English (gl=us) adds 10 extra-cluster seeds (Pinterest, video info, colour, timestamp, number base, time zone, case converter, BMI, loan, Base64).
4. **Volume:** 566 requests in total (46 fallback or extra seeds, 32 with no suggestions), giving 4704 suggestion rows.
5. **Classification (scripted, then reviewed by hand):** each suggestion is labelled
   - *core*: a candidate for title/H1/meta;
   - *question*: an FAQ or guide topic;
   - *device*: an OS or app modifier, answered in an FAQ;
   - *brand*: a competitor or brand term, recorded only and never targeted;
   - *unsupported*: a feature or platform we lack, so no page;
   - *off-topic*: Google rewrote the seed into something unrelated.
6. **Primary choice:** the seed itself if Google echoes it or completes it at least twice. Otherwise the shortest of the first core suggestions. A few were picked by hand (e.g. dropping trailing modifiers like *sin programa*). Slugs for Latin-script locales are ASCII kebab-case versions of the primary without diacritics (German umlauts as ae/oe/ue). Non-Latin locales keep the English slugs (`slug_suggestion: null`).

**What autocomplete proves and what it does not:** a completion shows that a phrase is searched often enough to be suggested in that market. It gives **no** search volume, competition or ranking difficulty. The `search_volume` and `competition` columns are therefore empty everywhere, and no figures were invented or taken from third-party traffic tools.

## 3. Summary: primary query per locale (top clusters)

| Locale | pdf-merger | pdf-compressor | image-compressor | image-converter | qr-code-generator | tiktok-downloader |
|---|---|---|---|---|---|---|
| es | unir pdf | comprimir pdf | comprimir imagen | convertir imagen | generar codigo qr | descargar video tiktok |
| pt-BR | juntar pdf | comprimir pdf | comprimir imagem | converter imagem | gerar qr code | baixar video tiktok |
| fr | fusionner pdf | compresser pdf | compresser image | convertir image | générer qr code | télécharger vidéo tiktok |
| de | pdf zusammenfügen | pdf komprimieren | bild komprimieren | bild umwandeln | qr code erstellen | tiktok video herunterladen |
| hi | पीडीएफ मर्ज | पीडीएफ कंप्रेस | फोटो का साइज कम | फोटो को jpg | क्यूआर कोड बनाएं | टिकटॉक वीडियो डाउनलोड |
| id | gabung pdf | kompres pdf | kompres foto | ubah format gambar | buat qr code | download video tiktok |
| ar | دمج ملفات pdf | ضغط pdf | ضغط الصور | تحويل الصور | انشاء qr code | تحميل فيديو تيك توك |
| zh-CN | pdf合并 | pdf压缩 | 图片压缩 | 图片格式转换 | 二维码生成 | tiktok视频下载 |
| ja | pdf 結合 | pdf 圧縮 | 画像 圧縮 | 画像 変換 | qrコード 作成 | tiktok 動画 保存 |
| ru | объединить pdf | сжать pdf | сжать фото | конвертер изображений | создать qr код | скачать видео с тик тока |
| bn | পিডিএফ মার্জ | পিডিএফ ফাইল ছোট করা | ছবির সাইজ কমানো | ছবি কনভার্ট | কিউআর কোড তৈরি | টিকটক ভিডিও ডাউনলোড |
| ur | merge pdf | compress pdf | photo ka size kam | تصویر تبدیل | qr code generator | ٹک ٹاک ویڈیو ڈاؤن لوڈ |
| tr | pdf birleştirme | pdf sıkıştırma | resim sıkıştırma | resim dönüştürme | qr kod oluşturma | tiktok video indir |
| vi | ghép file pdf | nén pdf | nén ảnh | chuyển đổi định dạng ảnh | tạo mã qr | tải video tiktok |
| ko | pdf 합치기 | pdf 용량 줄이기 | 이미지 용량 줄이기 | 이미지 변환 | qr코드 만들기 | 틱톡 다운로드 |
| it | unire pdf | comprimere pdf | comprimere immagine | convertire immagine | creare qr code | scaricare video tiktok |
| nl | pdf samenvoegen | pdf verkleinen | foto verkleinen | afbeelding converteren | qr code maken | tiktok video downloaden |
| th | รวมไฟล์ pdf | ลดขนาดไฟล์ pdf | ลดขนาดรูป | แปลงไฟล์รูป | สร้าง qr code | โหลดวิดีโอ tiktok |
| sw | kuunganisha pdf | kupunguza ukubwa wa pdf | kupunguza ukubwa wa picha | kubadilisha picha | kutengeneza qr code | tiktok downloader |
| en | merge pdf | compress pdf | compress image | image converter | qr code generator | tiktok downloader |

## 4. Proposed landing pages: rules

- A landing page is **always the localized version of an existing tool page**: `/<locale>/<tool-slug>` (English stays at `/<tool-slug>`). No new pages for tools or intents we do not offer.
- `slug_suggestion` (Latin-script locales) is an *optional* localized alias, e.g. `/es/unir-pdf`. Use it only if the routing supports localized slugs with a canonical URL and hreflang. Otherwise keep the English slug and put the local term in title/H1.
- Image-converter queries with a PDF target (e.g. `convertir imagen a pdf`) are mapped to the **Image to PDF** page in the CSV.
- Brand queries (`ilovepdf`, `i love pdf`, `smallpdf`, `pdf24`, `adobe`, `canva`, `capcut`, `snaptik`, `네이버`, and so on) are recorded with empty `proposed_landing_page` and must not be used in titles, headings, meta or slugs.

## 5. Title, H1 and meta description guidance

Pattern: **Title** = `<primary query> – <top 1-2 local modifiers>` (stay within about 60 characters; CJK/Thai about 30 characters). **H1** = the primary query as a natural phrase. **Meta description** = what the tool does, the local *free/online* modifier, and the privacy point (files are processed in the browser), which answers *safe*, *without program* and *without sign-up* type modifiers seen in several markets. The table gives the observed modifiers and a worked example for the PDF merger. Apply the same pattern to the other tools using their primaries from `keyword-candidates.json`.

| Locale | Observed modifiers | Example title (PDF merger) | Example H1 | Example meta description |
|---|---|---|---|---|
| es | gratis, online, sin (marca de agua/programa) | Unir PDF gratis y online – sin subir archivos | Unir PDF | Une varios PDF en uno, gratis y online. Todo ocurre en tu navegador: tus archivos no se suben a ningún servidor. |
| pt-BR | online, grátis/gratuito, sem | Juntar PDF grátis e online – sem enviar arquivos | Juntar PDF | Junte vários PDFs em um só, grátis e online. Tudo acontece no seu navegador: os arquivos não saem do seu dispositivo. |
| fr | gratuit, en ligne, sans inscription | Fusionner PDF gratuit en ligne – sans inscription | Fusionner des PDF | Fusionnez plusieurs PDF en un seul, gratuitement et sans inscription. Le traitement se fait dans votre navigateur. |
| de | kostenlos, online, ohne Anmeldung | PDF zusammenfügen – kostenlos, online, ohne Anmeldung | PDF zusammenfügen | Mehrere PDFs kostenlos zu einer Datei zusammenfügen – direkt im Browser, ohne Upload und ohne Anmeldung. |
| hi | कैसे करें, online/ऑनलाइन, free | पीडीएफ मर्ज करें (Merge PDF) – फ्री, ऑनलाइन | पीडीएफ मर्ज करें | कई PDF फाइलों को एक PDF में जोड़ें – फ्री और ऑनलाइन। फाइलें आपके ब्राउज़र में ही रहती हैं। |
| id | online, gratis, 1 mb | Gabung PDF Gratis Online – Tanpa Upload | Gabung PDF | Gabungkan beberapa PDF jadi satu secara gratis dan online. Semua diproses di browser, file tidak diunggah. |
| ar | مجانا, اون لاين, بدون برامج, ميجا | دمج ملفات PDF مجانا اون لاين – بدون برامج | دمج ملفات PDF في ملف واحد | ادمج عدة ملفات PDF في ملف واحد مجانا وبدون برامج. تتم المعالجة داخل متصفحك ولا تُرفع ملفاتك. |
| zh-CN | 在线, 工具, 免费, 网站 | PDF合并 – 免费在线工具，无需上传 | PDF合并 | 免费在线合并多个PDF文件。全部在浏览器中处理，文件不会上传到服务器。 |
| ja | 無料, サイト, 安全, スマホ | PDF 結合 – 無料・安全なオンラインツール | PDFを結合 | 複数のPDFを無料で1つに結合。処理はブラウザ内で行われ、ファイルはアップロードされないので安全です。 |
| ru | онлайн, бесплатно, без потери качества | Объединить PDF онлайн бесплатно – без загрузки | Объединить PDF файлы | Объедините несколько PDF в один онлайн и бесплатно. Обработка в браузере — файлы не загружаются на сервер. |
| bn | অনলাইন, ফ্রি, করার নিয়ম | পিডিএফ মার্জ (Merge PDF) – ফ্রি অনলাইন | পিডিএফ মার্জ করুন | একাধিক PDF ফাইল ফ্রিতে একটি PDF-এ যুক্ত করুন। সব কাজ আপনার ব্রাউজারেই হয়। |
| ur | online, free (English) | Merge PDF – پی ڈی ایف فائلیں جوڑیں، مفت | پی ڈی ایف فائلیں جوڑیں (Merge PDF) | کئی PDF فائلوں کو مفت میں ایک فائل میں جوڑیں۔ سب کچھ آپ کے براؤزر میں ہوتا ہے۔ |
| tr | ücretsiz, programsız, online, nasıl yapılır | PDF Birleştirme – Ücretsiz, Programsız, Online | PDF birleştirme | Birden fazla PDF'yi ücretsiz ve programsız birleştirin. İşlem tarayıcınızda yapılır, dosyalar yüklenmez. |
| vi | online, miễn phí, trên máy tính | Ghép file PDF online miễn phí – không cần tải lên | Ghép file PDF | Ghép nhiều file PDF thành một, miễn phí và online. Xử lý ngay trên trình duyệt, file không bị tải lên. |
| ko | 사이트, 무료, 프로그램 | PDF 합치기 – 무료 사이트, 프로그램 설치 없이 | PDF 합치기 | 여러 PDF를 무료로 하나로 합치세요. 브라우저에서 처리되어 파일이 업로드되지 않습니다. |
| it | gratis, online, senza | Unire PDF gratis online – senza caricare file | Unire PDF | Unisci più PDF in uno solo, gratis e online. Tutto avviene nel browser: i file non vengono caricati. |
| nl | gratis, online, zonder | PDF samenvoegen – gratis en online, zonder upload | PDF samenvoegen | Voeg meerdere pdf's gratis samen tot één bestand. Alles gebeurt in je browser; bestanden worden niet geüpload. |
| th | ฟรี, ออนไลน์, ไม่เกิน … mb | รวมไฟล์ PDF ฟรี ออนไลน์ – ไม่ต้องอัปโหลด | รวมไฟล์ PDF | รวมไฟล์ PDF หลายไฟล์เป็นไฟล์เดียว ฟรีและออนไลน์ ประมวลผลในเบราว์เซอร์ ไฟล์ไม่ถูกอัปโหลด |
| sw | jinsi ya, bure/free, online | Kuunganisha PDF (Merge PDF) – bure, online | Kuunganisha PDF | Unganisha PDF kadhaa kuwa faili moja bure. Kila kitu kinafanyika kwenye kivinjari chako. |

Do not promise what the tool cannot do. For example, the audio extractor saves WAV, not MP3. Downloaders should say *public posts only* where a login is needed (Instagram Stories, protected X accounts).

## 6. Per-locale candidates

Each table lists the primary query and up to three alternatives (core, question or device) for the locale's main country. The proposed landing page is the existing tool page; the slug column is the optional localized alias. Brand completions observed for the locale are listed below each table.

### es: Spanish (gl=es, also mx; hl=es)

Strong, clean demand for verb-first queries (`unir pdf`, `comprimir pdf`). `gratis` and `online` are the top modifiers. Downloader queries are long-tail: *sin marca de agua*, *enlace*, *sin programa*. `descargar video instagram` returned no completions in gl=es (also `descargar reels instagram`); only the English `instagram downloader` did.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | unir pdf | unir pdf online; unir pdf online gratis; unir pdf gratis | /es/pdf-merger | unir-pdf |
| PDF tools | pdf-compressor | comprimir pdf | comprimir pdf gratis; comprimir pdf online; comprimir pdf online gratis | /es/pdf-compressor | comprimir-pdf |
| PDF tools | pdf-splitter | dividir pdf | dividir pdf online; dividir pdf gratis; dividir pdf online gratis | /es/pdf-splitter | dividir-pdf |
| PDF tools | pdf-to-image | pdf a jpg | pdf a jpg online; pdf a jpg gratis; pdf a jpg online gratis | /es/pdf-to-image | pdf-a-jpg |
| PDF tools | image-to-pdf | jpg a pdf | jpg a pdf gratis; jpg a pdf online; jpg a pdf gratis online | /es/image-to-pdf | jpg-a-pdf |
| PDF tools | rotate-pdf | rotar pdf | rotar pdf online; rotar pdf gratis; rotar pdf online gratis | /es/rotate-pdf | rotar-pdf |
| image compressor | image-compressor | comprimir imagen | comprimir imagenes; comprimir imagenes jpg; comprimir imagen online | /es/image-compressor | comprimir-imagen |
| image converter/resizer/cropper | image-converter | convertir imagen | convertir imagen a pdf; convertir imagen a pdf gratis; convertir imagenes a pdf | /es/image-converter | convertir-imagen |
| image converter/resizer/cropper | image-resizer | redimensionar imagen | redimensionar imagenes; redimensionar imagen online; redimensionar imagen sin perder calidad | /es/image-resizer | redimensionar-imagen |
| image converter/resizer/cropper | image-cropper | recortar imagen | recortar imagen online; recortar imagenes; recortar imagen en circulo | /es/image-cropper | recortar-imagen |
| social downloaders | tiktok-downloader | descargar video tiktok | descargar video tiktok enlace; descargar video tiktok calidad; descargar video tiktok sin marcas | /es/tiktok-downloader | descargar-video-tiktok |
| social downloaders | instagram-downloader | instagram downloader (fallback) | instagram downloader dp; instagram downloader without watermark | /es/instagram-downloader | instagram-downloader |
| social downloaders | facebook-downloader | descargar video facebook | descargar video facebook sin programa; descargar video facebook aplicación | /es/facebook-downloader | descargar-video-facebook |
| social downloaders | x-video-downloader | descargar video twitter | descargar video twitter seguro; descargar video twitter app; descargar video twitter android | /es/x-video-downloader | descargar-video-twitter |
| video tools | video-audio-extractor | extraer audio de video | extraer audio de video url gratis; extraer audio de video gratis; extraer audio de video online | /es/video-audio-extractor | extraer-audio-de-video |
| video tools | video-frame-extractor | extraer fotogramas de video | extraer fotogramas de video online; extraer fotogramas de video gratis; extraer fotogramas de video en línea gratis | /es/video-frame-extractor | extraer-fotogramas-de-video |
| QR code | qr-code-generator | generar codigo qr | generar código qr gratis; generar codigo qr de un enlace; generar codigo qr gratis que no caduque | /es/qr-code-generator | generar-codigo-qr |
| QR code | qr-code-scanner | escanear codigo qr | escanear codigo qr de una imagen; escanear codigo qr ordenador; escanear codigo qr iphone | /es/qr-code-scanner | escanear-codigo-qr |
| text tools | word-counter | contador de palabras | contador de palabras online; contador de palabras en ingles; contador de palabras de un texto | /es/word-counter | contador-de-palabras |
| text tools | password-generator | generador de contraseñas | generador de contraseñas seguras; generador de contraseñas aleatorias; generador de contraseñas online | /es/password-generator | generador-de-contrasenas |
| calculators | percentage-calculator | calcular porcentaje | calcular porcentaje de una cantidad; calcular porcentaje de incremento; calcular porcentaje de grasa | /es/percentage-calculator | calcular-porcentaje |
| calculators | age-calculator | calcular edad | calcular edad de jubilación; calcular edad con fecha de nacimiento; calcular edad cronologica | /es/age-calculator | calcular-edad |
| developer tools | json-formatter | formatear json | formatear json online; formatear json visual studio code | /es/json-formatter | formatear-json |
| converters | unit-converter | conversor de unidades | conversor de unidades de presion; conversor de unidades de peso; conversor de unidades de longitud | /es/unit-converter | conversor-de-unidades |

Brands observed (not targets): ilovepdf (6), google (5), ilove (4), love (3), i love pdf (3), canva (2), adobe (1), capcut (1).

Question-type completions (FAQ and guide topics): `comprimir pdf online optimiza tus pdf para que pesen menos`; `generar codigo qr gratis que no caduque`.

### pt-BR: Portuguese (Brazil) (gl=br; hl=pt-BR)

`juntar pdf` (not *mesclar*/*unir*) is the merge verb that Google completes. `comprimir imagem para 70k` / size targets show a recurring use case: upload limits on government and exam forms. Use `grátis`/`online` in titles. `baixar video ... sem marca d'água` and `pelo navegador` are good FAQ angles.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | juntar pdf | juntar pdfs; juntar pdf gratis; juntar pdf online | /pt-BR/pdf-merger | juntar-pdf |
| PDF tools | pdf-compressor | comprimir pdf | comprimir pdf gratuito; comprimir pdf grátis; comprimir pdf gratuito online ilimitado | /pt-BR/pdf-compressor | comprimir-pdf |
| PDF tools | pdf-splitter | dividir pdf | dividir pdf por tamanho; dividir pdf gratis; dividir pdf em partes | /pt-BR/pdf-splitter | dividir-pdf |
| PDF tools | pdf-to-image | pdf para jpg | pdf para jpg gratis; pdf para jpg gratuito; pdf para jpg online | /pt-BR/pdf-to-image | pdf-para-jpg |
| PDF tools | image-to-pdf | jpg para pdf | jpg para pdf gratuito; jpg para pdf online; jpg para pdf gratuito online | /pt-BR/image-to-pdf | jpg-para-pdf |
| PDF tools | rotate-pdf | girar pdf | girar pdf online; girar pdf online gratis; girar pdf gratuito | /pt-BR/rotate-pdf | girar-pdf |
| image compressor | image-compressor | comprimir imagem | comprimir imagem jpg; comprimir imagem para 70k; comprimir imagem gratis | /pt-BR/image-compressor | comprimir-imagem |
| image converter/resizer/cropper | image-converter | converter imagem | converter imagem em pdf; converter imagem em jpg; converter imagem em pdf grátis | /pt-BR/image-converter | converter-imagem |
| image converter/resizer/cropper | image-resizer | redimensionar imagem | redimensionar imagem online; redimensionar imagem online grátis; redimensionar imagem gratis | /pt-BR/image-resizer | redimensionar-imagem |
| image converter/resizer/cropper | image-cropper | recortar imagem | recortar imagem online; recortar imagem redonda; recortar imagem fundo | /pt-BR/image-cropper | recortar-imagem |
| social downloaders | tiktok-downloader | baixar video tiktok | baixar video tiktok app; baixar video tiktok sem marca d'água app; baixar video tiktok foto | /pt-BR/tiktok-downloader | baixar-video-tiktok |
| social downloaders | instagram-downloader | baixar video instagram | baixar video instagram app; baixar video instagram navegador; baixar video instagram pelo navegador | /pt-BR/instagram-downloader | baixar-video-instagram |
| social downloaders | facebook-downloader | baixar video facebook | baixar video facebook navegador; baixar vídeo facebook sem programa; baixar video facebook privado | /pt-BR/facebook-downloader | baixar-video-facebook |
| social downloaders | x-video-downloader | baixar video twitter | baixar video twitter snap; baixar video twitter live; baixar video twitter extensão | /pt-BR/x-video-downloader | baixar-video-twitter |
| video tools | video-audio-extractor | extrair audio de video | extrair audio de video online; extrair áudio de vídeo grátis; extrair áudio de vídeo tiktok | /pt-BR/video-audio-extractor | extrair-audio-de-video |
| video tools | video-frame-extractor | extrair frame de video | extrair frames de video online; extrair frames de video iphone; extrair primeiro frame de video | /pt-BR/video-frame-extractor | extrair-frame-de-video |
| QR code | qr-code-generator | gerar qr code | gerar qr code pix; gerar qr code gratuito; gerar qr code de link | /pt-BR/qr-code-generator | gerar-qr-code |
| QR code | qr-code-scanner | ler qr code | ler qr code online; ler qr code no pc; ler qr code online grátis | /pt-BR/qr-code-scanner | ler-qr-code |
| text tools | word-counter | contador de palavras | contador de palavras online; contador de palavras no texto; contador de palavras em minutos | /pt-BR/word-counter | contador-de-palavras |
| text tools | password-generator | gerador de senha | gerador de senha forte; gerador de senha aleatória; gerador de senha 4devs | /pt-BR/password-generator | gerador-de-senha |
| calculators | percentage-calculator | calcular porcentagem | calcular porcentagem de um valor; calcular porcentagem entre dois valores; calcular porcentagem online | /pt-BR/percentage-calculator | calcular-porcentagem |
| calculators | age-calculator | calcular idade | calcular idade gestacional; calcular idade pela data de nascimento; calcular idade gestacional pelo ultrassom | /pt-BR/age-calculator | calcular-idade |
| developer tools | json-formatter | formatar json | formatar json online; formatar json em uma linha; formatar json intellij | /pt-BR/json-formatter | formatar-json |
| converters | unit-converter | conversor de unidades | conversor de unidades de medida; conversor de unidades de pressão; conversor de unidades de peso | /pt-BR/unit-converter | conversor-de-unidades |

Brands observed (not targets): i love pdf (7), google (6), ilove (5), canva (3), vscode (2), ilovepdf (1), capcut (1), whatsapp (1).

### fr: French (gl=fr; hl=fr)

Modifiers: `gratuit`, `en ligne`, `sans inscription`. `pivoter pdf` is completed; `fusionner pdf` and `compresser pdf` are clean head terms. Several image queries carry an unsupported intent (`… en word`).

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | fusionner pdf | fusionner pdf gratuit; fusionner pdf en ligne; fusionner pdf gratuit en ligne | /fr/pdf-merger | fusionner-pdf |
| PDF tools | pdf-compressor | compresser pdf | compresser pdf gratuit; compresser pdf en ligne; compresser pdf gratuit en ligne | /fr/pdf-compressor | compresser-pdf |
| PDF tools | pdf-splitter | diviser pdf | diviser pdf gratuit; diviser pdf en ligne; diviser pdf en 2 | /fr/pdf-splitter | diviser-pdf |
| PDF tools | pdf-to-image | pdf en jpg | pdf en jpg gratuit; pdf en jpg gratuit en ligne; pdf en jpg haute qualité | /fr/pdf-to-image | pdf-en-jpg |
| PDF tools | image-to-pdf | jpg en pdf | jpg en pdf gratuit; jpg en pdf gratuit en ligne; jpg en pdf en ligne | /fr/image-to-pdf | jpg-en-pdf |
| PDF tools | rotate-pdf | pivoter pdf | pivoter pdf gratuitement; pivoter pdf en ligne; pivoter pdf page par page | /fr/rotate-pdf | pivoter-pdf |
| image compressor | image-compressor | compresser image | compresser image gratuit; compresser image jpeg; compresser image jpg | /fr/image-compressor | compresser-image |
| image converter/resizer/cropper | image-converter | convertir image | convertir image en pdf; convertir image en pdf gratuit; convertir image en pdf gratuit sans inscription | /fr/image-converter | convertir-image |
| image converter/resizer/cropper | image-resizer | redimensionner image | redimensionner image en ligne; redimensionner image en cm; redimensionner image gratuit | /fr/image-resizer | redimensionner-image |
| image converter/resizer/cropper | image-cropper | rogner image | rogner image en ligne; rogner image sur mac; rogner image en rond | /fr/image-cropper | rogner-image |
| social downloaders | tiktok-downloader | télécharger vidéo tiktok | télécharger vidéo tiktok son; télécharger vidéo tiktok sans texte; télécharger vidéo tiktok chinois | /fr/tiktok-downloader | telecharger-video-tiktok |
| social downloaders | instagram-downloader | télécharger vidéo instagram | télécharger vidéo instagram sans application; télécharger vidéo instagram application; télécharger vidéo instagram android | /fr/instagram-downloader | telecharger-video-instagram |
| social downloaders | facebook-downloader | télécharger vidéo facebook | télécharger video facebook gratuit; télécharger vidéo facebook lien; télécharger vidéo facebook gratuit sur android | /fr/facebook-downloader | telecharger-video-facebook |
| social downloaders | x-video-downloader | télécharger vidéo twitter | télécharger vidéo twitter gratuit; télécharger vidéo twitter hd; télécharger vidéo twitter en ligne | /fr/x-video-downloader | telecharger-video-twitter |
| video tools | video-audio-extractor | extraire audio video | extraire audio video iphone; extraire audio video samsung; extraire audio video tiktok | /fr/video-audio-extractor | extraire-audio-video |
| video tools | video-frame-extractor | extraire image video | extraire image vidéo iphone; extraire image video vlc; extraire image video mp4 | /fr/video-frame-extractor | extraire-image-video |
| QR code | qr-code-generator | générer qr code | générer qr code gratuit; générer qr code gratuit sans inscription; générer qr code instagram | /fr/qr-code-generator | generer-qr-code |
| QR code | qr-code-scanner | scanner qr code | scanner qr code gratuit; scanner qr code en ligne; scanner qr code sur photo | /fr/qr-code-scanner | scanner-qr-code |
| text tools | word-counter | compteur de mots | compteur de mots en ligne; compteur de mots dans un texte; compteur de mots gratuit | /fr/word-counter | compteur-de-mots |
| text tools | password-generator | générateur de mot de passe | générateur de mot de passe gratuit; générateur de mot de passe sécurisé; générateur de mot de passe en ligne | /fr/password-generator | generateur-de-mot-de-passe |
| calculators | percentage-calculator | calcul pourcentage | calcul pourcentage augmentation; calcul pourcentage d'évolution; calcul pourcentage pente | /fr/percentage-calculator | calcul-pourcentage |
| calculators | age-calculator | calcul age | calcul age date de naissance; calcul age chien; calcul age chat | /fr/age-calculator | calcul-age |
| developer tools | json-formatter | formater json | formater json en ligne; formater json online | /fr/json-formatter | formater-json |
| converters | unit-converter | convertisseur d'unités | convertisseur d'unités de mesure; convertisseur d unités biomédicales; convertisseur d'unités de longueur | /fr/unit-converter | convertisseur-d-unites |

Brands observed (not targets): i love pdf (6), adobe (6), canva (3), google (3), convertio (2), ilovepdf (1), capcut (1), notepad++ (1).

### de: German (gl=de; hl=de)

`kostenlos`, `online`, `ohne Anmeldung` are the dominant modifiers. That fits a no-signup browser tool well: put *ohne Anmeldung* in meta descriptions. `pdf24` and `adobe` appear often: record them only. `prozentrechner` and `einheitenumrechner` are single-word compounds.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | pdf zusammenfügen | pdf zusammenfügen kostenlos; pdf zusammenfügen online; pdf zusammenfügen online kostenlos | /de/pdf-merger | pdf-zusammenfuegen |
| PDF tools | pdf-compressor | pdf komprimieren | pdf komprimieren kostenlos; pdf komprimieren online; pdf komprimieren online kostenlos | /de/pdf-compressor | pdf-komprimieren |
| PDF tools | pdf-splitter | pdf teilen | pdf teilen kostenlos; pdf teilen online; pdf teilen online kostenlos | /de/pdf-splitter | pdf-teilen |
| PDF tools | pdf-to-image | pdf in jpg | pdf in jpg umwandeln; pdf in jpg umwandeln kostenlos; pdf in jpg umwandeln kostenlos ohne anmeldung | /de/pdf-to-image | pdf-in-jpg |
| PDF tools | image-to-pdf | jpg in pdf | jpg in pdf umwandeln; jpg in pdf umwandeln kostenlos; jpg in pdf umwandeln online kostenlos | /de/image-to-pdf | jpg-in-pdf |
| PDF tools | rotate-pdf | pdf drehen | pdf drehen und speichern; pdf drehen online; pdf drehen kostenlos | /de/rotate-pdf | pdf-drehen |
| image compressor | image-compressor | bild komprimieren | bild komprimieren kostenlos; bild komprimieren online; bild komprimieren iphone | /de/image-compressor | bild-komprimieren |
| image converter/resizer/cropper | image-converter | bild umwandeln | bild umwandeln in pdf; bild umwandeln in jpg; bild umwandeln in png | /de/image-converter | bild-umwandeln |
| image converter/resizer/cropper | image-resizer | bildgröße ändern | bildgröße ändern online; bildgröße ändern cm; bildgröße ändern online kostenlos | /de/image-resizer | bildgroesse-aendern |
| image converter/resizer/cropper | image-cropper | bild zuschneiden | bild zuschneiden online; bild zuschneiden mac; bild zuschneiden freihandform | /de/image-cropper | bild-zuschneiden |
| social downloaders | tiktok-downloader | tiktok video herunterladen | tiktok video herunterladen ohne wasserzeichen; tiktok video herunterladen kostenlos; tiktok video herunterladen pc | /de/tiktok-downloader | tiktok-video-herunterladen |
| social downloaders | instagram-downloader | instagram video herunterladen | instagram video herunterladen ohne wasserzeichen; instagram video herunterladen app; instagram video herunterladen windows | /de/instagram-downloader | instagram-video-herunterladen |
| social downloaders | facebook-downloader | facebook video herunterladen | facebook video herunterladen ohne app; facebook video herunterladen app; facebook video herunterladen handy | /de/facebook-downloader | facebook-video-herunterladen |
| social downloaders | x-video-downloader | twitter video herunterladen | twitter video herunterladen kostenlos | /de/x-video-downloader | twitter-video-herunterladen |
| video tools | video-audio-extractor | audio aus video extrahieren | audio aus video extrahieren online kostenlos; audio aus video extrahieren iphone; audio aus video extrahieren kostenlos | /de/video-audio-extractor | audio-aus-video-extrahieren |
| video tools | video-frame-extractor | standbild aus video | standbild aus video erstellen; standbild aus video iphone; standbild aus video android | /de/video-frame-extractor | standbild-aus-video |
| QR code | qr-code-generator | qr code erstellen | qr code erstellen kostenlos ohne anmeldung; qr code erstellen kostenlos dauerhaft; qr code erstellen gratis | /de/qr-code-generator | qr-code-erstellen |
| QR code | qr-code-scanner | qr code scannen | qr code scannen im handy; qr code scannen vom eigenen handy; qr code scannen iphone | /de/qr-code-scanner | qr-code-scannen |
| text tools | word-counter | wörter zählen | wörter zählen online; wörter zählen pages; wörter zählen pdf | /de/word-counter | woerter-zaehlen |
| text tools | password-generator | passwort generator | passwort generator heise; passwort generator wörter; passwort generator datenschutz | /de/password-generator | passwort-generator |
| calculators | percentage-calculator | prozentrechner | prozentrechner online; prozentrechner formel; prozentrechner euro | /de/percentage-calculator | prozentrechner |
| calculators | age-calculator | alter berechnen | alter berechnen geburtsdatum; alter berechnen online; alter berechnen datum | /de/age-calculator | alter-berechnen |
| developer tools | json-formatter | json formatieren | json formatieren online; json datei formatieren; json datum formatieren | /de/json-formatter | json-formatieren |
| converters | unit-converter | einheitenumrechner | labor einheitenumrechner; einheitenumrechner geld | /de/unit-converter | einheitenumrechner |

Brands observed (not targets): adobe (4), pdf24 (3), google (2), capcut (1), canva (1), bitwarden (1), notepad (1), vs code (1).

### hi: Hindi (gl=in; hl=hi)

Many Indian users search in English or Hinglish (Roman script), even with hl=hi. Hindi-script completions are mostly how-to questions (`… कैसे करें`). Plan a Hindi page whose title has the Hindi term plus the English term (e.g. `पीडीएफ मर्ज (Merge PDF)`). TikTok is banned in India (since 2020), so `टिकटॉक वीडियो डाउनलोड` is likely low priority even though it is completed.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | पीडीएफ मर्ज | पीडीएफ मर्ज करें; पीडीएफ मर्जर | /hi/pdf-merger | — |
| PDF tools | pdf-compressor | पीडीएफ कंप्रेस | पीडीएफ कंप्रेसर; पीडीएफ कंप्रेसर के लिए 100kb | /hi/pdf-compressor | — |
| PDF tools | pdf-splitter | pdf split (fallback) | pdf splitter; pdf split online; pdf splitter online | /hi/pdf-splitter | — |
| PDF tools | pdf-to-image | पीडीएफ से फोटो | पीडीएफ से फोटो कैसे भेजें | /hi/pdf-to-image | — |
| PDF tools | image-to-pdf | फोटो को पीडीएफ | फोटो को पीडीएफ में कैसे कन्वर्ट करें; फोटो को पीडीएफ में कैसे बदलें; फोटो को पीडीएफ में कैसे बनाएं | /hi/image-to-pdf | — |
| PDF tools | rotate-pdf | pdf rotate (fallback) | pdf rotate page wise; pdf rotate all pages | /hi/rotate-pdf | — |
| image compressor | image-compressor | फोटो का साइज कम | फोटो का साइज कम करें; फोटो का साइज कम कैसे करें; फोटो का साइज कम करने वाला ऐप | /hi/image-compressor | — |
| image converter/resizer/cropper | image-converter | फोटो को jpg | फोटो को jpg में कैसे बदलें | /hi/image-converter | — |
| image converter/resizer/cropper | image-resizer | फोटो रिसाइज | फोटो रिसाइज एप्प; फोटो रिसाइज़; फोटो रिसाइज pdf | /hi/image-resizer | — |
| image converter/resizer/cropper | image-cropper | फोटो क्रॉप | फोटो क्रॉप कैसे करें; फोटो क्रॉप ऑनलाइन; फोटो क्रॉप साइज | /hi/image-cropper | — |
| social downloaders | tiktok-downloader | टिकटॉक वीडियो डाउनलोड | टिकटॉक वीडियो डाउनलोड सेव करें | /hi/tiktok-downloader | — |
| social downloaders | instagram-downloader | instagram reel download (fallback) | instagram downloader viewer; instagram downloader dp; instagram downloader store | /hi/instagram-downloader | — |
| social downloaders | facebook-downloader | फेसबुक वीडियो डाउनलोड | फेसबुक वीडियो डाउनलोड बिना; फेसबुक वीडियो डाउनलोड सॉफ्टवेयर | /hi/facebook-downloader | — |
| social downloaders | x-video-downloader | ट्विटर वीडियो डाउनलोड | ट्विटर वीडियो डाउनलोड करें; ट्विटर वीडियो डाउनलोड लिंक; ट्विटर वीडियो डाउनलोडर ऐप | /hi/x-video-downloader | — |
| video tools | video-audio-extractor | वीडियो से ऑडियो | वीडियो से ऑडियो डाउनलोड; वीडियो से ऑडियो कैसे निकाले; वीडियो से ऑडियो बनाने वाला ऐप | /hi/video-audio-extractor | — |
| video tools | video-frame-extractor | वीडियो से फोटो | वीडियो से फोटो कैसे बनाएं; वीडियो से फोटो बनाने वाला ऐप | /hi/video-frame-extractor | — |
| QR code | qr-code-generator | क्यूआर कोड बनाएं | क्यूआर कोड कैसे बनाएं; क्यूआर कोड स्कैनर कैसे बनाएं; फोटो का क्यूआर कोड बनाएं | /hi/qr-code-generator | — |
| QR code | qr-code-scanner | क्यूआर कोड स्कैन | क्यूआर कोड स्कैनर; क्यूआर कोड स्कैनर कैमरा; क्यूआर कोड स्कैन कैसे करें | /hi/qr-code-scanner | — |
| text tools | word-counter | शब्द गिनती | गिनती शब्द में; गिनती शब्द में प्रत्यय है; गिनती शब्द का तत्सम बताइए | /hi/word-counter | — |
| text tools | password-generator | password generator (fallback) | पासवर्ड जनरेटर; पासवर्ड बनाने के लिए डॉक्यूमेंट; पासवर्ड बनाने का खर्चा | /hi/password-generator | — |
| calculators | percentage-calculator | प्रतिशत कैसे निकाले | प्रतिशत कैसे निकाले calculator; प्रतिशत कैसे निकाले कैलकुलेटर से; प्रतिशत कैसे निकाले बताइए | /hi/percentage-calculator | — |
| calculators | age-calculator | उम्र कैलकुलेटर | उम्र कैलकुलेटर की dob; उम्र कैलकुलेटर app; उम्र वाला कैलकुलेटर | /hi/age-calculator | — |
| developer tools | json-formatter | json formatter | json formatter online; json formatter extension; json formatter and validator | /hi/json-formatter | — |
| converters | unit-converter | unit converter (fallback) | unit converter money; unit converter meter to feet | /hi/unit-converter | — |

Brands observed (not targets): i love pdf (3), chrome (1), notepad++ (1), google (1).

Question-type completions (FAQ and guide topics): `पीडीएफ से फोटो कैसे भेजें`; `फोटो को पीडीएफ में कैसे कन्वर्ट करें`; `फोटो को पीडीएफ में कैसे बदलें`; `फोटो को पीडीएफ में कैसे बनाएं`; `फोटो को पीडीएफ में कैसे भेजें`; `फोटो को पीडीएफ में कैसे डालें`; `फोटो को पीडीएफ बनाकर कैसे भेजें`; `फोटो का साइज कम कैसे करें`; `फोटो को jpg में कैसे बदलें`; `फोटो रिसाइज कैसे करें`.

### id: Indonesian (gl=id; hl=id)

Short verb + object (`gabung pdf`, `kompres pdf`, `kompres foto`). Size targets appear often (`kompres pdf 1 mb`, `ubah ukuran foto 3x4 / 4x6`). They come from upload limits and ID-photo sizes: make these guide topics. `download video …` uses the English loanword `download`.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | gabung pdf | gabung pdf jadi 1; gabung pdf ke pdf; gabung pdf dan foto | /id/pdf-merger | gabung-pdf |
| PDF tools | pdf-compressor | kompres pdf | kompres pdf 1 mb; kompres pdf online; kompres pdf 10 mb | /id/pdf-compressor | kompres-pdf |
| PDF tools | pdf-splitter | pisah pdf | pisah pdf ke jpg; pisah pdf jadi satu satu; pisah pdf online gratis | /id/pdf-splitter | pisah-pdf |
| PDF tools | pdf-to-image | pdf ke jpg | pdf ke jpg hd; pdf ke jpg free; pdf ke jpg online gratis | /id/pdf-to-image | pdf-ke-jpg |
| PDF tools | image-to-pdf | jpg ke pdf | jpg ke pdf gabung; jpg ke pdf gratis online; jpg ke pdf gratis | /id/image-to-pdf | jpg-ke-pdf |
| PDF tools | rotate-pdf | putar pdf | putar pdf gratis; putar pdf landscape ke portrait; putar pdf landscape | /id/rotate-pdf | putar-pdf |
| image compressor | image-compressor | kompres foto | kompres foto jpg; kompres foto 1 mb; kompres foto 10 mb | /id/image-compressor | kompres-foto |
| image converter/resizer/cropper | image-converter | ubah format gambar | ubah format gambar ke jpg; ubah format gambar ke png; ubah format gambar heic ke jpg | /id/image-converter | ubah-format-gambar |
| image converter/resizer/cropper | image-resizer | ubah ukuran foto | ubah ukuran foto jadi 3 x 4; ubah ukuran foto 4x6 online di hp; ubah ukuran foto jadi 1 mb | /id/image-resizer | ubah-ukuran-foto |
| image converter/resizer/cropper | image-cropper | crop foto | crop foto 4×6; crop foto 3x4; crop foto lingkaran | /id/image-cropper | crop-foto |
| social downloaders | tiktok-downloader | download video tiktok | download video tiktok link; download video tiktok teman; download video tiktok no wm | /id/tiktok-downloader | download-video-tiktok |
| social downloaders | instagram-downloader | download video instagram | download video instagram without mark; download reels instagram app | /id/instagram-downloader | download-video-instagram |
| social downloaders | facebook-downloader | download video facebook | download video facebook tanpa aplikasi; download video facebook watermark; download video facebook tanpa watermark | /id/facebook-downloader | download-video-facebook |
| social downloaders | x-video-downloader | download video twitter | download video twitters; download video twitter live; download video twitter gif | /id/x-video-downloader | download-video-twitter |
| video tools | video-audio-extractor | ekstrak audio dari video | ekstrak audio dari video gratis; ekstrak audio dari video online; ekstrak audio dari video tiktok | /id/video-audio-extractor | ekstrak-audio-dari-video |
| video tools | video-frame-extractor | ambil gambar dari video | ambil gambar dari video online; ambil gambar dari video tiktok; cara ambil gambar dari video | /id/video-frame-extractor | ambil-gambar-dari-video |
| QR code | qr-code-generator | buat qr code | buat qr code gratis; buat qr code pembayaran; buat qr code maps | /id/qr-code-generator | buat-qr-code |
| QR code | qr-code-scanner | scan qr code | scan qr code wifi password; scan qr code online; scan qr code for listening audio | /id/qr-code-scanner | scan-qr-code |
| text tools | word-counter | hitung kata | hitung kata online; hitung kata dalam kalimat; hitung kata dalam teks | /id/word-counter | hitung-kata |
| text tools | password-generator | generator password | generator password online; generator password wifi; generator password strong | /id/password-generator | generator-password |
| calculators | percentage-calculator | cara menghitung persen | cara menghitung persentase; cara menghitung persen uang; cara menghitung persen di kalkulator hp | /id/percentage-calculator | menghitung-persen |
| calculators | age-calculator | hitung umur | hitung umur anak; hitung umur kehamilan; hitung umur dari tanggal lahir | /id/age-calculator | hitung-umur |
| developer tools | json-formatter | json formatter | json formatter online; json formatter org; json formatter extension | /id/json-formatter | json-formatter |
| converters | unit-converter | konversi satuan | konversi satuan panjang; konversi satuan massa; konversi satuan berat | /id/unit-converter | konversi-satuan |

Brands observed (not targets): i love pdf (3), capcut (3), google (3), canva (2), chrome (2), ilove (1), love (1), pdf24 (1).

Question-type completions (FAQ and guide topics): `cara ekstrak audio dari video`; `cara ambil gambar dari video`; `cara ambil gambar dari video iphone`; `cara menghitung persen`; `cara menghitung persentase`; `cara menghitung persen uang`; `cara menghitung persen di kalkulator hp`; `cara menghitung persenan di kalkulator`; `cara menghitung persentase kehadiran`; `cara menghitung persentase keuntungan`.

### ar: Arabic (gl=eg, also sa; hl=ar)

Egypt (gl=eg) and Saudi Arabia (gl=sa) completions for the main PDF and image terms are almost the same. Common modifiers: `مجانا`, `اون لاين`, `بدون برامج`, `بدون علامة`, size targets (`الى 1 ميجا`). Use the colloquial spelling `انستقرام` (Saudi and Egyptian usage) for Instagram.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | دمج ملفات pdf | دمج ملفات pdf في ملف واحد; دمج ملفات pdf في ملف واحد مجانًا; دمج ملفات pdf مجانًا | /ar/pdf-merger | — |
| PDF tools | pdf-compressor | ضغط pdf | ضغط pdf مجاني; ضغط pdf على الانترنت. ملف بنفس جودة pdf وبحجم أقل; ضغط pdf إلى 500 كيلو بايت | /ar/pdf-compressor | — |
| PDF tools | pdf-splitter | تقسيم pdf | تقسيم pdf الى اجزاء; تقسيم pdf مجاني; تقسيم pdf الى صفحات | /ar/pdf-splitter | — |
| PDF tools | pdf-to-image | تحويل pdf الى صورة | تحويل pdf الى صورة jpg; تحويل pdf الى صورة عالية الجودة; تحويل pdf الى صورة jpeg | /ar/pdf-to-image | — |
| PDF tools | image-to-pdf | تحويل صورة الى pdf | تحويل صورة الى pdf مجاني; تحويل صورة الى pdf بجودة عالية; تحويل صورة الى pdf حجم صغير | /ar/image-to-pdf | — |
| PDF tools | rotate-pdf | تدوير pdf | تدوير صفحات pdf; تدوير صفحة pdf; تدوير ملف pdf اون لاين | /ar/rotate-pdf | — |
| image compressor | image-compressor | ضغط الصور | ضغط الصور مجانا; ضغط الصورة jpg; ضغط الصورة | /ar/image-compressor | — |
| image converter/resizer/cropper | image-converter | تحويل الصور | تحويل الصور الى pdf; تحويل الصور الى jpg; تحويل الصور الى بي دي اف | /ar/image-converter | — |
| image converter/resizer/cropper | image-resizer | تغيير حجم الصورة | تغيير حجم الصورة إلى 4 * 6; تغيير حجم الصورة بالبكسل; تغيير حجم الصورة jpg | /ar/image-resizer | — |
| image converter/resizer/cropper | image-cropper | قص الصور | قص الصورة بشكل دائري; قص الصور باحترافية; قص الصور بالذكاء الاصطناعي | /ar/image-cropper | — |
| social downloaders | tiktok-downloader | تحميل فيديو تيك توك | تحميل فيديو تيك توك بدون اشعار; تحميل فيديو تيك توك من غير علامه | /ar/tiktok-downloader | — |
| social downloaders | instagram-downloader | تحميل فيديو انستقرام | تحميل فيديو انستقرام بدون برامج; تحميل فيديو انستقرام بدون الشعار; تحميل فيديو انستقرام بدون رمز | /ar/instagram-downloader | — |
| social downloaders | facebook-downloader | تحميل فيديو فيس بوك | تحميل فيديو فيس بوك بدون الشعار | /ar/facebook-downloader | — |
| social downloaders | x-video-downloader | تحميل فيديو تويتر | تحميل فيديو تويتر بدون علامه; تحميل فيديو تويتر مباشر; تحميل فيديو تويتر بدون برامج | /ar/x-video-downloader | — |
| video tools | video-audio-extractor | استخراج الصوت من الفيديو | استخراج الصوت من الفيديو مجانًا; استخراج الصوت من الفيديو اون لاين; استخراج الصوت من الفيديو بدون برنامج | /ar/video-audio-extractor | — |
| video tools | video-frame-extractor | استخراج صورة من فيديو | استخراج صورة من فيديو بدقة عالية; كيفية استخراج صورة من فيديو; موقع استخراج صورة من فيديو | /ar/video-frame-extractor | — |
| QR code | qr-code-generator | انشاء qr code | انشاء qr code لرابط; انشاء qr code للواتس اب; انشاء qr code لصفحة الفيس بوك | /ar/qr-code-generator | — |
| QR code | qr-code-scanner | قراءة qr code | قراءة qr code من الصور; قراءة qr code اون لاين; قراءة qr code online | /ar/qr-code-scanner | — |
| text tools | word-counter | عداد الكلمات | عداد الكلمات عربي; عداد الكلمات والحروف; عداد الكلمات الانجليزية | /ar/word-counter | — |
| text tools | password-generator | مولد كلمات المرور | مولد كلمات المرور واي فاي; مولد كلمات المرور العشوائية; برنامج مولد كلمات المرور | /ar/password-generator | — |
| calculators | percentage-calculator | حساب النسبة المئوية | حساب النسبة المئوية من مبلغ; حساب النسبة المئوية للدرجات; حساب النسبة المئوية بين رقمين | /ar/percentage-calculator | — |
| calculators | age-calculator | حساب العمر | حساب العمر بالميلادي; حساب العمر بالهجري والميلادي; حساب العمر بتاريخ الميلاد | /ar/age-calculator | — |
| developer tools | json-formatter | تنسيق json | ما هو تنسيق json | /ar/json-formatter | — |
| converters | unit-converter | تحويل الوحدات | تحويل الوحدات في الفيزياء; تحويل الوحدات الي نت اورنج; تحويل الوحدات إلى نت فودافون | /ar/unit-converter | — |

Brands observed (not targets): i love pdf (4), ilove (2), ilovepdf (2), i love (2), gemini (1), capcut (1).

Question-type completions (FAQ and guide topics): `كيفية استخراج صورة من فيديو`.

### zh-CN: Chinese (Simplified) (gl=cn; hl=zh-CN)

**Caveat: Google is not the main search engine in mainland China (Baidu, plus Sogou, 360 and Bing CN, lead there), so these Google completions show how Chinese-language users phrase queries but not mainland demand.** Modifiers: `在线`, `工具`, `免费`, `网站`. TikTok, Instagram, Facebook and X are blocked in mainland China. Downloader demand there comes from the diaspora, Taiwan/HK (who mostly use zh-TW) and VPN users: give downloaders zh-CN pages the lowest priority. Douyin (抖音) is a different platform and we do not support it.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | pdf合并 | pdf合并工具; pdf合并免费; pdf合并在线 | /zh-CN/pdf-merger | — |
| PDF tools | pdf-compressor | pdf压缩 | pdf压缩工具; pdf压缩大小; pdf压缩在线 | /zh-CN/pdf-compressor | — |
| PDF tools | pdf-splitter | pdf拆分 | pdf拆分工具; pdf拆分免费; pdf拆分在线 | /zh-CN/pdf-splitter | — |
| PDF tools | pdf-to-image | pdf转图片 | pdf转图片在线; pdf转图片高清; pdf转图片 github | /zh-CN/pdf-to-image | — |
| PDF tools | image-to-pdf | 图片转pdf | 图片转pdf免费; 图片转pdf在线工具; 图片转pdf在线 | /zh-CN/image-to-pdf | — |
| PDF tools | rotate-pdf | pdf旋转 | pdf旋转后储存; pdf旋转后如何保存; pdf旋转后固定 | /zh-CN/rotate-pdf | — |
| image compressor | image-compressor | 图片压缩 | 图片压缩工具; 图片压缩在线; 图片压缩免费 | /zh-CN/image-compressor | — |
| image converter/resizer/cropper | image-converter | 图片格式转换 | 图片格式转换器; 图片格式转换jpg; 图片格式转换 在线 | /zh-CN/image-converter | — |
| image converter/resizer/cropper | image-resizer | 图片调整大小 | 图片调整大小 jpg | /zh-CN/image-resizer | — |
| image converter/resizer/cropper | image-cropper | 图片裁剪 | 图片裁剪在线; 图片裁剪工具; 图片裁剪拼接 | /zh-CN/image-cropper | — |
| social downloaders | tiktok-downloader | tiktok视频下载 | tiktok视频下载网站; tiktok视频下载解析; tiktok视频下载网址 | /zh-CN/tiktok-downloader | — |
| social downloaders | instagram-downloader | instagram下载 | instagram下载照片 | /zh-CN/instagram-downloader | — |
| social downloaders | facebook-downloader | facebook视频下载 | facebook视频下载网站; facebook视频下载软件 | /zh-CN/facebook-downloader | — |
| social downloaders | x-video-downloader | twitter视频下载 | twitter视频下载网页 | /zh-CN/x-video-downloader | — |
| video tools | video-audio-extractor | 视频提取音频 | 视频提取音频github; 视频提取音频在线; 视频提取音频软件 | /zh-CN/video-audio-extractor | — |
| video tools | video-frame-extractor | 视频提取帧 |  | /zh-CN/video-frame-extractor | — |
| QR code | qr-code-generator | 二维码生成 | 二维码生成器; 二维码生成网站; 二维码生成器在线 | /zh-CN/qr-code-generator | — |
| QR code | qr-code-scanner | 二维码识别 | 二维码识别在线; 二维码识别器; 二维码识别工具 | /zh-CN/qr-code-scanner | — |
| text tools | word-counter | 字数统计 | 字数统计器; 字数统计在线; 字数统计工具 | /zh-CN/word-counter | — |
| text tools | password-generator | 密码生成器 | 密码生成器在线; 密码生成器批量; 密码生成器github | /zh-CN/password-generator | — |
| calculators | percentage-calculator | 百分比计算 | 百分比计算器; 百分比计算器在线; 百分比计算公式 | /zh-CN/percentage-calculator | — |
| calculators | age-calculator | 年龄计算 | 年龄计算器; 年龄计算app; 年龄计算 民国 | /zh-CN/age-calculator | — |
| developer tools | json-formatter | json格式化 | json格式化工具; json格式化在线; json格式化解析 | /zh-CN/json-formatter | — |
| converters | unit-converter | 单位换算 | 单位换算器; 单位换算英寸; 单位换算在线 | /zh-CN/unit-converter | — |

Brands observed (not targets): chrome (2), canva (1), google (1), 1password (1).

Question-type completions (FAQ and guide topics): `pdf旋转后如何保存`; `百分比计算方法`; `百分比计算机怎么按`.

### ja: Japanese (gl=jp; hl=ja)

Japanese users type space-separated keyword pairs (`pdf 結合`, `画像 圧縮`). Modifiers: `無料`, `サイト`, `安全`, `フリーソフト`, `スマホ`. `安全` (safe) shows a trust worry. Our in-browser, no-upload processing answers it: say so in the H1 subtitle and in an FAQ. `パスワード 生成` (with a space) returned nothing; `パスワード生成` (no space) did.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | pdf 結合 | pdf 結合 無料; pdf 結合 フリーソフト; pdf 結合 やり方 | /ja/pdf-merger | — |
| PDF tools | pdf-compressor | pdf 圧縮 | pdf 圧縮方法; pdf 圧縮 無料; pdf 圧縮 iphone | /ja/pdf-compressor | — |
| PDF tools | pdf-splitter | pdf 分割 | pdf 分割方法; pdf 分割 無料; pdf 分割 フリーソフト | /ja/pdf-splitter | — |
| PDF tools | pdf-to-image | pdf jpg 変換 | pdf jpg 変換 無料; pdf jpg 変換 フリーソフト; pdf jpg 変換 windows | /ja/pdf-to-image | — |
| PDF tools | image-to-pdf | jpg pdf 変換 | jpg pdf 変換 無料; jpg pdf 変換 フリーソフト; jpg pdf 変換 windows | /ja/image-to-pdf | — |
| PDF tools | rotate-pdf | pdf 回転 | pdf 回転させて保存; pdf 回転 無料; pdf 回転させて保存したい | /ja/rotate-pdf | — |
| image compressor | image-compressor | 画像 圧縮 | 画像 圧縮 無料; 画像 圧縮 iphone; 画像 圧縮 jpg | /ja/image-compressor | — |
| image converter/resizer/cropper | image-converter | 画像 変換 | 画像 変換 jpg; 画像 変換 pdf; 画像 変換 png | /ja/image-converter | — |
| image converter/resizer/cropper | image-resizer | 画像 サイズ 変更 | 画像 サイズ 変更 スマホ; 画像 サイズ 変更 パソコン; 画像 サイズ 変更 無料 | /ja/image-resizer | — |
| image converter/resizer/cropper | image-cropper | 画像 トリミング | 画像 トリミング 自由; 画像 トリミング 自由な形 サイト; 画像 トリミング windows | /ja/image-cropper | — |
| social downloaders | tiktok-downloader | tiktok 動画 保存 | tiktok 動画 保存方法; tiktok 動画 保存 無料; tiktok 動画 保存 アプリ | /ja/tiktok-downloader | — |
| social downloaders | instagram-downloader | インスタ 動画 保存 | インスタ 動画 保存する方法; インスタ 動画 保存 アプリ; インスタ 動画 保存できない | /ja/instagram-downloader | — |
| social downloaders | facebook-downloader | facebook 動画 保存 | facebook 動画 保存したい; facebook 動画 保存 pc; facebook 動画 保存先 | /ja/facebook-downloader | — |
| social downloaders | x-video-downloader | twitter 動画 保存 | twitter 動画 保存 ブラウザ; twitter 動画 保存できない; twitter 動画 保存 ランキング 危ない | /ja/x-video-downloader | — |
| video tools | video-audio-extractor | 動画 音声 抽出 | 動画 音声 抽出 無料; 動画 音声 抽出 アプリ; 動画 音声 抽出 iphone | /ja/video-audio-extractor | — |
| video tools | video-frame-extractor | 動画 静止画 切り出し | 動画 静止画 切り出し android; 動画 静止画 切り出し iphone; 動画 静止画 切り出し mac | /ja/video-frame-extractor | — |
| QR code | qr-code-generator | qrコード 作成 | qrコード 作成 無料; qrコード 作成方法; qrコード 作成者 | /ja/qr-code-generator | — |
| QR code | qr-code-scanner | qrコード 読み取り | qrコード 読み取り 画像; qrコード 読み取り パソコン; qrコード 読み取り スマホ | /ja/qr-code-scanner | — |
| text tools | word-counter | 文字数カウント | 文字数カウント 英語; 文字数カウント サイト; 文字数カウント 原稿用紙 | /ja/word-counter | — |
| text tools | password-generator | パスワード 生成 | パスワード 生成 ランダム; パスワード 生成 方法; パスワード 生成 4 桁 | /ja/password-generator | — |
| calculators | percentage-calculator | パーセント 計算 | パーセント 計算方法; パーセント 計算 割引; パーセント 計算 アプリ | /ja/percentage-calculator | — |
| calculators | age-calculator | 年齢 計算 | 年齢 計算 生年月日; 年齢 計算サイト; 年齢 計算 早見表 | /ja/age-calculator | — |
| developer tools | json-formatter | json 整形 | json 整形 ツール; json 整形 コマンド; json 整形 jq | /ja/json-formatter | — |
| converters | unit-converter | 単位 変換 | 単位 変換 一覧; 単位 変換 サイト; 単位 変換 圧力 | /ja/unit-converter | — |

Brands observed (not targets): adobe (3), google (3), vscode (2), chrome (2), capcut (1).

Question-type completions (FAQ and guide topics): `pdf 結合 やり方`; `pdf 圧縮方法`; `pdf 分割方法`; `jpg pdf 変換する方法`; `画像 圧縮方法`; `qrコード 作成方法`; `qrコード 読み取り方法`; `パスワード 生成 方法`; `パーセント 計算方法`; `パーセント 計算の仕方`.

### ru: Russian (gl=ru; hl=ru)

**Caveat: Yandex is the dominant search engine in Russia. Google data here is only a proxy, so check in Yandex Wordstat and Yandex.Webmaster before committing.** Modifiers: `онлайн`, `бесплатно`, `без потери качества`, `по ссылке`. Instagram and Facebook are blocked in Russia (since 2022), but download queries are still completed.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | объединить pdf | объединить pdf файлы; объединить pdf онлайн; объединить pdf файлы в один | /ru/pdf-merger | — |
| PDF tools | pdf-compressor | сжать pdf | сжать pdf онлайн; сжать pdf файл; сжать pdf без потери качества | /ru/pdf-compressor | — |
| PDF tools | pdf-splitter | разделить pdf | разделить pdf онлайн; разделить pdf на страницы; разделить pdf файл | /ru/pdf-splitter | — |
| PDF tools | pdf-to-image | pdf в jpg | pdf в jpg онлайн; pdf в jpg программа онлайн безкоштовно; pdf в jpg без потери качества | /ru/pdf-to-image | — |
| PDF tools | image-to-pdf | jpg в pdf | jpg в pdf онлайн; jpg в pdf бесплатно; jpg в pdf без потери качества | /ru/image-to-pdf | — |
| PDF tools | rotate-pdf | повернуть pdf | повернуть pdf онлайн; повернуть pdf файл; повернуть pdf и сохранить | /ru/rotate-pdf | — |
| image compressor | image-compressor | сжать фото | сжать фото онлайн; сжать фото без потери качества; сжать фото до 1 мб | /ru/image-compressor | — |
| image converter/resizer/cropper | image-converter | конвертер изображений | конвертер изображений в формат jpg; конвертер изображений в пдф; конвертер изображений в jpeg | /ru/image-converter | — |
| image converter/resizer/cropper | image-resizer | изменить размер фото | изменить размер фото онлайн; изменить размер фото онлайн в пикселях; изменить размер фото в пикселях | /ru/image-resizer | — |
| image converter/resizer/cropper | image-cropper | обрезать фото | обрезать фото онлайн; обрезать фото кругом; обрезать фото онлайн бесплатно | /ru/image-cropper | — |
| social downloaders | tiktok-downloader | скачать видео с тик тока | скачать видео с тик тока без водяного знака приложение; скачать видео с тик тока по ссылке онлайн; скачать видео с тик тока мп4 | /ru/tiktok-downloader | — |
| social downloaders | instagram-downloader | скачать видео с инстаграма | скачать видео с инстаграма по ссылке приложение; скачать видео с инстаграма приложение; скачать видео с инстаграма приложение без водяного знака | /ru/instagram-downloader | — |
| social downloaders | facebook-downloader | скачать видео с фейсбука | скачать видео с фейсбука онлайн; скачать видео с фейсбука по ссылке онлайн; скачать видео с фейсбука по ссылке бесплатно | /ru/facebook-downloader | — |
| social downloaders | x-video-downloader | скачать видео с твиттера | скачать видео с твиттера по ссылке; скачать видео с твиттера онлайн; скачать видео с твиттера бот | /ru/x-video-downloader | — |
| video tools | video-audio-extractor | извлечь звук из видео | извлечь звук из видео онлайн; извлечь звук из видео в мп3; извлечь звук из видео по ссылке | /ru/video-audio-extractor | — |
| video tools | video-frame-extractor | кадр из видео | кадр из видео онлайн; кадр из видео вырезать; кадр из видео без потери качества | /ru/video-frame-extractor | — |
| QR code | qr-code-generator | создать qr код | создать qr код по ссылке; создать qr код онлайн; создать qr код для оплаты | /ru/qr-code-generator | — |
| QR code | qr-code-scanner | сканировать qr код | сканировать qr код по фото; сканировать qr код с картинки; сканировать qr код онлайн | /ru/qr-code-scanner | — |
| text tools | word-counter | счетчик слов | счетчик слов онлайн; счётчик слов в тексте; счетчик слов на английском | /ru/word-counter | — |
| text tools | password-generator | генератор паролей | генератор паролей онлайн; генератор паролей гугл; генератор паролей 8 символов | /ru/password-generator | — |
| calculators | percentage-calculator | калькулятор процентов | калькулятор процентов по вкладу; калькулятор процентов онлайн; калькулятор процентов по 395 | /ru/percentage-calculator | — |
| calculators | age-calculator | калькулятор возраста | калькулятор возраста по дате рождения; калькулятор возраста онлайн; калькулятор возраста по дате | /ru/age-calculator | — |
| developer tools | json-formatter | json форматировать | json форматировать онлайн; форматировать json в строку; 1с форматировать json | /ru/json-formatter | — |
| converters | unit-converter | конвертер величин | конвертер величин давления; конвертер величин онлайн; конвертер величин длины | /ru/unit-converter | — |

Brands observed (not targets): adobe (2), яндекс (1), vs code (1), notepad (1), sublime (1).

Question-type completions (FAQ and guide topics): `pdf в jpg как перевести`.

### bn: Bengali (gl=bd; hl=bn)

Bengali-script queries are mostly how-to queries (`… করার নিয়ম`, `কিভাবে`). For split and rotate the Bengali seeds produced off-topic results (e.g. scripture PDFs), while the English `pdf split` and `rotate pdf` were completed for gl=bd. Use bilingual titles.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | পিডিএফ মার্জ | পিডিএফ মার্জ অনলাইন | /bn/pdf-merger | — |
| PDF tools | pdf-compressor | পিডিএফ ফাইল ছোট করা | পিডিএফ ফাইল ছোট করার নিয়ম | /bn/pdf-compressor | — |
| PDF tools | pdf-splitter | pdf split | শ্রীমৎ ভাগবতম পিডিএফ; লয় ভাগে পিডিএফ; pdf splitter | /bn/pdf-splitter | — |
| PDF tools | pdf-to-image | পিডিএফ থেকে ছবি |  | /bn/pdf-to-image | — |
| PDF tools | image-to-pdf | ছবি থেকে পিডিএফ | ছবি থেকে পিডিএফ ফাইল তৈরি; ছবি থেকে পিডিএফ কনভার্টার; ছবি থেকে পিডিএফ করার নিয়ম | /bn/image-to-pdf | — |
| PDF tools | rotate-pdf | rotate pdf (fallback) | rotate pdf online; rotate pdf pages; rotate pdf online free | /bn/rotate-pdf | — |
| image compressor | image-compressor | ছবির সাইজ কমানো | ছবির সাইজ কমানোর অ্যাপ; ছবির সাইজ কমানোর উপায়; ছবির সাইজ কমানোর যন্ত্র | /bn/image-compressor | — |
| image converter/resizer/cropper | image-converter | ছবি কনভার্ট | ছবি কনভার্টার; ছবি বাংলায় কনভার্ট করুন; ছবি পিডিএফ কনভার্ট | /bn/image-converter | — |
| image converter/resizer/cropper | image-resizer | ছবির সাইজ পরিবর্তন | ফটোশপে ছবির সাইজ পরিবর্তন | /bn/image-resizer | — |
| image converter/resizer/cropper | image-cropper | ছবি ক্রপ | ছবি ক্রপ করার নিয়ম; ছবি ক্রপ করুন; ছবি ক্রপ করা | /bn/image-cropper | — |
| social downloaders | tiktok-downloader | টিকটক ভিডিও ডাউনলোড | টিকটক ভিডিও ডাউনলোড লিংক; টিকটক ভিডিও ডাউনলোড 4k; টিকটক ভিডিও ডাউনলোড hd | /bn/tiktok-downloader | — |
| social downloaders | instagram-downloader | ইনস্টাগ্রাম ভিডিও ডাউনলোড | ইনস্টাগ্রাম ভিডিও ডাউনলোড লিংক; ইনস্টাগ্রাম ভিডিও ডাউনলোড স্টোরি; ইনস্টাগ্রাম ভিডিও ডাউনলোডার অ্যাপ | /bn/instagram-downloader | — |
| social downloaders | facebook-downloader | ফেসবুক ভিডিও ডাউনলোড | ফেসবুক ভিডিও ডাউনলোড অ্যাপ; ফেসবুক ভিডিও ডাউনলোডার অ্যাপ; ফেসবুক ভিডিও ডাউনলোডার অ্যাপ ফ্রি | /bn/facebook-downloader | — |
| social downloaders | x-video-downloader | টুইটার ভিডিও ডাউনলোড | টুইটার ভিডিও ডাউনলোডার | /bn/x-video-downloader | — |
| video tools | video-audio-extractor | ভিডিও থেকে অডিও | ভিডিও থেকে অডিও ডাউনলোড; ভিডিও থেকে অডিও কনভার্টার; ভিডিও থেকে অডিও কনভার্ট | /bn/video-audio-extractor | — |
| video tools | video-frame-extractor | ভিডিও থেকে ছবি | ভিডিও থেকে ছবি তোলার নিয়ম; ভিডিও থেকে ছবি রিমুভ | /bn/video-frame-extractor | — |
| QR code | qr-code-generator | কিউআর কোড তৈরি | কিউআর কোড তৈরি করার নিয়ম; কিউআর কোড তৈরি করা; বাংলা কিউআর কোড তৈরি করার নিয়ম | /bn/qr-code-generator | — |
| QR code | qr-code-scanner | কিউআর কোড স্ক্যান | কিউআর কোড স্ক্যানার; কিউআর কোড স্ক্যান করুন; কিউআর কোড স্ক্যানার অনলাইন | /bn/qr-code-scanner | — |
| text tools | word-counter | শব্দ গণনা | শব্দ গণনা শুরু হয়; শব্দ গণনা শুরু হয় কত খ্রিস্টাব্দে; গণনাবাচক শব্দ কোনগুলো | /bn/word-counter | — |
| text tools | password-generator | পাসওয়ার্ড জেনারেটর | password generator extension; password generator strong | /bn/password-generator | — |
| calculators | percentage-calculator | শতকরা হিসাব | শতকরা হিসাব বের করার নিয়ম; শতকরা হিসাব ক্যালকুলেটর; শতকরা হিসাব কিভাবে বের করে | /bn/percentage-calculator | — |
| calculators | age-calculator | বয়স ক্যালকুলেটর | বয়স ক্যালকুলেটর 2026; বয়স ক্যালকুলেটর ২০২৫; বয়স ক্যালকুলেটর ডাউনলোড | /bn/age-calculator | — |
| developer tools | json-formatter | json formatter | json formatter online; json formatter extension; json formatter and validator | /bn/json-formatter | — |
| converters | unit-converter | একক রূপান্তর | পরিমাপের একক রূপান্তর; একক থেকে শতক রূপান্তর | /bn/unit-converter | — |

Brands observed (not targets): i love pdf (1), chrome (1), notepad++ (1), vscode (1), lastpass (1).

Question-type completions (FAQ and guide topics): `ছবি থেকে পিডিএফ কিভাবে তৈরি করবেন`; `ছবি থেকে পিডিএফ করবো কিভাবে`; `কিভাবে ছবির সাইজ কমানো যায়`; `ভিডিও থেকে অডিও করবো কিভাবে`; `কিউআর কোড স্ক্যান করবো কিভাবে`; `শতকরা হিসাব কিভাবে বের করে`; `শতকরা হিসাব কিভাবে বের করতে হয়`; `ইনস্টাগ্রাম ভিডিও ডাউনলোড করব কিভাবে`.

### ur: Urdu (gl=pk; hl=ur)

Urdu-script seeds returned no completions for most PDF and image tools in gl=pk. The English seeds (and Roman Urdu such as `photo ka size kam kare`, `qr code kaise banaye`) were completed. Pakistani users clearly search in English or Roman Urdu for these tools. An Urdu page should carry the English term in the title. Caution: some Arabic-script completions under hl=ur are Persian, not Urdu (e.g. `تصویر تبدیل به متن`, `تصویر کراپ شده یعنی چه`). The ur primaries for image-converter and image-cropper therefore need native review.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | merge pdf (fallback) | merge pdf files; merge pdf online; merge pdf free | /ur/pdf-merger | — |
| PDF tools | pdf-compressor | compress pdf (fallback) | compress pdf file; compress pdf online; compress pdf free | /ur/pdf-compressor | — |
| PDF tools | pdf-splitter | split pdf (fallback) | split pdf pages; split pdf online; split pdf online free | /ur/pdf-splitter | — |
| PDF tools | pdf-to-image | pdf to jpg (fallback) | pdf to jpg converter; pdf to jpg converter free; pdf to jpg free | /ur/pdf-to-image | — |
| PDF tools | image-to-pdf | jpg to pdf (fallback) | jpg to pdf converter; jpg to pdf converter free; jpg to pdf free | /ur/image-to-pdf | — |
| PDF tools | rotate-pdf | rotate pdf (fallback) | rotate pdf online; rotate pdf pages; rotate pdf pages online | /ur/rotate-pdf | — |
| image compressor | image-compressor | photo ka size kam (fallback) | compress image; compress image to 200kb; compress image size | /ur/image-compressor | — |
| image converter/resizer/cropper | image-converter | تصویر تبدیل | تصویر تبدیل به متن; تصویر تبدیل به پی دی اف; تبدیل تصویر به pdf | /ur/image-converter | — |
| image converter/resizer/cropper | image-resizer | resize image (fallback) | resize image to 20kb; resize image online; resize image to 100kb | /ur/image-resizer | — |
| image converter/resizer/cropper | image-cropper | تصویر کراپ | تصویر کراپ دخترانه; تصویر کراپ شده یعنی چه; کراپ تصویر در پریمیر | /ur/image-cropper | — |
| social downloaders | tiktok-downloader | ٹک ٹاک ویڈیو ڈاؤن لوڈ | ٹک ٹاک ویڈیو ڈاؤن لوڈ ایپ; ٹک ٹاک سے ویڈیو ڈاؤن لوڈ; ٹک ٹاک سے ویڈیو ڈاؤن لوڈ کرنے کا طریقہ | /ur/tiktok-downloader | — |
| social downloaders | instagram-downloader | انسٹاگرام ویڈیو ڈاؤن لوڈ | انسٹاگرام سے ویڈیو ڈاؤن لوڈ کرنے کا طریقہ | /ur/instagram-downloader | — |
| social downloaders | facebook-downloader | فیس بک ویڈیو ڈاؤن لوڈ | فیس بک ویڈیو ڈاؤن لوڈنگ; فیس بک ویڈیو ڈاؤن لوڈ ایپ; فیس بک سے ویڈیو ڈاؤن لوڈ کرنے کا طریقہ | /ur/facebook-downloader | — |
| social downloaders | x-video-downloader | twitter video downloader (fallback) | twitter video downloader without watermark; twitter video downloader app; twitter video downloader 1080p | /ur/x-video-downloader | — |
| video tools | video-audio-extractor | ویڈیو سے آڈیو |  | /ur/video-audio-extractor | — |
| video tools | video-frame-extractor | extract frames from video (fallback) | extract frames from video online; extract frames from video online free; extract frames from video android | /ur/video-frame-extractor | — |
| QR code | qr-code-generator | qr code generator (fallback) | qr code generator free; qr code generator free online; qr code generator online | /ur/qr-code-generator | — |
| QR code | qr-code-scanner | کیو آر کوڈ اسکین کریں | کیو آر کوڈ اسکین کرنے کا طریقہ | /ur/qr-code-scanner | — |
| text tools | word-counter | الفاظ کی گنتی | اردو الفاظ کی گنتی | /ur/word-counter | — |
| text tools | password-generator | password generator (fallback) | password generator 10 characters; password generator free; password generator 8 characters | /ur/password-generator | — |
| calculators | percentage-calculator | فیصد نکالنے کا طریقہ | ڈھائی فیصد نکالنے کا طریقہ; کیلکولیٹر سے فیصد نکالنے کا طریقہ; میراث میں فیصد نکالنے کا طریقہ | /ur/percentage-calculator | — |
| calculators | age-calculator | عمر کیلکولیٹر |  | /ur/age-calculator | — |
| developer tools | json-formatter | json formatter | json formatter online; json formatter extension; json formatter and validator | /ur/json-formatter | — |
| converters | unit-converter | unit converter (fallback) | unit converter calculator; unit converter online; unit converter download | /ur/unit-converter | — |

Brands observed (not targets): i love pdf (5), chrome (3), google (1), canva (1), lastpass (1), notepad++ (1).

Question-type completions (FAQ and guide topics): `کیو آر کوڈ اسکین کرنے کا طریقہ`; `فیصد نکالنے کا طریقہ`; `ڈھائی فیصد نکالنے کا طریقہ`; `کیلکولیٹر سے فیصد نکالنے کا طریقہ`; `میراث میں فیصد نکالنے کا طریقہ`; `ٹک ٹاک سے ویڈیو ڈاؤن لوڈ کرنے کا طریقہ`; `انسٹاگرام سے ویڈیو ڈاؤن لوڈ کرنے کا طریقہ`; `فیس بک سے ویڈیو ڈاؤن لوڈ کرنے کا طریقہ`; `فیس بک سے ویڈیو ڈاؤن لوڈ کرنے کا آسان طریقہ`; `photo ka size kam kaise kare`.

### tr: Turkish (gl=tr; hl=tr)

Verbal-noun forms (`pdf birleştirme`, `resim sıkıştırma`) plus modifiers `ücretsiz`, `programsız`, `nasıl yapılır`. `programsız` (without a program) suits a browser tool: put it in meta descriptions and FAQs.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | pdf birleştirme | pdf birleştirme ücretsiz; pdf birleştirme programı; pdf birleştirme online | /tr/pdf-merger | pdf-birlestirme |
| PDF tools | pdf-compressor | pdf sıkıştırma | pdf sıkıştırma ücretsiz; pdf sıkıştırma programı; pdf sıkıştırma küçültme | /tr/pdf-compressor | pdf-sikistirma |
| PDF tools | pdf-splitter | pdf bölme | pdf bölme ücretsiz; pdf bölme programı; pdf bölme nasıl yapılır | /tr/pdf-splitter | pdf-bolme |
| PDF tools | pdf-to-image | pdf jpg çevirme | pdf jpg çevirme ücretsiz; pdf jpg çevirme programsız; pdf jpg çevirme programı ücretsiz | /tr/pdf-to-image | pdf-jpg-cevirme |
| PDF tools | image-to-pdf | jpg pdf çevirme | jpg pdf çevirme ücretsiz; jpg pdf çevirme birleştirme; jpg pdf çevirme nasıl yapılır | /tr/image-to-pdf | jpg-pdf-cevirme |
| PDF tools | rotate-pdf | pdf döndürme | pdf döndürme ücretsiz; pdf döndürme kısayolu; pdf döndürme nasıl yapılır | /tr/rotate-pdf | pdf-dondurme |
| image compressor | image-compressor | resim sıkıştırma | resim sıkıştırma ücretsiz; resim sıkıştırma jpg; resim sıkıştırma png | /tr/image-compressor | resim-sikistirma |
| image converter/resizer/cropper | image-converter | resim dönüştürme | resim dönüştürme yapay zeka; resim dönüştürme programı; resim pdf dönüştürme | /tr/image-converter | resim-donusturme |
| image converter/resizer/cropper | image-resizer | resim boyutlandırma | resim boyutlandırma ücretsiz; resim boyutlandırma online; resim boyutlandırma programı | /tr/image-resizer | resim-boyutlandirma |
| image converter/resizer/cropper | image-cropper | resim kırpma | resim kırpma programı; resim kırpma online; resim kırpma nasıl yapılır | /tr/image-cropper | resim-kirpma |
| social downloaders | tiktok-downloader | tiktok video indir | tiktok video indir programsız; tiktok video indir online; tiktok video indirme uygulamasız | /tr/tiktok-downloader | tiktok-video-indir |
| social downloaders | instagram-downloader | instagram video indir | instagram video indir logosuz; instagram video indir safe; instagram video indir android | /tr/instagram-downloader | instagram-video-indir |
| social downloaders | facebook-downloader | facebook video indir | facebook video indir programsız; facebook video indirmek | /tr/facebook-downloader | facebook-video-indir |
| social downloaders | x-video-downloader | twitter video indir | twitter video indir programsız; twitter video indir mp4; twitter video indir online | /tr/x-video-downloader | twitter-video-indir |
| video tools | video-audio-extractor | videodan ses çıkarma | videodan ses çıkarma online; videodan ses çıkarma ücretsiz; videodan ses çıkarma programı | /tr/video-audio-extractor | videodan-ses-cikarma |
| video tools | video-frame-extractor | videodan fotoğraf çıkarma | iphone videodan fotoğraf çıkarma | /tr/video-frame-extractor | videodan-fotograf-cikarma |
| QR code | qr-code-generator | qr kod oluşturma | qr kod oluşturma ücretsiz; qr kod oluşturma tarım; qr kod oluşturma free | /tr/qr-code-generator | qr-kod-olusturma |
| QR code | qr-code-scanner | qr kod okuma | qr kod okuma nasıl yapılır; qr kod okuma online; qr kod okuma pc | /tr/qr-code-scanner | qr-kod-okuma |
| text tools | word-counter | kelime sayacı | kelime sayacı hesaplama; kelime sayacı oyunu; kelime sayacı ingilizce | /tr/word-counter | kelime-sayaci |
| text tools | password-generator | şifre oluşturucu | şifre oluşturucu oyunu; şifre oluşturucu 8 karakter; şifre oluşturucu güçlü | /tr/password-generator | sifre-olusturucu |
| calculators | percentage-calculator | yüzde hesaplama | yüzde hesaplama formülü; yüzde hesaplama nasıl yapılır; yüzde hesaplama örnekleri | /tr/percentage-calculator | yuzde-hesaplama |
| calculators | age-calculator | yaş hesaplama | yaş hesaplama 2026; yaş hesaplama ay olarak; yaş hesaplama net | /tr/age-calculator | yas-hesaplama |
| developer tools | json-formatter | json formatter | json formatter online; json formatter nedir; json formatter extension | /tr/json-formatter | json-formatter |
| converters | unit-converter | birim çevirici | birim çevirici basınç; birim çevirici alan; birim çevirici uzunluk | /tr/unit-converter | birim-cevirici |

Brands observed (not targets): adobe (4), ilove (3), chrome (3), ilovepdf (2), love (2), google (2), i love pdf (1), convertio (1).

Question-type completions (FAQ and guide topics): `pdf birleştirme nasıl yapılır`; `pdf sıkıştırma nasıl yapılır`; `pdf bölme nasıl yapılır`; `pdf jpg çevirme nasıl yapılır`; `jpg pdf çevirme nasıl yapılır`; `pdf döndürme nasıl yapılır`; `resim sıkıştırma nasıl yapılır`; `resim boyutlandırma nasıl yapılır`; `resim kırpma nasıl yapılır`; `qr kod oluşturma nasıl yapılır`.

### vi: Vietnamese (gl=vn; hl=vi)

Modifiers: `online`, `miễn phí`, `trên máy tính`, `trên điện thoại`. `ghép file pdf` and `nén ảnh` are clean head terms.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | ghép file pdf | ghép file pdf online; ghép file pdf miễn phí; ghép file pdf - nhập file pdf trực tuyến miễn phí | /vi/pdf-merger | ghep-file-pdf |
| PDF tools | pdf-compressor | nén pdf | nén pdf miễn phí; nén pdf online; nén pdf free | /vi/pdf-compressor | nen-pdf |
| PDF tools | pdf-splitter | tách file pdf | tách file pdf thành nhiều file; tách file pdf - tách các trang từ file pdf của bạn; tách file pdf thành nhiều file pdf nhỏ | /vi/pdf-splitter | tach-file-pdf |
| PDF tools | pdf-to-image | chuyển pdf sang ảnh | chuyển pdf sang ảnh jpg; chuyển pdf sang ảnh online miễn phí; chuyển pdf sang ảnh png | /vi/pdf-to-image | chuyen-pdf-sang-anh |
| PDF tools | image-to-pdf | chuyển ảnh sang pdf | chuyển ảnh sang pdf miễn phí; chuyển ảnh sang pdf online miễn phí; chuyển ảnh sang pdf trên máy tính | /vi/image-to-pdf | chuyen-anh-sang-pdf |
| PDF tools | rotate-pdf | xoay pdf | xoay pdf online; xoay pdf - xoay trang trực tuyến miễn phí; xoay pdf miễn phí | /vi/rotate-pdf | xoay-pdf |
| image compressor | image-compressor | nén ảnh | nén ảnh online; nén ảnh dưới 2mb; nén ảnh thành file pdf | /vi/image-compressor | nen-anh |
| image converter/resizer/cropper | image-converter | chuyển đổi định dạng ảnh | chuyển đổi định dạng ảnh sang jpg; chuyển đổi định dạng ảnh heic sang jpg; chuyển đổi định dạng ảnh sang pdf | /vi/image-converter | chuyen-doi-dinh-dang-anh |
| image converter/resizer/cropper | image-resizer | thay đổi kích thước ảnh | thay đổi kích thước ảnh online; thay đổi kích thước ảnh thành 4x6; thay đổi kích thước ảnh thành 3x4 | /vi/image-resizer | thay-doi-kich-thuoc-anh |
| image converter/resizer/cropper | image-cropper | cắt ảnh | cắt ảnh 4x6 online; cắt ảnh 4x6; cắt ảnh trên máy tính | /vi/image-cropper | cat-anh |
| social downloaders | tiktok-downloader | tải video tiktok | tải video tiktok hd; tải video tiktok về máy tính; tải video tiktok về | /vi/tiktok-downloader | tai-video-tiktok |
| social downloaders | instagram-downloader | tải video instagram | tải video instagram miễn phí; tải video instagram về máy tính; tải video instagram online | /vi/instagram-downloader | tai-video-instagram |
| social downloaders | facebook-downloader | tải video facebook | tải video facebook về máy tính; tải video facebook về máy; tải video facebook về điện thoại | /vi/facebook-downloader | tai-video-facebook |
| social downloaders | x-video-downloader | tải video twitter | tải video twitter miễn phí; tải video twitter hd; tải video twitter về điện thoại | /vi/x-video-downloader | tai-video-twitter |
| video tools | video-audio-extractor | tách âm thanh từ video | tách âm thanh từ video miễn phí; tách âm thanh từ video tiktok; tách âm thanh từ video online | /vi/video-audio-extractor | tach-am-thanh-tu-video |
| video tools | video-frame-extractor | lấy ảnh từ video | lấy ảnh từ video trên iphone; lấy ảnh từ video tiktok; lấy ảnh từ video trên điện thoại | /vi/video-frame-extractor | lay-anh-tu-video |
| QR code | qr-code-generator | tạo mã qr | tạo mã qr cho link; tạo mã qr miễn phí; tạo mã qr code cho link | /vi/qr-code-generator | tao-ma-qr |
| QR code | qr-code-scanner | quét mã qr | quét mã qr trên máy tính; quét mã qr online; quét mã qr code | /vi/qr-code-scanner | quet-ma-qr |
| text tools | word-counter | đếm số từ | đếm số từ 1 đến 100 bằng tiếng anh; đếm số từ online; đếm số từ 1 đến 100 | /vi/word-counter | dem-so-tu |
| text tools | password-generator | tạo mật khẩu | tạo mật khẩu máy tính; tạo mật khẩu cho folder trên máy tính; tạo mật khẩu mạnh | /vi/password-generator | tao-mat-khau |
| calculators | percentage-calculator | tính phần trăm | tính phần trăm online; tính phần trăm của 1 số; tính phần trăm tiền | /vi/percentage-calculator | tinh-phan-tram |
| calculators | age-calculator | tính tuổi | tính tuổi thai; tính tuổi chó; tính tuổi nghỉ hưu | /vi/age-calculator | tinh-tuoi |
| developer tools | json-formatter | format json | format json online; format json beautify; format json online beautiful | /vi/json-formatter | format-json |
| converters | unit-converter | chuyển đổi đơn vị | chuyển đổi đơn vị hành chính; chuyển đổi đơn vị áp suất; chuyển đổi đơn vị tiền tệ | /vi/unit-converter | chuyen-doi-don-vi |

Brands observed (not targets): canva (2), capcut (2), foxit (1), i love pdf (1), ilovepdf (1), pdf 24 (1), notepad++ (1), vscode (1).

### ko: Korean (gl=kr; hl=ko)

**Caveat: Naver is the dominant search engine in South Korea (Google is second). Check terms in Naver's keyword tool (Naver Search Advertising) before committing.** Modifiers: `사이트`, `무료`, `프로그램`. `네이버` appears inside completions. Korean users search Korean terms for PDF and image tools. For TikTok and Facebook downloaders the Korean seeds were weak, and the English forms or `틱톡 다운로드` were completed.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | pdf 합치기 | pdf 합치기 무료 프로그램; pdf 합치기 사이트; pdf 합치기 프로그램 | /ko/pdf-merger | — |
| PDF tools | pdf-compressor | pdf 용량 줄이기 | pdf 용량 줄이기 무료; pdf 용량 줄이기 무료 사이트; pdf 용량 줄이기 사이트 | /ko/pdf-compressor | — |
| PDF tools | pdf-splitter | pdf 분할 | pdf 분할 저장; pdf 분할하기; pdf 분할 무료 | /ko/pdf-splitter | — |
| PDF tools | pdf-to-image | pdf jpg 변환 | pdf jpg 변환 방법; pdf jpg 변환 프로그램; pdf jpg 변환 사이트 | /ko/pdf-to-image | — |
| PDF tools | image-to-pdf | jpg pdf 변환 | jpg pdf 변환 무료; jpg pdf 변환 방법; jpg pdf 변환기 | /ko/image-to-pdf | — |
| PDF tools | rotate-pdf | pdf 회전 | pdf 회전 저장; pdf 회전 후 저장; pdf 회전 후 저장 방법 | /ko/rotate-pdf | — |
| image compressor | image-compressor | 이미지 용량 줄이기 | 이미지 용량 줄이기 사이트; 이미지 용량 줄이기 무료; 이미지 용량 줄이기 프로그램 | /ko/image-compressor | — |
| image converter/resizer/cropper | image-converter | 이미지 변환 | 이미지 변환기; 이미지 변환 사이트; 이미지 변환 프로그램 | /ko/image-converter | — |
| image converter/resizer/cropper | image-resizer | 이미지 크기 조절 | 이미지 크기 조절 사이트; 이미지 크기 조절 png; 이미지 크기 조절 프로그램 | /ko/image-resizer | — |
| image converter/resizer/cropper | image-cropper | 이미지 자르기 | 이미지 자르기 사이트; 이미지 자르기 프로그램; 이미지 자르기 도구 | /ko/image-cropper | — |
| social downloaders | tiktok-downloader | 틱톡 다운로드 (fallback) | tiktok downloader - download tiktok video without watermark; tiktok downloader sort & analytics kolsprite; tiktok downloader github | /ko/tiktok-downloader | — |
| social downloaders | instagram-downloader | 인스타 동영상 다운로드 | 인스타 동영상 다운로드 앱; 인스타 동영상 다운로드 알림; 인스타 동영상 다운로드 확장프로그램 | /ko/instagram-downloader | — |
| social downloaders | facebook-downloader | facebook video downloader (fallback) | facebook video downloader app store; facebook video downloader app install free download; facebook video downloader extension | /ko/facebook-downloader | — |
| social downloaders | x-video-downloader | 트위터 동영상 다운로드 | 트위터 동영상 다운로드 확장프로그램; 트위터 동영상 다운로드 앱; 트위터 동영상 다운로드 방법 | /ko/x-video-downloader | — |
| video tools | video-audio-extractor | 동영상 음원 추출 | 동영상 음원 추출 사이트; 동영상 음원 추출 앱; 동영상 음원 추출 방법 | /ko/video-audio-extractor | — |
| video tools | video-frame-extractor | 동영상 프레임 추출 | 동영상 프레임 추출 사이트; 동영상 프레임 추출 프로그램; 동영상 프레임 추출 앱 | /ko/video-frame-extractor | — |
| QR code | qr-code-generator | qr코드 만들기 | qr코드 만들기 무료; qr코드 만들기 구글; qr코드 만들기 어도비 | /ko/qr-code-generator | — |
| QR code | qr-code-scanner | qr코드 스캔 | qr코드 스캔너; qr코드 스캔하는법; qr코드 스캔 사이트 | /ko/qr-code-scanner | — |
| text tools | word-counter | 글자수 세기 | 글자수 세기 사이트; 글자수 세기 프로그램; 글자수 세기 영어 | /ko/word-counter | — |
| text tools | password-generator | 비밀번호 생성 (fallback) | password generator; password generator online; password generator random | /ko/password-generator | — |
| calculators | percentage-calculator | 퍼센트 계산기 | 퍼센트 계산기 사용법; 퍼센트 계산기 앱; 퍼센트 계산기 - 계산기 | /ko/percentage-calculator | — |
| calculators | age-calculator | 나이 계산기 | 나이 계산기 만; 나이 계산기 년도; 나이 계산기 2025 | /ko/age-calculator | — |
| developer tools | json-formatter | json 포맷 | json 포맷터; json 포맷 정렬; json 포맷 검사 | /ko/json-formatter | — |
| converters | unit-converter | 단위 변환 | 단위 변환기; 단위 변환 계산기; 단위 변환 표 | /ko/unit-converter | — |

Brands observed (not targets): 네이버 (5), ilovepdf (1), lastpass (1), google (1), bitwarden (1), chrome (1).

Question-type completions (FAQ and guide topics): `pdf 합치기 방법`; `pdf jpg 변환 방법`; `jpg pdf 변환 방법`; `pdf 회전 후 저장 방법`; `이미지 크기 조절 방법`; `동영상 음원 추출 방법`; `qr코드 스캔하는법`; `트위터 동영상 다운로드 방법`.

### it: Italian (gl=it; hl=it)

Infinitive verbs (`unire pdf`, `comprimere pdf`). `gratis` and `online` dominate. `i love pdf` is the most frequent brand: record it, never target it.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | unire pdf | unire pdf online; unire pdf gratis; unire pdf online gratis | /it/pdf-merger | unire-pdf |
| PDF tools | pdf-compressor | comprimere pdf | comprimere pdf gratis; comprimere pdf online; comprimere pdf online gratis | /it/pdf-compressor | comprimere-pdf |
| PDF tools | pdf-splitter | dividere pdf | dividere pdf online; dividere pdf gratis; dividere pdf online gratis | /it/pdf-splitter | dividere-pdf |
| PDF tools | pdf-to-image | pdf in jpg | pdf in jpg gratis; pdf in jpg online; pdf in jpg alta risoluzione | /it/pdf-to-image | pdf-in-jpg |
| PDF tools | image-to-pdf | jpg in pdf | jpg in pdf gratis; jpg in pdf gratis online; jpg in pdf online | /it/image-to-pdf | jpg-in-pdf |
| PDF tools | rotate-pdf | ruotare pdf | ruotare pdf online; ruotare pdf gratis; ruotare pdf online gratis | /it/rotate-pdf | ruotare-pdf |
| image compressor | image-compressor | comprimere immagine | comprimere immagine jpg; comprimere immagine png; comprimere immagine gratis | /it/image-compressor | comprimere-immagine |
| image converter/resizer/cropper | image-converter | convertire immagine | convertire immagine in pdf; convertire immagine in pdf gratis; convertire immagine in jpg | /it/image-converter | convertire-immagine |
| image converter/resizer/cropper | image-resizer | ridimensionare immagine | ridimensionare immagine online; ridimensionare immagine in cm; ridimensionare immagine mantenendo proporzioni | /it/image-resizer | ridimensionare-immagine |
| image converter/resizer/cropper | image-cropper | ritagliare immagine | ritagliare immagine contorno; ritagliare immagine online; ritagliare immagine a mano libera | /it/image-cropper | ritagliare-immagine |
| social downloaders | tiktok-downloader | scaricare video tiktok | scaricare video tiktok hd; scaricare video tiktok senza watermark; scaricare video tiktok senza scritta iphone | /it/tiktok-downloader | scaricare-video-tiktok |
| social downloaders | instagram-downloader | scaricare video instagram | scaricare video instagram tramite link; scaricare video instagram senza watermark; scaricare video instagram link | /it/instagram-downloader | scaricare-video-instagram |
| social downloaders | facebook-downloader | scaricare video facebook | scaricare video facebook gratis; scaricare video facebook privati; scaricare video facebook hd | /it/facebook-downloader | scaricare-video-facebook |
| social downloaders | x-video-downloader | scaricare video twitter | scaricare video twitter gratis; scaricare video twitter iphone; scaricare video da twitter x | /it/x-video-downloader | scaricare-video-twitter |
| video tools | video-audio-extractor | estrarre audio da video | estrarre audio da video iphone; estrarre audio da video android; estrarre audio da video con vlc | /it/video-audio-extractor | estrarre-audio-da-video |
| video tools | video-frame-extractor | estrarre fotogramma da video | estrarre fotogramma da video iphone; estrarre fotogramma da video android; estrarre fotogramma da video online | /it/video-frame-extractor | estrarre-fotogramma-da-video |
| QR code | qr-code-generator | creare qr code | creare qr code gratis; creare qr code da link; creare qr code gratis senza scadenza | /it/qr-code-generator | creare-qr-code |
| QR code | qr-code-scanner | leggere qr code | leggere qr code da foto; leggere qr code da pc; leggere qr code con iphone | /it/qr-code-scanner | leggere-qr-code |
| text tools | word-counter | conta parole | conta parole online; conta parole testo; conta parole pdf | /it/word-counter | conta-parole |
| text tools | password-generator | generatore password | generatore password sicure; generatore password casuali; generatore password 8 caratteri | /it/password-generator | generatore-password |
| calculators | percentage-calculator | calcolo percentuale | calcolo percentuale online; calcolo percentuale di un numero; calcolo percentuale tra due numeri | /it/percentage-calculator | calcolo-percentuale |
| calculators | age-calculator | calcolo età | calcolo età pensione; calcolo età anagrafica; calcolo età cani | /it/age-calculator | calcolo-eta |
| developer tools | json-formatter | json formatter | json formatter online; json formatter & validator; json formatter extension | /it/json-formatter | json-formatter |
| converters | unit-converter | convertitore unità di misura | convertitore unità di misura peso; convertitore unità di misura lunghezza; convertitore unità di misura litri | /it/unit-converter | convertitore-unita-di-misura |

Brands observed (not targets): i love pdf (7), google (3), canva (2), convertio (1), whatsapp (1), capcut (1), norton (1), notepad++ (1).

### nl: Dutch (gl=nl; hl=nl)

`pdf samenvoegen` and `pdf verkleinen` (verkleinen, not *comprimeren*, for size reduction) are completed; so is `foto verkleinen`. `gratis` and `online` dominate. Adobe and Canva are frequent brands.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | pdf samenvoegen | pdf samenvoegen gratis; pdf samenvoegen gratis online; pdf samenvoegen online | /nl/pdf-merger | pdf-samenvoegen |
| PDF tools | pdf-compressor | pdf verkleinen | pdf verkleinen gratis; pdf verkleinen online gratis; pdf verkleinen mac | /nl/pdf-compressor | pdf-verkleinen |
| PDF tools | pdf-splitter | pdf splitsen | pdf splitsen gratis; pdf splitsen gratis online; pdf splitsen per pagina | /nl/pdf-splitter | pdf-splitsen |
| PDF tools | pdf-to-image | pdf naar jpg | pdf naar jpg gratis; pdf naar jpg converteren; pdf naar jpg - gratis online | /nl/pdf-to-image | pdf-naar-jpg |
| PDF tools | image-to-pdf | jpg naar pdf | jpg naar pdf gratis; jpg naar pdf converter; jpg naar pdf gratis online | /nl/image-to-pdf | jpg-naar-pdf |
| PDF tools | rotate-pdf | pdf draaien | pdf draaien en opslaan; pdf draaien sneltoets; pdf draaien gratis | /nl/rotate-pdf | pdf-draaien |
| image compressor | image-compressor | foto verkleinen | foto verkleinen mb; foto verkleinen iphone; foto verkleinen gratis | /nl/image-compressor | foto-verkleinen |
| image converter/resizer/cropper | image-converter | afbeelding converteren | afbeelding converteren naar pdf; afbeelding converteren naar jpg; afbeelding converteren naar svg | /nl/image-converter | afbeelding-converteren |
| image converter/resizer/cropper | image-resizer | afbeelding formaat wijzigen | afbeelding formaat wijzigen online; afbeelding formaat wijzigen photoshop; afbeelding formaat wijzigen windows 11 | /nl/image-resizer | afbeelding-formaat-wijzigen |
| image converter/resizer/cropper | image-cropper | foto bijsnijden | foto bijsnijden macbook; foto bijsnijden iphone; foto bijsnijden samsung | /nl/image-cropper | foto-bijsnijden |
| social downloaders | tiktok-downloader | tiktok video downloaden | tiktok video downloaden zonder watermerk; tiktok video downloaden 4k; tiktok video downloaden android | /nl/tiktok-downloader | tiktok-video-downloaden |
| social downloaders | instagram-downloader | instagram video downloaden | instagram video downloaden android; instagram video downloaden app; instagram video downloaden ios | /nl/instagram-downloader | instagram-video-downloaden |
| social downloaders | facebook-downloader | facebook video downloaden | facebook video downloaden android; facebook video downloaden zonder watermerk; facebook video downloaden pc | /nl/facebook-downloader | facebook-video-downloaden |
| social downloaders | x-video-downloader | twitter video downloaden | twitter video downloaden online | /nl/x-video-downloader | twitter-video-downloaden |
| video tools | video-audio-extractor | audio uit video halen | audio uit video halen iphone; audio uit video halen gratis; audio uit video halen samsung | /nl/video-audio-extractor | audio-uit-video-halen |
| video tools | video-frame-extractor | foto uit video halen | foto uit video halen iphone; foto uit video halen android; foto uit video halen samsung | /nl/video-frame-extractor | foto-uit-video-halen |
| QR code | qr-code-generator | qr code maken | qr code maken gratis; qr code maken voor betaling; qr code maken van link | /nl/qr-code-generator | qr-code-maken |
| QR code | qr-code-scanner | qr code scannen | qr code scannen van foto; qr code scannen laptop; qr code scannen samsung | /nl/qr-code-scanner | qr-code-scannen |
| text tools | word-counter | woorden tellen | woorden tellen online; woorden tellen pages; woorden tellen pdf | /nl/word-counter | woorden-tellen |
| text tools | password-generator | wachtwoord generator | wachtwoord generator gratis; wachtwoord generator met woorden; wachtwoord generator windows | /nl/password-generator | wachtwoord-generator |
| calculators | percentage-calculator | procent berekenen | procent berekenen formule; procent berekenen van bedrag; procent berekenen korting | /nl/percentage-calculator | procent-berekenen |
| calculators | age-calculator | leeftijd berekenen | leeftijd berekenen geboortedatum; leeftijd berekenen op datum; leeftijd berekenen tussen twee data | /nl/age-calculator | leeftijd-berekenen |
| developer tools | json-formatter | json formatter | json formatter online; json formatter s; json formatter & validator | /nl/json-formatter | json-formatter |
| converters | unit-converter | eenheden omrekenen | eenheden omrekenen oefenen; eenheden omrekenen tabel; eenheden omrekenen scheikunde | /nl/unit-converter | eenheden-omrekenen |

Brands observed (not targets): adobe (7), canva (4), google (2), ilovepdf (1), i love pdf (1), convertio (1), whatsapp (1), capcut (1).

Question-type completions (FAQ and guide topics): `hoe audio uit video halen`.

### th: Thai (gl=th; hl=th)

Modifiers: `ฟรี`, `ออนไลน์`, size limits (`ไม่เกิน … mb`), `ไม่มีลายน้ำ` (no watermark). Thai users write the English file type inside Thai phrases (`รวมไฟล์ pdf`). Instagram is shortened to `ig` (`โหลดคลิป ig`).

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | รวมไฟล์ pdf | รวมไฟล์ pdf ฟรี; รวมไฟล์ pdf เป็นไฟล์เดียว; รวมไฟล์ pdf และ jpg | /th/pdf-merger | — |
| PDF tools | pdf-compressor | ลดขนาดไฟล์ pdf | ลดขนาดไฟล์ pdf ฟรี; ลดขนาดไฟล์ pdf ไม่เกิน 2 mb ฟรี; ลดขนาดไฟล์ pdf ไม่เกิน 5 mb ฟรี | /th/pdf-compressor | — |
| PDF tools | pdf-splitter | แยกไฟล์ pdf | แยกไฟล์ pdf ฟรี; แยกไฟล์ pdf เป็น jpg; แยกไฟล์ pdf เป็นรูป | /th/pdf-splitter | — |
| PDF tools | pdf-to-image | แปลง pdf เป็น jpg | แปลง pdf เป็น jpg ฟรี; แปลง pdf เป็น jpg แยกรูปภาพออกจาก pdf; แปลง pdf เป็น jpg ฟรี ไม่ จํา กัด | /th/pdf-to-image | — |
| PDF tools | image-to-pdf | แปลง jpg เป็น pdf | แปลง jpg เป็น pdf ฟรี; แปลง jpg เป็น pdf ในคอม; แปลง jpg เป็น pdf แปลงรูปภาพ jpg เป็น pdf ออนไลน์ | /th/image-to-pdf | — |
| PDF tools | rotate-pdf | หมุน pdf | หมุน pdf บางหน้า; หมุน pdf ฟรี; หมุน pdf ทีละหน้า | /th/rotate-pdf | — |
| image compressor | image-compressor | ลดขนาดรูป | ลดขนาดรูปภาพ; ลดขนาดรูปภาพ jpg; ลดขนาดรูปภาพ ฟรี | /th/image-compressor | — |
| image converter/resizer/cropper | image-converter | แปลงไฟล์รูป | แปลงไฟล์รูปเป็น pdf; แปลงไฟล์รูปเป็น jpg; แปลงไฟล์รูปเป็น pdf ฟรี | /th/image-converter | — |
| image converter/resizer/cropper | image-resizer | ปรับขนาดรูป | ปรับขนาดรูปภาพ; ปรับขนาดรูป jpg ให้ เล็กลง ฟรี; ปรับขนาดรูป jpg | /th/image-resizer | — |
| image converter/resizer/cropper | image-cropper | ครอปรูป | ครอปรูปเป็นวงกลม; ครอปรูปในคอม; ครอปรูปใน mac | /th/image-cropper | — |
| social downloaders | tiktok-downloader | โหลดวิดีโอ tiktok | โหลดวิดีโอ tiktok แบบไม่มีลายน้ํา; โหลดวิดีโอ tiktok ฟรี; โหลดวิดีโอ tiktok จีน ไม่มี ลายน้ํา | /th/tiktok-downloader | — |
| social downloaders | instagram-downloader | โหลดคลิป ig (fallback) | โหลดคลิป ig มีลายน้ํา; โหลดคลิป ig ส่วนตัว | /th/instagram-downloader | — |
| social downloaders | facebook-downloader | โหลดวิดีโอ facebook | โหลดวิดีโอ facebook ลงคอม | /th/facebook-downloader | — |
| social downloaders | x-video-downloader | โหลดวิดีโอ twitter | โหลดวิดีโอ twitter ออนไลน์; โหลดวิดีโอ twitter ไม่มีลายน้ํา; โหลดวิดีโอ twitter pc | /th/x-video-downloader | — |
| video tools | video-audio-extractor | แยกเสียงจากวิดีโอ | แยกเสียงจากวิดีโอ ฟรี; แยกเสียงจากวิดีโอ mp4; แยกเสียงจากวิดีโอ mp4 ฟรี | /th/video-audio-extractor | — |
| video tools | video-frame-extractor | แคปภาพจากวิดีโอ | แคปภาพจากวิดีโอ iphone | /th/video-frame-extractor | — |
| QR code | qr-code-generator | สร้าง qr code | สร้าง qr code ฟรี; สร้าง qr code pdf ฟรี; สร้าง qr code generator | /th/qr-code-generator | — |
| QR code | qr-code-scanner | สแกน qr code | สแกน qr code ในคอม; สแกน qr code จากภาพ; สแกน qr code ฟรี | /th/qr-code-scanner | — |
| text tools | word-counter | นับคํา (fallback) | นับคําภาษาอังกฤษ; นับคําออนไลน์; นับคําตัวอักษร | /th/word-counter | — |
| text tools | password-generator | สร้างรหัสผ่าน | สร้างรหัสผ่านที่รัดกุม; สร้างรหัสผ่านใหม่; สร้างรหัสผ่านแบบสุ่ม | /th/password-generator | — |
| calculators | percentage-calculator | คิดเปอร์เซ็นต์ | คิดเปอร์เซ็นต์ยังไง; คิดเปอร์เซ็นต์เงินเดือน; คิดเปอร์เซ็นต์ออนไลน์ | /th/percentage-calculator | — |
| calculators | age-calculator | คํานวณอายุ | คํานวณอายุราชการ; คํานวณอายุงาน; คํานวณอายุจากวันเกิด | /th/age-calculator | — |
| developer tools | json-formatter | json formatter | json formatter.org; json formatter online; json formatter & validator | /th/json-formatter | — |
| converters | unit-converter | แปลงหน่วย | แปลงหน่วย cm เป็น นิ้ว; แปลงหน่วย นิ้ว เป็น mm; แปลงหน่วยนิ้วเป็นเซนติเมตร | /th/unit-converter | — |

Brands observed (not targets): canva (3), capcut (3), google (2), chrome (2), i love pdf (1), ilovepdf (1), vscode (1), notepad (1).

### sw: Swahili (gl=ke, also tz; hl=sw)

Swahili-language completions are sparse and mostly `jinsi ya …` (how to) questions. Kenyan (gl=ke) and Tanzanian (gl=tz) results overlap for the PDF and image phrases. TZ adds `namna ya …` and local payment phrases (`lipa namba` QR). English terms (`pdf to jpg`, `tiktok downloader`) were completed under hl=sw. Many Kenyan users search tools in English, so a Swahili page should keep the English term in the title.

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | kuunganisha pdf | namna ya kuunganisha pdf | /sw/pdf-merger | kuunganisha-pdf |
| PDF tools | pdf-compressor | kupunguza ukubwa wa pdf | kupunguza ukubwa wa file pdf chini ya mb 400; jinsi ya kupunguza ukubwa wa pdf; jinsi ya kupunguza ukubwa wa file pdf | /sw/pdf-compressor | kupunguza-ukubwa-wa-pdf |
| PDF tools | pdf-splitter | kugawanya pdf | kugawanya sehemu pdf; kugawanya sehemu mchanganyiko pdf; hesabu za kugawanya pdf | /sw/pdf-splitter | kugawanya-pdf |
| PDF tools | pdf-to-image | pdf to jpg (fallback) | pdf to jpg converter; pdf to jpg free; pdf to jpg converter free | /sw/pdf-to-image | pdf-to-jpg |
| PDF tools | image-to-pdf | kubadilisha picha kuwa pdf | jinsi ya kubadilisha picha kuwa pdf | /sw/image-to-pdf | picha-kuwa-pdf |
| PDF tools | rotate-pdf | rotate pdf (fallback) | rotate pdf online; rotate pdf pages; rotate pdf online free | /sw/rotate-pdf | rotate-pdf |
| image compressor | image-compressor | kupunguza ukubwa wa picha | jinsi ya kupunguza ukubwa wa picha; app ya kupunguza ukubwa wa picha | /sw/image-compressor | kupunguza-ukubwa-wa-picha |
| image converter/resizer/cropper | image-converter | kubadilisha picha | kubadilisha picha nida; nataka kubadilisha picha; jinsi ya kubadilisha picha facebook | /sw/image-converter | kubadilisha-picha |
| image converter/resizer/cropper | image-resizer | resize image (fallback) | resize image online; resize image to 195kb; resize image online free | /sw/image-resizer | resize-image |
| image converter/resizer/cropper | image-cropper | kukata picha | jinsi ya kukata picha | /sw/image-cropper | kukata-picha |
| social downloaders | tiktok-downloader | tiktok downloader (fallback) | tiktok downloader - download tiktok video without watermark; tiktok downloader without watermark hd; tiktok downloader app install | /sw/tiktok-downloader | tiktok-downloader |
| social downloaders | instagram-downloader | kupakua video instagram | jinsi ya kupakua video instagram | /sw/instagram-downloader | kupakua-video-instagram |
| social downloaders | facebook-downloader | kupakua video za facebook | jinsi ya kupakua video facebook; namna ya kupakua video facebook | /sw/facebook-downloader | kupakua-video-facebook |
| social downloaders | x-video-downloader | twitter video downloader (fallback) | twitter video downloader app; twitter video downloader without watermark; twitter video downloader apk | /sw/x-video-downloader | twitter-video-downloader |
| video tools | video-audio-extractor | kutoa sauti kwenye video | jinsi ya kutoa sauti kwenye video | /sw/video-audio-extractor | kutoa-sauti-kwenye-video |
| video tools | video-frame-extractor | extract frames from video (fallback) | extract frames from video online; extract frames from video online free; extract frames from video android | /sw/video-frame-extractor | extract-frames-from-video |
| QR code | qr-code-generator | kutengeneza qr code | jinsi ya kutengeneza qr code; jinsi ya kutengeneza qr code ya lipa namba | /sw/qr-code-generator | kutengeneza-qr-code |
| QR code | qr-code-scanner | kuscan qr code | jinsi ya kuscan qr code | /sw/qr-code-scanner | kuscan-qr-code |
| text tools | word-counter | kuhesabu maneno | namna ya kuhesabu maneno; jinsi ya kuhesabu maneno kwenye insha; jinsi ya kuhesabu maneno | /sw/word-counter | kuhesabu-maneno |
| text tools | password-generator | neno la siri | neno la siri ni nini; neno la siri in english; neno la siri facebook | /sw/password-generator | neno-la-siri |
| calculators | percentage-calculator | asilimia | asilimia in english; asilimia za pepmis; asilimia ni nini | /sw/percentage-calculator | asilimia |
| calculators | age-calculator | kukokotoa umri (weak) | kukokotoa umri wa mimba; jinsi ya kukokotoa umri wa mimba na uly clinic | /sw/age-calculator | kukokotoa-umri |
| developer tools | json-formatter | json formatter | json formatters; json formatter online; free online json formatter | /sw/json-formatter | json-formatter |
| converters | unit-converter | unit converter (fallback) | unit converter weight; unit converter list; unit converter length | /sw/unit-converter | unit-converter |

Brands observed (not targets): i love pdf (4), whatsapp (2), chrome (2), ilovepdf (1), adobe (1), google (1), vscode (1).

Question-type completions (FAQ and guide topics): `jinsi ya kupunguza ukubwa wa pdf`; `jinsi ya kupunguza ukubwa wa file pdf`; `jinsi ya kubadilisha picha kuwa pdf`; `jinsi ya kupunguza ukubwa wa picha`; `jinsi ya kubadilisha picha facebook`; `jinsi ya kubadilisha picha`; `jinsi ya kukata picha`; `jinsi ya kutoa sauti kwenye video`; `jinsi ya kutengeneza qr code`; `jinsi ya kutengeneza qr code ya lipa namba`.

### en: English (comparison) (gl=us, also gb, in; hl=en)

Baseline. `free`, `online`, `without watermark` and size targets (`compress pdf to 200kb`, `compress image to 50kb`) dominate. gb and in match us for head terms. India adds `of marks` (percentage) and `kaise nikale` (Hinglish), and has more size-target long tail (`compress pdf to 100kb/200kb`).

| Cluster | Tool | Primary | Alternatives | Landing page | Local slug |
|---|---|---|---|---|---|
| PDF merger | pdf-merger | merge pdf (fallback) | merge pdf free; merge pdf files; merge pdf online free | /pdf-merger | — |
| PDF tools | pdf-compressor | compress pdf (fallback) | compress pdf free; compress pdf file; compress pdf file size | /pdf-compressor | — |
| PDF tools | pdf-splitter | split pdf (fallback) | split pdf online free; split pdf free; split pdf pages | /pdf-splitter | — |
| PDF tools | pdf-to-image | pdf to jpg (fallback) | pdf to jpg converter; pdf to jpg free; pdf to jpg free converter | /pdf-to-image | — |
| PDF tools | image-to-pdf | jpg to pdf (fallback) | jpg to pdf converter; jpg to pdf converter free; jpg to pdf free | /image-to-pdf | — |
| PDF tools | rotate-pdf | rotate pdf (fallback) | rotate pdf free; rotate pdf pages; rotate pdf online | /rotate-pdf | — |
| image compressor | image-compressor | compress image (fallback) | compress image size; compress image free; compress image online | /image-compressor | — |
| image converter/resizer/cropper | image-converter | image converter (fallback) | image converter to jpg; image converter to png; image converter to pdf | /image-converter | — |
| image converter/resizer/cropper | image-resizer | resize image (fallback) | resize image online; resize image online free; resize image free | /image-resizer | — |
| image converter/resizer/cropper | image-cropper | crop image (fallback) | crop image online; crop image on mac; crop image photoshop | /image-cropper | — |
| social downloaders | tiktok-downloader | tiktok downloader (fallback) | tiktok downloader no watermark; tiktok downloader free; tiktok downloader app | /tiktok-downloader | — |
| social downloaders | instagram-downloader | instagram downloader (fallback) | instagram downloader pfp; instagram downloader without watermark; instagram downloader with watermark | /instagram-downloader | — |
| social downloaders | facebook-downloader | facebook video downloader (fallback) | facebook video downloader online without watermark; facebook video downloader private without watermark; facebook video downloader application | /facebook-downloader | — |
| social downloaders | x-video-downloader | twitter video downloader (fallback) | twitter video downloader iphone; twitter video downloader app; twitter video downloader extension | /x-video-downloader | — |
| video tools | video-audio-extractor | extract audio from video (fallback) | extract audio from video iphone; extract audio from video link; extract audio from video online free | /video-audio-extractor | — |
| video tools | video-frame-extractor | extract frames from video (fallback) | extract frames from video android; extract frames from video ffmpeg; extract frames from video online free | /video-frame-extractor | — |
| QR code | qr-code-generator | qr code generator (fallback) | qr code generator free; qr code generator free no expiration; qr code generator free online | /qr-code-generator | — |
| QR code | qr-code-scanner | qr code scanner (fallback) | qr code scanner from image; qr code scanner app; qr code scanner online | /qr-code-scanner | — |
| text tools | word-counter | word counter (fallback) | word counter free; word counter online; word counter tool | /word-counter | — |
| text tools | password-generator | password generator (fallback) | password generator 12 characters; password generator 15 characters; password generator 8 characters | /password-generator | — |
| calculators | percentage-calculator | percentage calculator (fallback) | percentage calculator online; percentage calculator increase; percentage calculator money | /percentage-calculator | — |
| calculators | age-calculator | age calculator (fallback) | age calculator based on birthday; age calculator from date to date; age calculator online | /age-calculator | — |
| developer tools | json-formatter | json formatter (fallback) | json formatter online; json formatter and validator; json formatter extension | /json-formatter | — |
| converters | unit-converter | unit converter (fallback) | unit converter calculator; unit converter weight; unit converter money | /unit-converter | — |
| social downloaders | pinterest-downloader | pinterest video downloader (fallback) | pinterest video downloader free; pinterest video downloader without watermark; pinterest video downloader extension | /pinterest-downloader | — |
| video tools | video-info | video info (fallback) | video information; video information system; video infographic | /video-info | — |
| converters | color-converter | hex to rgb (fallback) | hex to rgba; hex to rgb converter; hex to rgba converter | /color-converter | — |
| converters | timestamp-converter | unix timestamp converter (fallback) | unix timestamp converter discord; unix timestamp converter online; unix timestamp converter python | /timestamp-converter | — |
| converters | number-base-converter | binary to decimal (fallback) | binary to decimal converter; binary to decimal conversion; binary to decimal calculator | /number-base-converter | — |
| converters | time-zone-converter | time zone converter (fallback) | time zone converter discord; time zone converter calculator; time zone converter chart | /time-zone-converter | — |
| text tools | case-converter | case converter (fallback) | case converter tool; case converter online; case converter free | /case-converter | — |
| calculators | bmi-calculator | bmi calculator (fallback) | bmi calculator women; bmi calculator men; bmi calculator male | /bmi-calculator | — |
| calculators | loan-calculator | loan calculator (fallback) | loan calculator car; loan calculator personal; loan calculator auto | /loan-calculator | — |
| developer tools | base64-encoder-decoder | base64 decode (fallback) | base64 decode online; base64 decode linux; base64 decode command | /base64-encoder-decoder | — |

Brands observed (not targets): google (10), i love pdf (6), adobe (6), canva (5), chrome (4), firefox (1), capcut (1), lastpass (1).

Question-type completions (FAQ and guide topics): `percentage calculator kaise nikale`.

## 7. FAQ and guide topic ideas (derived from suggestions)

These come from recurring completion patterns across locales. Each should be an FAQ on the matching tool page, or a guide under `/guides`, and it must be accurate for our tools:

- **Size targets** (`compress pdf to 200kb/100kb/1mb`, `compress image to 50kb/20kb`, `kompres pdf 1 mb`, `comprimir imagem para 70k`, `ضغط pdf الى 1 ميجا`, `ลดขนาด … ไม่เกิน … mb`). Guide: "How to compress a PDF/photo to a specific size (e.g. for online application forms)". This is strongest in en-IN, id, pt-BR, ar and th.
- **ID and passport photo sizes** (`ubah ukuran foto 3x4 / 4x6`, `تغيير حجم الصورة إلى 4 * 6`). Guide on resizing and cropping to exact pixel or cm dimensions (image-resizer and image-cropper).
- **How-to phrasing in local languages** (`… कैसे करें`, `… করার নিয়ম`, `jinsi ya …`, `nasıl yapılır`, `やり方/方法`, `방법`, `cara …`). Write step-by-step "How to merge/compress … on phone/PC" sections. The how-to framing is the main entry point in hi, bn, ur and sw.
- **Device modifiers** (`iphone`, `android`, `windows`, `mac`, `スマホ`, `trên điện thoại`, `handy`, `ohne app`, `sin programa`, `programsız`, `بدون برامج`). FAQ: "Does it work on iPhone/Android? Do I need to install anything?" Answer: it runs in the browser, with no install.
- **Safety and privacy** (`安全`, `without sign up`, `ohne Anmeldung`, `sans inscription`). FAQ: "Are my files uploaded?" Answer: browser tools process locally.
- **Quality** (`sin perder calidad`, `без потери качества`, `high quality`, `بجودة عالية`). FAQ on lossless vs. image-based PDF compression (the PDF compressor offers both).
- **Downloaders:** `without watermark` / `sin marca de agua` / `ohne Wasserzeichen` / `بدون علامة` / `ไม่มีลายน้ำ`. FAQ, honest per platform-status: TikTok gives a clean file when TikTok provides one. Also `by link` / `por enlace` / `по ссылке`, `HD`, `on iPhone`. Stories and private posts are not supported: say so.
- **Percentage:** `of marks` (en-IN), `de descuento`, `من مبلغ`, `bei Erhöhung`. Worked examples on the percentage calculator page.
- **QR:** `de un enlace/link`, `para whatsapp`, `wifi`, `lipa namba` (TZ payments), `no expiration`. FAQ "Do the QR codes expire?" (static codes do not). Link to the Wi-Fi QR generator.
- **Age:** `con fecha de nacimiento`, `بالهجري والميلادي` (Hijri and Gregorian, ar). Check whether the age calculator supports Hijri; if not, that is a product gap, not a page.

## 8. Regional variations observed

- **es-ES vs es-MX:** the head terms are the same (`unir pdf`, `comprimir pdf`, `comprimir imagenes`, `generar codigo qr`, `calcular porcentaje`). MX adds `en uno solo`, `para whatsapp`, `de ubicacion`, `que no caduque`, and *sin letras* / *sin firma* (TikTok). ES adds `ilovepdf` variants and `de un enlace`. One es page can serve both. Use neutral wording ("enlace" works for both; MX also uses "link").
- **ar-EG vs ar-SA:** the PDF and image completions are nearly identical (`دمج ملفات pdf في ملف واحد`, `ضغط pdf مجاني`, size targets in `ميجا`/`كيلو بايت`). SA shows more `i love pdf` brand completions and `للواتس اب` (QR). Percentage queries add `في excel` in SA. One Modern Standard Arabic page fits both. No es/ar country split is needed for these tools.
- **sw-KE vs sw-TZ:** completions are sparse in both. TZ completes the Swahili PDF and image phrases (`kuunganisha pdf`, `jinsi ya kupunguza ukubwa wa picha`) and adds `lipa namba` (QR payment). Neither returned completions for `kupakua video tiktok`. Kenyan queries lean on English and Sheng-style loanwords (`kudownload`, `kuscan`). Use Swahili headings with the English term next to them.
- **en-US vs en-GB vs en-IN:** same head terms. en-IN has more size-target and Hinglish long tail (`percentage calculator kaise nikale`, `of marks`) and `tiktok downloader apk/app` despite the ban.
- **hi / bn / ur:** script choice matters more than country. Users mix the native script with English and Roman script, so titles should be bilingual.

## 9. Search-engine caveats

- **China (zh-CN):** Baidu is the main engine in mainland China, and Google is largely unavailable there. The zh-CN data here is Google autocomplete for `gl=cn hl=zh-CN`. It shows phrasing (e.g. `pdf合并`, `图片压缩`, `二维码生成`), not mainland demand. Validate with Baidu (百度指数 / Baidu Ziyuan webmaster tools) and consider Bing CN. TikTok, Instagram, Facebook and X are blocked in the mainland.
- **Russia (ru):** Yandex leads search. Validate with Yandex Wordstat and register in Yandex.Webmaster. Google ru data is a secondary proxy.
- **South Korea (ko):** Naver leads search, then Google. Validate with Naver Search Advertising's keyword tool and register in Naver Search Advisor. Naver blogs and Knowledge iN dominate how-to queries.
- **Japan:** Google (and Yahoo! Japan, which uses Google results) dominates, so this data is representative.
- **Everywhere:** autocomplete is filtered (sensitive and downloader terms can be suppressed, e.g. `descargar video instagram` in gl=es) and personalised. A missing completion does **not** prove zero demand.

## 10. Recommendations (priority order)

1. **Localize the PDF cluster first in every locale:** merge, compress, split, PDF↔JPG, rotate. These have the cleanest, most consistent completions in every Latin-script locale, and in ar, zh-CN, ja, ru, ko, tr, vi and th.
2. **Image compressor and resizer next**, with size-target FAQs (strong in en-IN, id, pt-BR, ar, th, ur).
3. **QR generator/scanner, word counter, percentage calculator:** solid evergreen completions in all main locales.
4. **Downloaders (TikTok, Instagram, Facebook, X):** localize only where the backend is live, with honest FAQs (public posts only; no Stories). Deprioritise zh-CN (platforms blocked), hi (TikTok ban) and ru (Instagram/Facebook blocked), even though some completions exist.
5. **hi, bn, ur, sw:** bilingual titles (native term plus English term), how-to-led content, and English-slug URLs.
6. **Never use brand terms** (ilovepdf, smallpdf, pdf24, adobe, canva, snaptik …) in titles, headings, slugs or meta.
7. Re-run this autocomplete pass after launch for long-tail refreshes. Then validate everything as in section 11 before scaling content.

## 11. Outstanding gaps

- **No search volumes and no competition data.** Autocomplete cannot provide them. Every row is an *UNVALIDATED RESEARCH CANDIDATE*. Keyword priorities in this document are qualitative, based on how consistently completions appear, not on volume.
- **No Google Keyword Planner access** (needs a Google Ads account). Next step: load the `primary` and `alternatives` of `keyword-candidates.json` into Keyword Planner per country and language to get volume ranges and competition. Fill `search_volume` and `competition` in the CSV and set `validation_status` accordingly.
- **No Google Search Console data** for localized pages (they do not exist yet). After launch, add each locale (or the domain property) and track impressions and queries per locale folder for 8-12 weeks. Promote the queries that really bring impressions, and retire candidates that do not.
- **No Bing Webmaster Tools data** (Bing matters for some en and zh-CN traffic, and powers DuckDuckGo/Yahoo results). Verify the site there and use its keyword research tool.
- **No Baidu, Yandex or Naver data**, although these engines lead zh-CN (mainland), ru and ko. Use Baidu Index/Ziyuan, Yandex Wordstat/Webmaster and Naver Search Advisor/keyword tool.
- **Thin evidence for some locale and tool pairs:** marked *(weak)* or *(fallback)* in the tables and in the `evidence` field of the JSON. Urdu-script PDF and image seeds returned nothing, so English is used, and some Arabic-script completions under hl=ur were Persian. Swahili is sparse. Some Bengali and Hindi pairs are weak. Japanese, Korean and Thai downloader queries are mostly long-tail. Have native speakers review these primaries before publication.
- **Clusters only checked in English:** Pinterest downloader, video info, colour, timestamp, number base and time-zone converters, case converter, BMI, loan, Base64. Extend the seed set to the other 19 locales in a later pass before localizing those pages.
- **Unsupported but recurring intents** (PDF↔Word/Excel, PDF edit/sign, video to MP3, background removal, Instagram Stories, YouTube) are product gaps. They are recorded in the CSV, but no pages are proposed.
- **Downloader availability:** the downloader tools are `awaiting-backend` in the registry, so localized downloader pages must only ship where the backend is configured. Recheck `platform-status.ts` before each release, because platform status changes.
