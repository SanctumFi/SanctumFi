import { useEffect } from "react";

export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -48px 0px" }
    );

    document.querySelectorAll(".sr").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}
