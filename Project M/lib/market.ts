/**
 * NSE market-hours helpers. Trading: Mon–Fri, 09:15–15:30 IST.
 * Outside these hours every quote is the last close — the UI must label it
 * as such and never present it as live.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istParts(now: Date) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    day: ist.getUTCDay(), // 0 = Sunday
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export function isMarketOpen(now: Date = new Date()): boolean {
  const { day, minutes } = istParts(now);
  if (day === 0 || day === 6) return false;
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

export function marketStatus(now: Date = new Date()): "open" | "closed" {
  return isMarketOpen(now) ? "open" : "closed";
}

/** "10:42:13 AM IST" style timestamp for "Last updated" labels. */
export function formatIST(date: Date | string | number): string {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
  return `${parts} IST`;
}

/** YYYY-MM-DD in IST — for bhavcopy `date` params. */
export function istDateString(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Most recent weekday (Mon–Fri) in IST — safe default for EOD `date` params. */
export function lastTradingDateString(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  let day = ist.getUTCDay();
  let back = 0;
  if (day === 0) back = 2; // Sunday -> Friday
  else if (day === 6) back = 1; // Saturday -> Friday
  ist.setUTCDate(ist.getUTCDate() - back);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
