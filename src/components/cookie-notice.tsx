"use client";

import { useEffect, useState } from "react";

const storageKey = "pramana-cookie-notice-v1";

/**
 * Pramana does not load advertising or analytics cookies in the public demo.
 * The acknowledgement itself stays in local storage instead of adding another
 * browser cookie, and the notice remains visible when storage is unavailable.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(storageKey) !== "acknowledged");
    } catch {
      setVisible(true);
    }
  }, []);

  function acknowledge() {
    try {
      localStorage.setItem(storageKey, "acknowledged");
    } catch {
      // Privacy notice is still dismissible even in a restricted browser.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return <aside className="cookie-notice" aria-labelledby="cookie-notice-title" role="dialog">
    <h2 id="cookie-notice-title">Privacy, kept simple</h2>
    <p>This demo does not use advertising or analytics cookies. It stores only essential local preferences, such as theme and this acknowledgement.</p>
    <div className="cookie-notice-actions"><button type="button" onClick={acknowledge}>Got it</button><a href="/help#privacy">Privacy details</a></div>
  </aside>;
}
