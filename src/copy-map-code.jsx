import React, { useEffect, useRef, useState } from "react";
import { copyText } from "./clipboard.js";

export function CopyMapCode({ code }) {
  const [state, setState] = useState("idle");
  const mounted = useRef(false);
  const pending = useRef(false);
  const value = String(code ?? "");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2400);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    if (pending.current || !value) return;
    pending.current = true;
    setState("copying");
    try {
      await copyText(value);
      if (mounted.current) setState("copied");
    } catch (_) {
      if (mounted.current) setState("error");
    } finally {
      pending.current = false;
    }
  };
  return <div className="map-code">
    <span>맵 코드</span><strong className="map-code-value">{value}</strong>
    <button type="button" className="copy-code-button" data-state={state} onClick={copy} disabled={!value || state === "copying"} aria-label={`${value} 맵 코드 복사`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {state === "copied" ? <path d="m5 12 4.5 4.5L19 7" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>}
      </svg>
      <span>{state === "copied" ? "복사됨" : state === "copying" ? "복사 중" : "복사"}</span>
    </button>
    <small className={state === "error" ? "copy-code-error" : "sr-only"} role="status" aria-live="polite">
      {state === "error" ? "복사하지 못했어요. 코드를 직접 선택해 복사해 주세요." : state === "copied" ? `맵 코드 ${value} 복사 완료` : ""}
    </small>
  </div>;
}
