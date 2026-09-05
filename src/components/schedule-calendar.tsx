"use client";

import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

type Assignment = { id: string; taskId: string; taskName: string; startAt: Date | string; endAt: Date | string; isCritical: boolean };

const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
const googleStamp = (value: Date | string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function googleEventUrl(item: Assignment) {
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: item.taskName,
    dates: `${googleStamp(item.startAt)}/${googleStamp(item.endAt)}`,
    details: `Pramana controlled schedule task. ${item.isCritical ? "Critical path." : "Current deterministic baseline."}`
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export function ScheduleCalendar({ assignments, versionNumber, solverStatus, generatedAt, solverVersion, saving, onRebaseline }: { assignments: Assignment[]; versionNumber: number; solverStatus: string; generatedAt: Date | string; solverVersion: string; saving: boolean; onRebaseline: () => void }) {
  const initial = assignments.length ? new Date(assignments[0].startAt) : new Date();
  const [cursor, setCursor] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedId, setSelectedId] = useState(assignments[0]?.id ?? "");
  const selected = assignments.find((item) => item.id === selectedId) ?? assignments[0];
  const days = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [cursor]);
  const dayItems = (day: Date) => assignments.filter((item) => {
    const start = new Date(item.startAt); const end = new Date(item.endAt);
    const floor = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const ceiling = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return start < ceiling && end >= floor;
  });

  return <section className="surface schedule-calendar-surface">
    <header className="schedule-calendar-header">
      <div><span className={`source-status ${["OPTIMAL", "FEASIBLE"].includes(solverStatus) ? "processed" : "pending"}`}>{solverStatus}</span><h2>Controlled calendar · version {versionNumber}</h2><p>{solverVersion} · generated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(generatedAt))}</p></div>
      <div><a className="button button-secondary" href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer"><CalendarDays size={15} /> Open Google Calendar <ExternalLink size={13} /></a><button className="button button-secondary" onClick={onRebaseline} disabled={saving}><RefreshCw size={15} /> Re-baseline</button></div>
    </header>
    <div className="schedule-calendar-toolbar"><button className="icon-button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft /></button><div><h3>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(cursor)}</h3><button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button></div><button className="icon-button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight /></button></div>
    <div className="schedule-calendar-layout">
      <div className="schedule-month"><div className="schedule-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="schedule-days">{days.map((day) => { const items = dayItems(day); return <div className={`${day.getMonth() !== cursor.getMonth() ? "is-outside" : ""} ${sameDay(day, new Date()) ? "is-today" : ""}`} key={day.toISOString()}><time>{day.getDate()}</time>{items.slice(0, 3).map((item) => <button className={item.isCritical ? "is-critical" : ""} onClick={() => setSelectedId(item.id)} title={item.taskName} key={item.id}>{item.taskName}</button>)}{items.length > 3 && <small>+{items.length - 3} more</small>}</div>; })}</div></div>
      <aside className="schedule-day-detail">{selected ? <><p className="eyebrow">Selected task</p><h3>{selected.taskName}</h3><span className={`source-status ${selected.isCritical ? "pending" : "processed"}`}>{selected.isCritical ? "Critical path" : "Scheduled"}</span><dl><div><dt>Starts</dt><dd>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.startAt))}</dd></div><div><dt>Ends</dt><dd>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.endAt))}</dd></div></dl><a className="button button-primary" href={googleEventUrl(selected)} target="_blank" rel="noreferrer"><CalendarDays size={15} /> Add to Google Calendar</a><p className="calendar-authority-note">Google Calendar is a coordination copy. The controlled CP-SAT baseline remains authoritative in Pramana.</p></> : <><CalendarDays /><h3>No scheduled tasks</h3><p>Accept tasks and solve a baseline to populate the calendar.</p></>}</aside>
    </div>
  </section>;
}
