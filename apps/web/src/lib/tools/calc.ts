// ── Percentages ─────────────────────────────────────────────────────────────

export const percentOf = (p: number, v: number) => (p / 100) * v;
export const whatPercent = (part: number, whole: number) => (whole === 0 ? NaN : (part / whole) * 100);
export const percentChange = (from: number, to: number) => (from === 0 ? NaN : ((to - from) / Math.abs(from)) * 100);

// ── Age ─────────────────────────────────────────────────────────────────────

/** Parse YYYY-MM-DD as a local calendar date (no timezone shifting). */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  nextBirthday: Date;
  daysToNextBirthday: number;
}

export function birthdayInYear(birth: Date, year: number): Date {
  const m = birth.getMonth();
  const d = birth.getDate();
  if (m === 1 && d === 29 && !isLeap(year)) return new Date(year, 1, 28);
  return new Date(year, m, d);
}

export function calculateAge(birth: Date, on: Date): AgeResult | null {
  if (dayNumber(on) < dayNumber(birth)) return null;
  let years = on.getFullYear() - birth.getFullYear();
  if (dayNumber(birthdayInYear(birth, on.getFullYear())) > dayNumber(on)) years--;
  const anniversary = birthdayInYear(birth, birth.getFullYear() + years);
  let months = 0;
  let cursor = anniversary;
  for (;;) {
    const nm = cursor.getMonth() + 1;
    const ny = cursor.getFullYear() + Math.floor(nm / 12);
    const mm = nm % 12;
    const next = new Date(ny, mm, Math.min(birth.getDate(), daysInMonth(ny, mm)));
    if (dayNumber(next) > dayNumber(on)) break;
    cursor = next;
    months++;
  }
  const days = dayNumber(on) - dayNumber(cursor);
  const totalDays = dayNumber(on) - dayNumber(birth);
  let nextBirthday = birthdayInYear(birth, on.getFullYear());
  if (dayNumber(nextBirthday) <= dayNumber(on)) nextBirthday = birthdayInYear(birth, on.getFullYear() + 1);
  return { years, months, days, totalDays, totalWeeks: Math.floor(totalDays / 7), nextBirthday, daysToNextBirthday: dayNumber(nextBirthday) - dayNumber(on) };
}

// ── BMI ─────────────────────────────────────────────────────────────────────

export const bmi = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;

export function bmiCategory(v: number): string {
  if (v < 18.5) return "Underweight";
  if (v < 25) return "Healthy weight";
  if (v < 30) return "Overweight";
  return "Obesity";
}

export const healthyRangeKg = (heightCm: number): [number, number] => [18.5 * (heightCm / 100) ** 2, 24.9 * (heightCm / 100) ** 2];

// ── Loans ───────────────────────────────────────────────────────────────────

export interface LoanYear {
  year: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanResult {
  monthly: number;
  totalPaid: number;
  totalInterest: number;
  schedule: LoanYear[];
}

export function loan(principal: number, annualRatePct: number, years: number): LoanResult | null {
  const n = Math.round(years * 12);
  if (!(principal > 0) || !(n > 0) || !(annualRatePct >= 0) || n > 1200) return null;
  const r = annualRatePct / 100 / 12;
  const monthly = r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
  const schedule: LoanYear[] = [];
  let balance = principal;
  let yp = 0;
  let yi = 0;
  for (let k = 1; k <= n; k++) {
    const interest = balance * r;
    const princ = Math.min(monthly - interest, balance);
    balance = Math.max(0, balance - princ);
    yp += princ;
    yi += interest;
    if (k % 12 === 0 || k === n) {
      schedule.push({ year: Math.ceil(k / 12), principal: yp, interest: yi, balance });
      yp = 0;
      yi = 0;
    }
  }
  return { monthly, totalPaid: monthly * n, totalInterest: monthly * n - principal, schedule };
}

// ── Compound interest ───────────────────────────────────────────────────────

export interface CompoundYear {
  year: number;
  contributions: number;
  interest: number;
  balance: number;
}

/**
 * Balance after `years` with `periodsPerYear` compounding and a monthly
 * contribution made at the end of each month. Simulated month by month using
 * the effective monthly rate equivalent to the nominal compounding.
 */
export function compound(principal: number, annualRatePct: number, years: number, periodsPerYear: number, monthlyContribution: number): CompoundYear[] | null {
  if (!(principal >= 0) || !(years > 0) || years > 100 || !(periodsPerYear > 0) || !(monthlyContribution >= 0)) return null;
  const nominal = annualRatePct / 100;
  const monthlyRate = (1 + nominal / periodsPerYear) ** (periodsPerYear / 12) - 1;
  const rows: CompoundYear[] = [];
  let balance = principal;
  let contributions = principal;
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    contributions += monthlyContribution;
    if (m % 12 === 0 || m === months) rows.push({ year: Math.ceil(m / 12), contributions, interest: balance - contributions, balance });
  }
  return rows;
}
