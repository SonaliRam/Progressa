import { useMemo } from "react";
import { CalendarClock, Flag, Hourglass } from "lucide-react";
import { useCountdownSettings } from "../lib/countdown";
import { countWeekdays, diffDays, fmtLong, toKey } from "../lib/dates";
import { useNow } from "../context/DataContext";

const two = (n) => String(n).padStart(2, "0");

export default function Countdown() {
  const now = useNow(1000);
  const today = toKey(now);
  const {
    label,
    targetDate: APPRAISAL_DATE,
    startDate,
  } = useCountdownSettings();
  // Start must be before the target for the progress bar to make sense.
  const COUNTDOWN_START =
    startDate && startDate < APPRAISAL_DATE ? startDate : today;

  const total = diffDays(COUNTDOWN_START, APPRAISAL_DATE);
  const daysLeft = Math.max(0, diffDays(startDate, APPRAISAL_DATE));
  const elapsed = Math.min(
    total,
    Math.max(0, diffDays(COUNTDOWN_START, today)),
  );
  const pct = total > 0 ? (elapsed / total) * 100 : 100;
  const reached = daysLeft === 0;

  const workdays = useMemo(
    () => countWeekdays(startDate, APPRAISAL_DATE),
    [startDate, APPRAISAL_DATE],
  );
  const months = Math.floor(daysLeft / 30);
  const remainingDays = daysLeft % 30;
  const extraDays = daysLeft % 7;

  // Time until the counter drops by one (local midnight)
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const ms = Math.max(0, midnight - now);
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);

  const digits = String(daysLeft).padStart(3, "0").split("");

  return (
    <section className="countdown clay" aria-label={label}>
      <div className="cd-main">
        <div className="cd-eyebrow">
          <Hourglass size={16} /> {label}
        </div>
        <div className="cd-digits" aria-label={`${daysLeft} days remaining`}>
          <span className="cd-number">
            {digits.map((d, i) => (
              <span key={`${i}-${d}`} className="cd-digit">
                {d}
              </span>
            ))}
          </span>
          <span className="cd-unit">
            {daysLeft === 1 ? "day" : "days"}
            <br />
            to go
          </span>
        </div>
        <div className="cd-tick">
          {reached ? (
            "The day is here — good luck!"
          ) : (
            <>
              Drops to <b>{daysLeft - 1}</b> in{" "}
              <span className="mono">
                {two(hh)}:{two(mm)}:{two(ss)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="cd-side">
        <div className="cd-target">
          <Flag size={16} />
          <div>
            <span>Target</span>
            <strong>{fmtLong(APPRAISAL_DATE)}</strong>
          </div>
        </div>
        <div className="cd-facts">
          <div>
            <strong>
              {months} <span>Month +</span> {remainingDays}{" "}
              <span>Days Left</span>
            </strong>
          </div>
          <div>
            <strong>
              {workdays} 
              <span> Weekdays Left</span>
            </strong>
          </div>
        </div>
        <div className="cd-progress">
          <div className="cd-progress-label">
            <CalendarClock size={14} />
            Day {Math.min(elapsed + 1, Math.max(total, 1))} of{" "}
            {Math.max(total, 1)} · {Math.round(pct)}% of the journey
          </div>
          <div className="cd-track">
            <div
              className="cd-fill"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
