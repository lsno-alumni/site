"use client";

import { useEffect, useRef } from "react";

// Révèle son contenu à l'entrée dans le viewport (classe .rev -> .vu).
export default function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const io = new IntersectionObserver(
      (entrees) => entrees.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("vu"); io.unobserve(e.target); }
      }),
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rev ${className}`}>{children}</div>;
}
