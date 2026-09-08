import React, { useEffect, useRef } from "react";

// Track real header sizes so enlarged text cannot put the chapter bar over the nav.
export function useStickyOffsets(route) {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector(".site-header-wrap");
    const chapters = document.querySelector(".chapter-links");
    const update = () => {
      root.style.setProperty("--header-height", `${header?.getBoundingClientRect().height || 80}px`);
      root.style.setProperty("--chapter-height", `${chapters?.getBoundingClientRect().height || 0}px`);
    };
    update();
    const observer = "ResizeObserver" in window ? new ResizeObserver(update) : null;
    if (header) observer?.observe(header);
    if (chapters) observer?.observe(chapters);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--header-height");
      root.style.removeProperty("--chapter-height");
    };
  }, [route]);
}

// Progressive enhancement: content stays readable without observers or motion.
export function Reveal({ as: Element = "div", className = "", children, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || preference.matches || !("IntersectionObserver" in window)) return;

    const reveal = () => {
      element.classList.remove("reveal-pending");
      observer.disconnect();
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reveal();
    }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });

    // Never hide content already on screen, including after a hash navigation.
    if (element.getBoundingClientRect().top >= window.innerHeight) {
      element.classList.add("reveal-pending");
      observer.observe(element);
    }
    const onPreference = () => { if (preference.matches) reveal(); };
    element.addEventListener("focusin", reveal);
    preference.addEventListener("change", onPreference);
    return () => {
      observer.disconnect();
      element.classList.remove("reveal-pending");
      element.removeEventListener("focusin", reveal);
      preference.removeEventListener("change", onPreference);
    };
  }, []);
  return <Element ref={ref} className={`reveal ${className}`} {...props}>{children}</Element>;
}

export function Disclosure({ eyebrow, title, children, className = "", open = false }) {
  return <details className={`detail-disclosure ${className}`} open={open || undefined}>
    <summary>
      <span>{eyebrow && <span className="section-kicker">{eyebrow}</span>}<strong>{title}</strong></span>
      <span className="disclosure-action"><span className="when-closed">자세히 보기</span><span className="when-open">접기</span><i aria-hidden="true">+</i></span>
    </summary>
    <div className="disclosure-content">{children}</div>
  </details>;
}

export function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}
