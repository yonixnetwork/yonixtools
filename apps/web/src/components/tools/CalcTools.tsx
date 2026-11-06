"use client";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Field, money, Notice, num, NumberInput, Segmented } from "./ui";
import { bmi, bmiCategory, calculateAge, compound, healthyRangeKg, loan, parseDate, percentChange, percentOf, whatPercent } from "@/lib/tools/calc";
import { convertUnit, formatNumber, unitCategories } from "@/lib/tools/units";

const fmt = (v: number, d = 4) => (Number.isFinite(v) ? parseFloat(v.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d }) : "—");

function Result({ value, label, testId }: { value: string; label: string; testId?: string }) {
  return (
    <div className="result-big" aria-live="polite">
      <div className="v" data-testid={testId}>{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

export function PercentageCalculator() {
  const [mode, setMode] = useState<"of" | "what" | "change">("of");
  const [a, setA] = useState("15");
  const [b, setB] = useState("200");
  const x = num(a);
  const y = num(b);
  const r = mode === "of" ? percentOf(x, y) : mode === "what" ? whatPercent(x, y) : percentChange(x, y);
  const labels = { of: ["Percentage (%)", "Of value"], what: ["Value", "Total"], change: ["From", "To"] }[mode];
  const sentence =
    mode === "of" ? `${fmt(x)}% of ${fmt(y)} = ${fmt(r)}` : mode === "what" ? `${fmt(x)} is ${fmt(r)}% of ${fmt(y)}` : `${fmt(x)} → ${fmt(y)} is a ${Number.isFinite(r) ? (r >= 0 ? "increase" : "decrease") : "change"} of ${fmt(Math.abs(r))}%`;
  const formula = mode === "of" ? `(${fmt(x)} ÷ 100) × ${fmt(y)}` : mode === "what" ? `(${fmt(x)} ÷ ${fmt(y)}) × 100` : `((${fmt(y)} − ${fmt(x)}) ÷ |${fmt(x)}|) × 100`;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label="Calculation" value={mode} onChange={setMode} options={[{ value: "of", label: "X% of Y" }, { value: "what", label: "X is what % of Y" }, { value: "change", label: "% change" }]} />
      <div className="form-grid cols-2">
        <Field label={labels[0]} htmlFor="pc-a">
          <NumberInput id="pc-a" value={a} onChange={setA} />
        </Field>
        <Field label={labels[1]} htmlFor="pc-b">
          <NumberInput id="pc-b" value={b} onChange={setB} />
        </Field>
      </div>
      {Number.isFinite(r) ? <Result value={mode === "of" ? fmt(r) : `${fmt(r)}%`} label={sentence} testId="pc-result" /> : <Notice kind="info">{mode === "of" ? "Enter both numbers." : "The second value can't be zero for this calculation."}</Notice>}
      <p className="muted mono" style={{ fontSize: "0.85rem" }}>Formula: {formula}</p>
    </div>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function AgeCalculator() {
  const [birth, setBirth] = useState("1995-06-15");
  const [on, setOn] = useState("");
  useEffect(() => setOn(iso(new Date())), []);
  const b = parseDate(birth);
  const o = parseDate(on);
  const r = b && o ? calculateAge(b, o) : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2">
        <Field label="Date of birth" htmlFor="age-b">
          <input id="age-b" className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} max="9999-12-31" />
        </Field>
        <Field label="Age on" htmlFor="age-o">
          <input id="age-o" className="input" type="date" value={on} onChange={(e) => setOn(e.target.value)} max="9999-12-31" />
        </Field>
      </div>
      {b && o && !r && <Notice kind="error">The date of birth is after the &quot;age on&quot; date.</Notice>}
      {r && (
        <>
          <Result value={`${r.years} years, ${r.months} months, ${r.days} days`} label="Exact age" testId="age-result" />
          <div className="stat-grid">
            <div className="stat"><div className="v">{r.years}</div><div className="k">Years</div></div>
            <div className="stat"><div className="v">{r.totalWeeks.toLocaleString()}</div><div className="k">Weeks</div></div>
            <div className="stat"><div className="v">{r.totalDays.toLocaleString()}</div><div className="k">Days</div></div>
            <div className="stat"><div className="v">{r.daysToNextBirthday}</div><div className="k">Days to next birthday</div></div>
          </div>
          <p className="muted">Next birthday: {r.nextBirthday.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </>
      )}
    </div>
  );
}

export function BmiCalculator() {
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [cm, setCm] = useState("175");
  const [kg, setKg] = useState("70");
  const [ft, setFt] = useState("5");
  const [inch, setInch] = useState("9");
  const [lb, setLb] = useState("154");
  const heightCm = units === "metric" ? num(cm) : (num(ft) * 12 + (num(inch) || 0)) * 2.54;
  const weightKg = units === "metric" ? num(kg) : num(lb) * 0.45359237;
  const valid = heightCm > 50 && heightCm < 280 && weightKg > 10 && weightKg < 700;
  const v = valid ? bmi(weightKg, heightCm) : NaN;
  const [lo, hi] = valid ? healthyRangeKg(heightCm) : [NaN, NaN];
  const w = (k: number) => (units === "metric" ? `${fmt(k, 1)} kg` : `${fmt(k / 0.45359237, 1)} lb`);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label="Units" value={units} onChange={setUnits} options={[{ value: "metric", label: "Metric (cm, kg)" }, { value: "imperial", label: "Imperial (ft, lb)" }]} />
      {units === "metric" ? (
        <div className="form-grid cols-2">
          <Field label="Height" htmlFor="bmi-cm"><NumberInput id="bmi-cm" value={cm} onChange={setCm} suffix="cm" /></Field>
          <Field label="Weight" htmlFor="bmi-kg"><NumberInput id="bmi-kg" value={kg} onChange={setKg} suffix="kg" /></Field>
        </div>
      ) : (
        <div className="form-grid cols-3">
          <Field label="Height (feet)" htmlFor="bmi-ft"><NumberInput id="bmi-ft" value={ft} onChange={setFt} suffix="ft" /></Field>
          <Field label="Height (inches)" htmlFor="bmi-in"><NumberInput id="bmi-in" value={inch} onChange={setInch} suffix="in" /></Field>
          <Field label="Weight" htmlFor="bmi-lb"><NumberInput id="bmi-lb" value={lb} onChange={setLb} suffix="lb" /></Field>
        </div>
      )}
      {valid ? (
        <>
          <Result value={fmt(v, 1)} label={`BMI · ${bmiCategory(v)}`} testId="bmi-result" />
          <p className="muted">Healthy weight range for your height (BMI 18.5–24.9): {w(lo)} – {w(hi)}.</p>
        </>
      ) : (
        <Notice kind="info">Enter a realistic height and weight.</Notice>
      )}
      <p className="muted" style={{ fontSize: "0.85rem" }}>For adults aged 20 and over. BMI is a screening measure, not a diagnosis.</p>
    </div>
  );
}

export function LoanCalculator() {
  const [p, setP] = useState("250000");
  const [rate, setRate] = useState("6.5");
  const [years, setYears] = useState("25");
  const r = useMemo(() => loan(num(p), num(rate), num(years)), [p, rate, years]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-3">
        <Field label="Loan amount" htmlFor="ln-p"><NumberInput id="ln-p" value={p} onChange={setP} min={0} /></Field>
        <Field label="Annual interest rate" htmlFor="ln-r"><NumberInput id="ln-r" value={rate} onChange={setRate} min={0} suffix="%" /></Field>
        <Field label="Term" htmlFor="ln-y"><NumberInput id="ln-y" value={years} onChange={setYears} min={0} max={100} suffix="years" /></Field>
      </div>
      {r ? (
        <>
          <Result value={money(r.monthly)} label="Monthly payment" testId="loan-monthly" />
          <div className="stat-grid">
            <div className="stat"><div className="v">{money(num(p), 0)}</div><div className="k">Principal</div></div>
            <div className="stat"><div className="v">{money(r.totalInterest, 0)}</div><div className="k">Total interest</div></div>
            <div className="stat"><div className="v">{money(r.totalPaid, 0)}</div><div className="k">Total paid</div></div>
            <div className="stat"><div className="v">{Math.round(num(years) * 12)}</div><div className="k">Payments</div></div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Year</th><th>Principal paid</th><th>Interest paid</th><th>Balance</th></tr></thead>
              <tbody>
                {r.schedule.map((y) => (
                  <tr key={y.year}><td>{y.year}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Notice kind="info">Enter a loan amount above zero, a rate of 0% or more, and a term of up to 100 years.</Notice>
      )}
    </div>
  );
}

export function CompoundInterestCalculator() {
  const [p, setP] = useState("10000");
  const [rate, setRate] = useState("7");
  const [years, setYears] = useState("20");
  const [freq, setFreq] = useState<"1" | "4" | "12" | "365">("12");
  const [monthly, setMonthly] = useState("200");
  const rows = useMemo(() => compound(num(p) || 0, num(rate), num(years), Number(freq), num(monthly) || 0), [p, rate, years, freq, monthly]);
  const last = rows?.at(-1);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-3">
        <Field label="Starting amount" htmlFor="ci-p"><NumberInput id="ci-p" value={p} onChange={setP} min={0} /></Field>
        <Field label="Annual interest rate" htmlFor="ci-r"><NumberInput id="ci-r" value={rate} onChange={setRate} suffix="%" /></Field>
        <Field label="Years" htmlFor="ci-y"><NumberInput id="ci-y" value={years} onChange={setYears} min={0} max={100} /></Field>
        <Field label="Monthly contribution" htmlFor="ci-m"><NumberInput id="ci-m" value={monthly} onChange={setMonthly} min={0} /></Field>
      </div>
      <Field label="Compounding">
        <Segmented label="Compounding frequency" value={freq} onChange={setFreq} options={[{ value: "1", label: "Yearly" }, { value: "4", label: "Quarterly" }, { value: "12", label: "Monthly" }, { value: "365", label: "Daily" }]} />
      </Field>
      {rows && last && Number.isFinite(last.balance) ? (
        <>
          <Result value={money(last.balance)} label={`Balance after ${fmt(num(years), 2)} years`} testId="ci-result" />
          <div className="stat-grid">
            <div className="stat"><div className="v">{money(last.contributions, 0)}</div><div className="k">Total contributed</div></div>
            <div className="stat"><div className="v">{money(last.interest, 0)}</div><div className="k">Interest earned</div></div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Year</th><th>Contributed</th><th>Interest</th><th>Balance</th></tr></thead>
              <tbody>
                {rows.map((y) => (
                  <tr key={y.year}><td>{y.year}</td><td>{money(y.contributions)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Notice kind="info">Enter a starting amount, a rate, and between 1 and 100 years.</Notice>
      )}
    </div>
  );
}

export function UnitConverter() {
  const [cat, setCat] = useState("length");
  const category = unitCategories.find((c) => c.id === cat)!;
  const [from, setFrom] = useState("cm");
  const [to, setTo] = useState("in");
  const [value, setValue] = useState("100");
  const [reverse, setReverse] = useState("");
  const changeCat = (id: string) => {
    const c = unitCategories.find((x) => x.id === id)!;
    setCat(id);
    setFrom(c.units[0].id);
    setTo(c.units[1].id);
    setReverse("");
  };
  const out = convertUnit(cat, num(value), from, to);
  const shown = reverse || (Number.isFinite(out) ? formatNumber(out) : "");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label="Category" value={cat} onChange={changeCat} options={unitCategories.map((c) => ({ value: c.id, label: c.name }))} />
      <div className="form-grid cols-2" style={{ alignItems: "end" }}>
        <div className="stack" style={{ gap: 8 }}>
          <Field label="From" htmlFor="uc-from">
            <select id="uc-from" className="select" value={from} onChange={(e) => (setFrom(e.target.value), setReverse(""))}>
              {category.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <input aria-label="Value to convert" className="input" type="number" inputMode="decimal" value={value} onChange={(e) => (setValue(e.target.value), setReverse(""))} data-testid="uc-in" />
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <Field label="To" htmlFor="uc-to">
            <select id="uc-to" className="select" value={to} onChange={(e) => (setTo(e.target.value), setReverse(""))}>
              {category.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <input
            aria-label="Converted value"
            className="input"
            inputMode="decimal"
            value={shown}
            data-testid="uc-out"
            onChange={(e) => {
              setReverse(e.target.value);
              const back = convertUnit(cat, num(e.target.value), to, from);
              if (Number.isFinite(back)) setValue(String(parseFloat(back.toPrecision(12))));
            }}
          />
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => (setFrom(to), setTo(from), setReverse(""))}>
          <ArrowLeftRight aria-hidden /> Swap units
        </button>
        {Number.isFinite(out) && (
          <span className="muted">
            {formatNumber(num(value))} {category.units.find((u) => u.id === from)?.name.toLowerCase()} = {formatNumber(out)} {category.units.find((u) => u.id === to)?.name.toLowerCase()}
          </span>
        )}
      </div>
    </div>
  );
}
