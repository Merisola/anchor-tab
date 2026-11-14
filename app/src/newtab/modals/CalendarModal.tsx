import { useEffect, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import {
  EDAY,
  EMON,
  addisNow,
  ethMonthLength,
  ethToJdn,
  jdnToGregorian,
  toEth,
  useAddisDisplay,
} from "../../lib/ethiopian";
import { useAnchorState } from "../../state/anchorStore";
import { useUi } from "../ui";

const GREG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const GREG_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ETH_WEEK = ["Seg", "Mak", "Erob", "Hamus", "Arb", "Kid", "Ehud"];

interface CalendarCell {
  key: string;
  primary: number;
  secondary: string;
  today: boolean;
  label: string;
}

interface CalendarView {
  ethY: number;
  ethM: number;
  gregY: number;
  gregM: number;
}

function currentView(): CalendarView {
  const n = addisNow();
  const e = toEth(n.year, n.month, n.day);
  return { ethY: e.y, ethM: e.m, gregY: n.year, gregM: n.month };
}

export function CalendarModal() {
  const ui = useUi();
  const state = useAnchorState();
  const display = useAddisDisplay(state.look.dateMode);
  const mode = ui.calendar;
  const [view, setView] = useState<CalendarView>(currentView);

  useEffect(() => {
    if (mode) setView(currentView());
  }, [mode]);

  const now = addisNow();
  const offset = mode === "eth" ? ethToJdn(view.ethY, view.ethM, 1) % 7 : (() => {
    const first = new Date(Date.UTC(view.gregY, view.gregM - 1, 1));
    return (first.getUTCDay() + 6) % 7;
  })();

  const cells: Array<CalendarCell | null> = [];
  if (mode === "eth") {
    const days = ethMonthLength(view.ethY, view.ethM);
    const firstJdn = ethToJdn(view.ethY, view.ethM, 1);
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= days; day += 1) {
      const g = jdnToGregorian(firstJdn + day - 1);
      const isToday = g.year === now.year && g.month === now.month && g.day === now.day;
      cells.push({
        key: `e-${day}`,
        primary: day,
        secondary: `${GREG_MONTHS[g.month - 1].slice(0, 3)} ${g.day}`,
        today: isToday,
        label: `${EDAY[(firstJdn + day - 1) % 7]}, ${EMON[view.ethM]} ${day}, ${view.ethY} E.C. · Gregorian ${GREG_MONTHS[g.month - 1]} ${g.day}, ${g.year}`,
      });
    }
  } else if (mode === "greg") {
    const days = new Date(Date.UTC(view.gregY, view.gregM, 0)).getUTCDate();
    for (let i = 0; i < offset; i += 1) cells.push(null);
    for (let day = 1; day <= days; day += 1) {
      const e = toEth(view.gregY, view.gregM, day);
      const isToday = view.gregY === now.year && view.gregM === now.month && day === now.day;
      cells.push({
        key: `g-${day}`,
        primary: day,
        secondary: `${EMON[e.m].slice(0, 3)} ${e.d}`,
        today: isToday,
        label: `${GREG_MONTHS[view.gregM - 1]} ${day}, ${view.gregY} · Ethiopian ${EMON[e.m]} ${e.d}, ${e.y} E.C.`,
      });
    }
  }

  const title =
    mode === "eth"
      ? `${EMON[view.ethM]} ${view.ethY}`
      : mode === "greg"
        ? `${GREG_MONTHS[view.gregM - 1]} ${view.gregY}`
        : "";

  const move = (delta: number) => {
    setView((v) => {
      if (mode === "eth") {
        let m = v.ethM + delta;
        let y = v.ethY;
        if (m < 0) {
          m = 12;
          y -= 1;
        }
        if (m > 12) {
          m = 0;
          y += 1;
        }
        return { ...v, ethY: y, ethM: m };
      }
      let m = v.gregM + delta;
      let y = v.gregY;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      if (m > 12) {
        m = 1;
        y += 1;
      }
      return { ...v, gregY: y, gregM: m };
    });
  };

  const goToday = () => setView(currentView());

  return (
    <Modal open={mode !== null} onClose={ui.closeCalendar} wide>
      <div className="cal-head">
        <div>
          <div className="eyebrow">{mode === "eth" ? "Ethiopian calendar" : "Gregorian calendar"}</div>
          <h2>{title}</h2>
        </div>
        <div className="cal-nav">
          <button className="cal-arrow" type="button" aria-label="Previous month" onClick={() => move(-1)}>
            ‹
          </button>
          <button className="cal-arrow" type="button" aria-label="Next month" onClick={() => move(1)}>
            ›
          </button>
        </div>
      </div>

      <div className="cal-week" aria-hidden="true">
        {(mode === "eth" ? ETH_WEEK : GREG_WEEK).map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid" aria-label={title}>
        {cells.map((cell, index) =>
          cell ? (
            <div
              key={cell.key}
              className={"cal-day" + (cell.today ? " today" : "") + (index % 7 >= 5 ? " weekend" : "")}
              role="gridcell"
              aria-label={cell.label}
              aria-current={cell.today ? "date" : undefined}
            >
              <b>{cell.primary}</b>
              <small>{cell.secondary}</small>
            </div>
          ) : (
            <div className="cal-day empty" key={`empty-${index}`} />
          ),
        )}
      </div>

      <div className="cal-today">
        <div>
          <span className="cal-today-kicker">Today</span>
          <b>{display.ethFull}</b>
          <small>{display.gregFull}</small>
        </div>
        <div className="cal-today-time">
          <b>{display.clock}</b>
          <small>{display.clockSub} · {display.localTime} local</small>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn quiet" type="button" onClick={goToday}>
          Today
        </button>
        <button className="btn primary" type="button" onClick={ui.closeCalendar}>
          Close
        </button>
      </div>
    </Modal>
  );
}