// Copy only after an explicit user click. Never report success after a rejected write.
export async function copyText(value, { clipboard = globalThis.navigator?.clipboard, document = globalThis.document } = {}) {
  const text = String(value ?? "");
  if (!text) throw new Error("No map code to copy");
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return;
    } catch (_) {
      // Older browsers and restricted clipboard contexts can use selection-based copy.
    }
  }
  if (!document?.body || typeof document.execCommand !== "function") throw new Error("Copy unavailable");
  const previousFocus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.setAttribute("aria-hidden", "true");
  Object.assign(field.style, { position:"fixed", left:"0", top:"0", width:"1px", height:"1px", opacity:"0", fontSize:"16px" });
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    if (!document.execCommand("copy")) throw new Error("Copy rejected");
  } finally {
    field.remove();
    previousFocus?.focus({ preventScroll:true });
  }
}
