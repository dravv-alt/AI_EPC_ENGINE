"use client";

import { Check, Palette, Search, Shuffle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ThemePreset = {
  id: string;
  name: string;
  mode: "light" | "dark";
  colors: [string, string, string, string, string];
};

export const themePresets: ThemePreset[] = [
  { id: "soft-pop", name: "Soft Pop", mode: "light", colors: ["#ef75a7", "#f6c96f", "#9edbc1", "#a8b9ff", "#fff8f2"] },
  { id: "pramana-light", name: "Pramana Light", mode: "light", colors: ["#245f52", "#79aa96", "#e8b173", "#e8ece7", "#fbfaf6"] },
  { id: "modern-minimal", name: "Modern Minimal", mode: "light", colors: ["#3478f6", "#f5f5f3", "#d9efff", "#ffffff", "#161817"] },
  { id: "midnight-bloom", name: "Midnight Bloom", mode: "dark", colors: ["#7657e8", "#8ac7ff", "#8f9a68", "#181724", "#f6f1e8"] },
  { id: "mocha-mousse", name: "Mocha Mousse", mode: "light", colors: ["#a8755b", "#b8a486", "#ead0c1", "#f4efe5", "#30251f"] },
  { id: "mono", name: "Mono", mode: "light", colors: ["#6f6d68", "#dad9d5", "#f2f1ed", "#ffffff", "#171717"] },
  { id: "nature", name: "Nature", mode: "light", colors: ["#287c36", "#eaf1dc", "#c9ebd0", "#fffaf0", "#17331e"] },
  { id: "northern-lights", name: "Northern Lights", mode: "dark", colors: ["#31ac55", "#6497e8", "#63d3e8", "#121923", "#edf7f5"] },
];

function findPreset(id: string | null) {
  return themePresets.find((preset) => preset.id === id);
}

function applyPreset(preset: ThemePreset) {
  document.documentElement.dataset.theme = preset.mode;
  document.documentElement.dataset.palette = preset.id;
  localStorage.setItem("pramana-theme", preset.mode);
  localStorage.setItem("pramana-theme-preset", preset.id);
}

export function ThemeToggle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState("soft-pop");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = useMemo(() => themePresets.filter((preset) => preset.name.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const active = findPreset(activeId) ?? themePresets[0];

  useEffect(() => {
    const storedPreset = findPreset(localStorage.getItem("pramana-theme-preset"));
    const storedMode = localStorage.getItem("pramana-theme");
    const next = storedPreset ?? (storedMode === "dark" ? findPreset("midnight-bloom")! : findPreset("soft-pop")!);
    setActiveId(next.id);
    applyPreset(next);
  }, []);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, []);

  function choose(preset: ThemePreset) {
    setActiveId(preset.id);
    applyPreset(preset);
    setOpen(false);
    setQuery("");
  }

  function randomize() {
    const choices = themePresets.filter((preset) => preset.id !== activeId);
    choose(choices[Math.floor(Math.random() * choices.length)] ?? themePresets[0]);
  }

  return <div className="theme-picker" ref={rootRef}>
    <button className="icon-button theme-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-label={`Change theme. Current theme: ${active.name}`} aria-expanded={open} title={`Theme: ${active.name}`}><Palette size={18} /><span className="theme-button-dot" style={{ background: active.colors[0] }} /></button>
    {open && <section className="theme-menu" aria-label="Application themes">
      <header><div><p className="eyebrow">Appearance</p><h2>Choose a theme</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close theme picker"><X size={17} /></button></header>
      <label className="theme-search"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search themes…" /></label>
      <div className="theme-menu-summary"><span>{visible.length} themes</span><button type="button" onClick={randomize} aria-label="Choose a random theme" title="Surprise me"><Shuffle size={17} /></button></div>
      <div className="theme-options">
        {visible.map((preset) => <button type="button" className={preset.id === activeId ? "is-active" : ""} onClick={() => choose(preset)} key={preset.id}>
          <span className="theme-swatches" aria-hidden="true">{preset.colors.map((color, index) => <i style={{ background: color }} key={`${preset.id}-${index}`} />)}</span>
          <span>{preset.name}</span>
          <small>{preset.mode}</small>
          {preset.id === activeId && <Check size={16} />}
        </button>)}
        {!visible.length && <p>No themes match “{query}”.</p>}
      </div>
    </section>}
  </div>;
}
