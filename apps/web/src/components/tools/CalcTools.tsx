"use client";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Field, Notice, num, NumberInput, Segmented } from "./ui";
import { useFormat, useT } from "@/i18n/client";
import { bmi, bmiCategoryId, calculateAge, compound, healthyRangeKg, loan, parseDate, percentChange, percentOf, whatPercent } from "@/lib/tools/calc";
import { convertUnit, formatNumber, unitCategories } from "@/lib/tools/units";

type Fmt = ReturnType<typeof useFormat>;
/** Number for display, at most `d` decimals, in the page locale. */
function useNum() {
  const f = useFormat();
  return {
    f,
    fmt: (v: number, d = 4) => (Number.isFinite(v) ? f.number(parseFloat(v.toFixed(d)), { maximumFractionDigits: d }) : "—"),
    money: (v: number, digits = 2) => moneyFmt(f, v, digits),
  };
}
const moneyFmt = (f: Fmt, v: number, digits = 2) => (Number.isFinite(v) ? f.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—");

function Result({ value, label, testId }: { value: string; label: string; testId?: string }) {
  return (
    <div className="result-big" aria-live="polite">
      <div className="v" data-testid={testId}>{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}

export function PercentageCalculator() {
  const t = useT("tools-calc");
  const { fmt } = useNum();
  const [mode, setMode] = useState<"of" | "what" | "change">("of");
  const [a, setA] = useState("15");
  const [b, setB] = useState("200");
  const x = num(a);
  const y = num(b);
  const r = mode === "of" ? percentOf(x, y) : mode === "what" ? whatPercent(x, y) : percentChange(x, y);
  const labels = { of: [t("percentage.percentage"), t("percentage.ofValue")], what: [t("percentage.value"), t("percentage.total")], change: [t("percentage.from"), t("percentage.to")] }[mode];
  const sentence =
    mode === "of"
      ? t("percentage.sentenceOf", { x: fmt(x), y: fmt(y), result: fmt(r) })
      : mode === "what"
        ? t("percentage.sentenceWhat", { x: fmt(x), y: fmt(y), result: fmt(r) })
        : t(Number.isFinite(r) ? (r >= 0 ? "percentage.sentenceIncrease" : "percentage.sentenceDecrease") : "percentage.sentenceChange", { from: fmt(x), to: fmt(y), result: fmt(Math.abs(r)) });
  const formula = mode === "of" ? `(${fmt(x)} ÷ 100) × ${fmt(y)}` : mode === "what" ? `(${fmt(x)} ÷ ${fmt(y)}) × 100` : `((${fmt(y)} − ${fmt(x)}) ÷ |${fmt(x)}|) × 100`;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label={t("percentage.calculation")} value={mode} onChange={setMode} options={[{ value: "of", label: t("percentage.modeOf") }, { value: "what", label: t("percentage.modeWhat") }, { value: "change", label: t("percentage.modeChange") }]} />
      <div className="form-grid cols-2">
        <Field label={labels[0]} htmlFor="pc-a">
          <NumberInput id="pc-a" value={a} onChange={setA} />
        </Field>
        <Field label={labels[1]} htmlFor="pc-b">
          <NumberInput id="pc-b" value={b} onChange={setB} />
        </Field>
      </div>
      {Number.isFinite(r) ? <Result value={mode === "of" ? fmt(r) : `${fmt(r)}%`} label={sentence} testId="pc-result" /> : <Notice kind="info">{mode === "of" ? t("percentage.enterBoth") : t("percentage.zeroDivisor")}</Notice>}
      <p className="muted mono" style={{ fontSize: "0.85rem" }}>{t("percentage.formula", { formula })}</p>
    </div>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function AgeCalculator() {
  const t = useT("tools-calc");
  const f = useFormat();
  const [birth, setBirth] = useState("1995-06-15");
  const [on, setOn] = useState("");
  useEffect(() => setOn(iso(new Date())), []);
  const b = parseDate(birth);
  const o = parseDate(on);
  const r = b && o ? calculateAge(b, o) : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2">
        <Field label={t("age.birth")} htmlFor="age-b">
          <input id="age-b" className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} max="9999-12-31" />
        </Field>
        <Field label={t("age.on")} htmlFor="age-o">
          <input id="age-o" className="input" type="date" value={on} onChange={(e) => setOn(e.target.value)} max="9999-12-31" />
        </Field>
      </div>
      {b && o && !r && <Notice kind="error">{t("age.birthAfter")}</Notice>}
      {r && (
        <>
          <Result value={t("age.exact", { years: t("age.years", { count: r.years }), months: t("age.months", { count: r.months }), days: t("age.days", { count: r.days }) })} label={t("age.exactLabel")} testId="age-result" />
          <div className="stat-grid">
            <div className="stat"><div className="v">{f.number(r.years)}</div><div className="k">{t("age.statYears")}</div></div>
            <div className="stat"><div className="v">{f.number(r.totalWeeks)}</div><div className="k">{t("age.statWeeks")}</div></div>
            <div className="stat"><div className="v">{f.number(r.totalDays)}</div><div className="k">{t("age.statDays")}</div></div>
            <div className="stat"><div className="v">{f.number(r.daysToNextBirthday)}</div><div className="k">{t("age.statNextBirthday")}</div></div>
          </div>
          <p className="muted">{t("age.nextBirthday", { date: f.date(r.nextBirthday, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) })}</p>
        </>
      )}
    </div>
  );
}

export function BmiCalculator() {
  const t = useT("tools-calc");
  const { f, fmt } = useNum();
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
  const w = (k: number) => (units === "metric" ? t("bmi.weightKg", { value: fmt(k, 1) }) : t("bmi.weightLb", { value: fmt(k / 0.45359237, 1) }));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Segmented label={t("bmi.units")} value={units} onChange={setUnits} options={[{ value: "metric", label: t("bmi.metric") }, { value: "imperial", label: t("bmi.imperial") }]} />
      {units === "metric" ? (
        <div className="form-grid cols-2">
          <Field label={t("bmi.height")} htmlFor="bmi-cm"><NumberInput id="bmi-cm" value={cm} onChange={setCm} suffix={t("bmi.unitCm")} /></Field>
          <Field label={t("bmi.weight")} htmlFor="bmi-kg"><NumberInput id="bmi-kg" value={kg} onChange={setKg} suffix={t("bmi.unitKg")} /></Field>
        </div>
      ) : (
        <div className="form-grid cols-3">
          <Field label={t("bmi.heightFeet")} htmlFor="bmi-ft"><NumberInput id="bmi-ft" value={ft} onChange={setFt} suffix={t("bmi.unitFt")} /></Field>
          <Field label={t("bmi.heightInches")} htmlFor="bmi-in"><NumberInput id="bmi-in" value={inch} onChange={setInch} suffix={t("bmi.unitIn")} /></Field>
          <Field label={t("bmi.weight")} htmlFor="bmi-lb"><NumberInput id="bmi-lb" value={lb} onChange={setLb} suffix={t("bmi.unitLb")} /></Field>
        </div>
      )}
      {valid ? (
        <>
          <Result value={fmt(v, 1)} label={t("bmi.resultLabel", { category: t(`bmi.category.${bmiCategoryId(v)}`) })} testId="bmi-result" />
          <p className="muted">{t("bmi.healthyRange", { minBmi: f.number(18.5), maxBmi: f.number(24.9), low: w(lo), high: w(hi) })}</p>
        </>
      ) : (
        <Notice kind="info">{t("bmi.invalid")}</Notice>
      )}
      <p className="muted" style={{ fontSize: "0.85rem" }}>{t("bmi.disclaimer", { age: 20 })}</p>
    </div>
  );
}

export function LoanCalculator() {
  const t = useT("tools-calc");
  const { f, money } = useNum();
  const [p, setP] = useState("250000");
  const [rate, setRate] = useState("6.5");
  const [years, setYears] = useState("25");
  const r = useMemo(() => loan(num(p), num(rate), num(years)), [p, rate, years]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-3">
        <Field label={t("loan.amount")} htmlFor="ln-p"><NumberInput id="ln-p" value={p} onChange={setP} min={0} /></Field>
        <Field label={t("loan.rate")} htmlFor="ln-r"><NumberInput id="ln-r" value={rate} onChange={setRate} min={0} suffix="%" /></Field>
        <Field label={t("loan.term")} htmlFor="ln-y"><NumberInput id="ln-y" value={years} onChange={setYears} min={0} max={100} suffix={t("loan.termSuffix")} /></Field>
      </div>
      {r ? (
        <>
          <Result value={money(r.monthly)} label={t("loan.monthly")} testId="loan-monthly" />
          <div className="stat-grid">
            <div className="stat"><div className="v">{money(num(p), 0)}</div><div className="k">{t("loan.principal")}</div></div>
            <div className="stat"><div className="v">{money(r.totalInterest, 0)}</div><div className="k">{t("loan.totalInterest")}</div></div>
            <div className="stat"><div className="v">{money(r.totalPaid, 0)}</div><div className="k">{t("loan.totalPaid")}</div></div>
            <div className="stat"><div className="v">{f.number(Math.round(num(years) * 12))}</div><div className="k">{t("loan.payments")}</div></div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>{t("loan.year")}</th><th>{t("loan.principalPaid")}</th><th>{t("loan.interestPaid")}</th><th>{t("loan.balance")}</th></tr></thead>
              <tbody>
                {r.schedule.map((y) => (
                  <tr key={y.year}><td>{f.number(y.year)}</td><td>{money(y.principal)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Notice kind="info">{t("loan.invalid", { maxYears: 100 })}</Notice>
      )}
    </div>
  );
}

export function CompoundInterestCalculator() {
  const t = useT("tools-calc");
  const { f, money } = useNum();
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
        <Field label={t("compound.start")} htmlFor="ci-p"><NumberInput id="ci-p" value={p} onChange={setP} min={0} /></Field>
        <Field label={t("compound.rate")} htmlFor="ci-r"><NumberInput id="ci-r" value={rate} onChange={setRate} suffix="%" /></Field>
        <Field label={t("compound.years")} htmlFor="ci-y"><NumberInput id="ci-y" value={years} onChange={setYears} min={0} max={100} /></Field>
        <Field label={t("compound.monthly")} htmlFor="ci-m"><NumberInput id="ci-m" value={monthly} onChange={setMonthly} min={0} /></Field>
      </div>
      <Field label={t("compound.compounding")}>
        <Segmented label={t("compound.frequency")} value={freq} onChange={setFreq} options={[{ value: "1", label: t("compound.yearly") }, { value: "4", label: t("compound.quarterly") }, { value: "12", label: t("compound.monthlyFreq") }, { value: "365", label: t("compound.daily") }]} />
      </Field>
      {rows && last && Number.isFinite(last.balance) ? (
        <>
          <Result value={money(last.balance)} label={t("compound.balanceAfter", { count: parseFloat(num(years).toFixed(2)) })} testId="ci-result" />
          <div className="stat-grid">
            <div className="stat"><div className="v">{money(last.contributions, 0)}</div><div className="k">{t("compound.totalContributed")}</div></div>
            <div className="stat"><div className="v">{money(last.interest, 0)}</div><div className="k">{t("compound.interestEarned")}</div></div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>{t("compound.year")}</th><th>{t("compound.contributed")}</th><th>{t("compound.interest")}</th><th>{t("compound.balance")}</th></tr></thead>
              <tbody>
                {rows.map((y) => (
                  <tr key={y.year}><td>{f.number(y.year)}</td><td>{money(y.contributions)}</td><td>{money(y.interest)}</td><td>{money(y.balance)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <Notice kind="info">{t("compound.invalid", { minYears: 1, maxYears: 100 })}</Notice>
      )}
    </div>
  );
}

export function UnitConverter() {
  const t = useT("tools-calc");
  const f = useFormat();
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
      <Segmented label={t("unitConverter.categoryLabel")} value={cat} onChange={changeCat} options={unitCategories.map((c) => ({ value: c.id, label: t(`unitConverter.category.${c.id}`) }))} />
      <div className="form-grid cols-2" style={{ alignItems: "end" }}>
        <div className="stack" style={{ gap: 8 }}>
          <Field label={t("unitConverter.from")} htmlFor="uc-from">
            <select id="uc-from" className="select" value={from} onChange={(e) => (setFrom(e.target.value), setReverse(""))}>
              {category.units.map((u) => <option key={u.id} value={u.id}>{t(`unitConverter.unit.${u.id}`)}</option>)}
            </select>
          </Field>
          <input aria-label={t("unitConverter.valueAria")} className="input" type="number" inputMode="decimal" value={value} onChange={(e) => (setValue(e.target.value), setReverse(""))} data-testid="uc-in" />
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <Field label={t("unitConverter.to")} htmlFor="uc-to">
            <select id="uc-to" className="select" value={to} onChange={(e) => (setTo(e.target.value), setReverse(""))}>
              {category.units.map((u) => <option key={u.id} value={u.id}>{t(`unitConverter.unit.${u.id}`)}</option>)}
            </select>
          </Field>
          <input
            aria-label={t("unitConverter.convertedAria")}
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
          <ArrowLeftRight aria-hidden /> {t("unitConverter.swap")}
        </button>
        {Number.isFinite(out) && (
          <span className="muted">
            {t("unitConverter.summary", { fromValue: formatNumber(num(value), f.locale), fromUnit: t(`unitConverter.unitInline.${from}`), toValue: formatNumber(out, f.locale), toUnit: t(`unitConverter.unitInline.${to}`) })}
          </span>
        )}
      </div>
    </div>
  );
}
