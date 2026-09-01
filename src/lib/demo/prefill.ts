export type DemoFormValue = string | boolean | string[];

/**
 * Presentation-only form prefilling. This deliberately dispatches the same
 * input/change events as a user edit and never submits or persists anything.
 */
export function prefillForm(
  form: HTMLFormElement | null,
  values: Record<string, DemoFormValue>,
) {
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    const controls = Array.from(form.elements).filter(
      (control): control is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement,
    ).filter((control) => control.name === name);

    for (const control of controls) {
      if (control instanceof HTMLInputElement && control.type === "file") continue;
      if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
        control.checked = typeof value === "boolean" ? value : value === control.value;
      } else if (control instanceof HTMLSelectElement && control.multiple) {
        const selected = new Set(Array.isArray(value) ? value : [String(value)]);
        Array.from(control.options).forEach((option) => { option.selected = selected.has(option.value); });
      } else {
        control.value = Array.isArray(value) ? value[0] ?? "" : String(value);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

export function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
