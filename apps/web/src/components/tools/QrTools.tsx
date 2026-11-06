"use client";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadBlob, Field, Notice, Segmented } from "./ui";
import { vcardPayload, wifiPayload, type Contact, type WifiSecurity } from "@/lib/tools/formats";

type Ecl = "L" | "M" | "Q" | "H";

function useQr(text: string, opts: { ecl: Ecl; fg: string; bg: string; size: number }) {
  const [png, setPng] = useState("");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (!text) {
      setPng("");
      setSvg("");
      setError("");
      return;
    }
    const o = { errorCorrectionLevel: opts.ecl, margin: 2, color: { dark: opts.fg, light: opts.bg } };
    Promise.all([QRCode.toDataURL(text, { ...o, width: opts.size }), QRCode.toString(text, { ...o, type: "svg" })])
      .then(([p, s]) => {
        if (!alive) return;
        setPng(p);
        setSvg(s);
        setError("");
      })
      .catch((e: Error) => {
        if (!alive) return;
        setPng("");
        setSvg("");
        setError(/too big|amount of data/i.test(e.message) ? "That's too much data for a QR code. Shorten the content or lower the error correction." : e.message);
      });
    return () => {
      alive = false;
    };
  }, [text, opts.ecl, opts.fg, opts.bg, opts.size]);
  return { png, svg, error };
}

function QrPanel({ text, filename, children }: { text: string; filename: string; children: React.ReactNode }) {
  const [ecl, setEcl] = useState<Ecl>("M");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [size, setSize] = useState(512);
  const { png, svg, error } = useQr(text, { ecl, fg, bg, size });
  const lowContrast = contrast(fg, bg) < 3;

  return (
    <div className="qr-layout">
      <div className="stack" style={{ gap: 16 }}>
        {children}
        <details>
          <summary className="field-label" style={{ cursor: "pointer" }}>
            Appearance &amp; error correction
          </summary>
          <div className="form-grid cols-2" style={{ marginTop: 12 }}>
            <Field label="Error correction">
              <Segmented label="Error correction" value={ecl} onChange={setEcl} options={[{ value: "L", label: "Low" }, { value: "M", label: "Medium" }, { value: "Q", label: "Quartile" }, { value: "H", label: "High" }]} />
            </Field>
            <Field label={`PNG size: ${size}px`} htmlFor="qr-size">
              <input id="qr-size" type="range" min={128} max={2048} step={64} value={size} onChange={(e) => setSize(+e.target.value)} />
            </Field>
            <div className="row">
              <Field label="Foreground" htmlFor="qr-fg">
                <input id="qr-fg" type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
              </Field>
              <Field label="Background" htmlFor="qr-bg">
                <input id="qr-bg" type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
              </Field>
            </div>
          </div>
          {lowContrast && <Notice kind="warn">Low contrast between the colours: many scanners won&apos;t read this code.</Notice>}
        </details>
      </div>
      <div className="stack">
        <div className="qr-preview" aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {png ? <img src={png} alt="Generated QR code" width={240} height={240} /> : <div className="muted" style={{ padding: "90px 0", textAlign: "center", fontSize: "0.9rem" }}>{error ? "—" : "Your QR code appears here"}</div>}
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={!png} onClick={() => fetch(png).then((r) => r.blob()).then((b) => downloadBlob(b, `${filename}.png`))}>
            <Download aria-hidden /> PNG
          </button>
          <button type="button" className="btn" style={{ flex: 1 }} disabled={!svg} onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`)}>
            <Download aria-hidden /> SVG
          </button>
        </div>
      </div>
    </div>
  );
}

function luminance(hex: string) {
  const c = hex.replace("#", "").match(/../g)?.map((x) => parseInt(x, 16) / 255) ?? [0, 0, 0];
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export function QrCodeGenerator() {
  const [text, setText] = useState("https://yonixtools.com");
  return (
    <QrPanel text={text} filename="qr-code">
      <Field label="Link or text" htmlFor="qr-text" hint={`${text.length} characters`}>
        <textarea id="qr-text" className="textarea" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://example.com" />
      </Field>
    </QrPanel>
  );
}

export function WifiQrGenerator() {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<WifiSecurity>("WPA");
  const [hidden, setHidden] = useState(false);
  const payload = ssid ? wifiPayload({ ssid, password, security, hidden }) : "";
  return (
    <QrPanel text={payload} filename={`wifi-${ssid || "network"}`}>
      <div className="form-grid cols-2">
        <Field label="Network name (SSID)" htmlFor="wifi-ssid">
          <input id="wifi-ssid" className="input" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="MyHomeWiFi" autoComplete="off" />
        </Field>
        <Field label="Password" htmlFor="wifi-pass">
          <input id="wifi-pass" className="input" value={password} onChange={(e) => setPassword(e.target.value)} disabled={security === "nopass"} autoComplete="off" />
        </Field>
      </div>
      <Field label="Security">
        <Segmented label="Security" value={security} onChange={setSecurity} options={[{ value: "WPA", label: "WPA/WPA2/WPA3" }, { value: "WEP", label: "WEP" }, { value: "nopass", label: "None" }]} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden network
      </label>
      {security !== "nopass" && ssid && !password && <Notice kind="warn">Add the password, or choose &quot;None&quot; for an open network.</Notice>}
    </QrPanel>
  );
}

const emptyContact: Contact = { firstName: "", lastName: "", organization: "", title: "", phone: "", email: "", website: "", address: "" };

export function VcardQrGenerator() {
  const [c, setC] = useState<Contact>(emptyContact);
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });
  const filled = Object.values(c).some((v) => v.trim());
  const fields: Array<[keyof Contact, string, string]> = [
    ["firstName", "First name", "given-name"],
    ["lastName", "Last name", "family-name"],
    ["phone", "Phone", "tel"],
    ["email", "Email", "email"],
    ["organization", "Company", "organization"],
    ["title", "Job title", "organization-title"],
    ["website", "Website", "url"],
    ["address", "Address", "street-address"],
  ];
  return (
    <QrPanel text={filled ? vcardPayload(c) : ""} filename={`contact-${[c.firstName, c.lastName].filter(Boolean).join("-") || "card"}`}>
      <div className="form-grid cols-2">
        {fields.map(([k, label, ac]) => (
          <Field key={k} label={label} htmlFor={`vc-${k}`}>
            <input id={`vc-${k}`} className="input" value={c[k]} onChange={set(k)} autoComplete={ac} type={k === "email" ? "email" : k === "phone" ? "tel" : k === "website" ? "url" : "text"} />
          </Field>
        ))}
      </div>
    </QrPanel>
  );
}
