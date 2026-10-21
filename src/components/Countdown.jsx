import { useMemo } from 'react';
import { CalendarClock, Flag, Hourglass } from 'lucide-react';
import { APPRAISAL_DATE, COUNTDOWN_START } from '../lib/constants';
import { countWeekdays, diffDays, fmtLong, toKey } from '../lib/dates';
import { useNow } from '../context/DataContext';

const two = (n) => String(n).padStart(2, '0');

export default function Countdown() {
  const now = useNow(1000);
  const today = toKey(now);

  const total = diffDays(COUNTDOWN_START, APPRAISAL_DATE); // 162 days
  const daysLeft = Math.max(0, diffDays(today, APPRAISAL_DATE));
  const elapsed = Math.min(total, Math.max(0, diffDays(COUNTDOWN_START, today)));
  const pct = total > 0 ? (elapsed / total) * 100 : 100;
  const reached = daysLeft === 0;

  const workdays = useMemo(() => countWeekdays(today, APPRAISAL_DATE), [today]);
  const weeks = Math.floor(daysLeft / 7);
  const extraDays = daysLeft % 7;

  // Time until the counter drops by one (local midnight)
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = Math.max(0, midnight - now);
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor((ms % 3600000) / 60000);
  const ss = Math.floor((ms % 60000) / 1000);

  const digits = String(daysLeft).padStart(3, '0').split('');

  return (
    <section className="countdown clay" aria-label="Appraisal countdown">
      <div className="cd-main">
        <div className="cd-eyebrow">
          <Hourglass size={16} /> Appraisal countdown
        </div>
        <div className="cd-digits" aria-label={`${daysLeft} days remaining`}>
          <span className="cd-number">
            {digits.map((d, i) => (
              <span key={`${i}-${d}`} className="cd-digit">
                {d}
              </span>
            ))}
          </span>
          <span className="cd-unit">{daysLeft === 1 ? 'day' : 'days'}<br />to go</span>
        </div>
        <div className="cd-tick">
          {reached ? (
            'Appraisal day is here — good luck!'
          ) : (
            <>
              Drops to <b>{daysLeft - 1}</b> in{' '}
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
            <strong>{weeks}</strong>
            <span>
              weeks{extraDays ? ` + ${extraDays}d` : ''}
            </span>
          </div>
          <div>
            <strong>{workdays}</strong>
            <span>weekdays left</span>
          </div>
        </div>
        <div className="cd-progress">
          <div className="cd-progress-label">
            <CalendarClock size={14} />
            Day {Math.min(elapsed + 1, total)} of {total} · {Math.round(pct)}% of the journey
          </div>
          <div className="cd-track">
            <div className="cd-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
