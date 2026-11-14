import { useEffect, useState } from "react";
import type { DateMode } from "./types";

export const EMON = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"];
export const EDAY = ["Segno", "Maksegno", "Erob", "Hamus", "Arb", "Kidame", "Ehud"];

export interface AddisNow {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface DateDisplay {
  titleMain: string;
  titleSub: string;
  eth: string;
  ethDay: string;
  ethFull: string;
  greg: string;
  gday: string;
  gregFull: string;
  clock: string;
  clockSub: string;
  localTime: string;
  first: [string, string];
  second: [string, string];
}

export function addisNow(): AddisNow {
  const o: Record<string, number> = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(new Date())
    .forEach((p) => {
      if (p.type !== "literal") o[p.type] = +p.value;
    });
  o.hour %= 24;
  return { year: o.year, month: o.month, day: o.day, hour: o.hour, minute: o.minute };
}

export function toEth(y: number, m: number, d: number): { y: number; m: number; d: number; wd: number } {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  const k = jdn - 1723856;
  const r = k % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    y: 4 * Math.floor(k / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    m: Math.floor(n / 30),
    d: (n % 30) + 1,
    wd: jdn % 7,
  };
}

export function ethToJdn(y: number, m: number, d: number): number {
  return 1723856 + 365 * y + Math.floor(y / 4) + 30 * m + d - 1;
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    year: 100 * b + d - 4800 + Math.floor(m / 10),
    month: m + 3 - 12 * Math.floor(m / 10),
    day: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

export function isEthiopianLeapYear(y: number): boolean {
  return y % 4 === 3;
}

export function ethMonthLength(y: number, m: number): number {
  if (m < 12) return 30;
  return isEthiopianLeapYear(y) ? 6 : 5;
}

export function addisDisplay(mode: DateMode): DateDisplay {
  const n = addisNow();
  const e = toEth(n.year, n.month, n.day);
  const pad = (v: number) => String(v).padStart(2, "0");
  const eth = EMON[e.m] + " " + e.d + ", " + e.y;
  const ethDay = EDAY[e.wd] + " · E.C.";
  const ethFull = EDAY[e.wd] + ", " + EMON[e.m] + " " + e.d + ", " + e.y + " E.C.";
  const gd = new Date(Date.UTC(n.year, n.month - 1, n.day));
  const greg = gd.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
  const gday = gd.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
  const gregFull = gday + ", " + greg;
  const eh = (n.hour + 6) % 12 || 12;
  const per = n.hour >= 6 && n.hour < 18 ? "day" : "night";
  const h12 = (n.hour % 12 || 12) + ":" + pad(n.minute) + (n.hour < 12 ? " AM" : " PM");
  const first: [string, string] = mode === "greg" ? [greg, gday + " · Gregorian"] : [eth, ethDay];
  const second: [string, string] = mode === "greg" ? [eth, ethDay] : [greg, gday + " · Gregorian"];
  const titleMain = mode === "greg" ? gday.slice(0, 3) + ", " + greg : EDAY[e.wd] + " " + eth;
  const titleSub = mode === "greg" ? eth : gday.slice(0, 3) + ", " + greg.replace(/, \d{4}$/, "");
  return {
    titleMain,
    titleSub,
    eth,
    ethDay,
    ethFull,
    greg,
    gday,
    gregFull,
    clock: eh + ":" + pad(n.minute),
    clockSub: "Ethiopian " + per + " clock",
    localTime: h12,
    first,
    second,
  };
}

export function useAddisDisplay(mode: DateMode): DateDisplay {
  const [display, setDisplay] = useState(() => addisDisplay(mode));
  useEffect(() => {
    setDisplay(addisDisplay(mode));
    const iv = window.setInterval(() => setDisplay(addisDisplay(mode)), 20000);
    return () => window.clearInterval(iv);
  }, [mode]);
  return display;
}