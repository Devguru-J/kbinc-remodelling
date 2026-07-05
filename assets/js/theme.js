/* KB Inc. — shared Tailwind config, language toggle, scroll reveal
   Loaded AFTER the Tailwind Play CDN so `tailwind.config` is read on the fly. */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "charcoal-void": "#141414",
        "graphite-surface": "#1E1E1E",
        "steel-panel": "#262626",
        "bright-alloy": "#F5F5F5",
        "muted-zinc": "#8A8A8A",
        "hairline-steel": "rgba(245,245,245,0.10)",
        "arterial-red": "#C8102E",
        "arterial-red-dim": "#9E0C24",
      },
      borderRadius: { DEFAULT: "2px", lg: "2px", xl: "2px" },
      maxWidth: { container: "1400px" },
      spacing: { "section-v": "clamp(4rem, 10vw, 8rem)", gutter: "1.5rem" },
      fontFamily: {
        display: ["Space Grotesk", "Pretendard Variable", "Pretendard", "sans-serif"],
        body: ["Pretendard Variable", "Pretendard", "Hanken Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "Pretendard Variable", "monospace"],
      },
      letterSpacing: { tightest: "-0.03em" },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { float: "float 6s ease-in-out infinite" },
    },
  },
};

document.addEventListener("DOMContentLoaded", function () {
  /* ---- Language toggle (KO <-> EN) ---- */
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("kb-lang"); } catch (e) {}
  if (saved === "en") root.classList.add("lang-en");

  function syncToggle() {
    var en = root.classList.contains("lang-en");
    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.querySelector("[data-ko]").classList.toggle("text-bright-alloy", !en);
      btn.querySelector("[data-ko]").classList.toggle("text-muted-zinc", en);
      btn.querySelector("[data-en]").classList.toggle("text-bright-alloy", en);
      btn.querySelector("[data-en]").classList.toggle("text-muted-zinc", !en);
    });
    root.setAttribute("lang", en ? "en" : "ko");
  }
  document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      root.classList.toggle("lang-en");
      try { localStorage.setItem("kb-lang", root.classList.contains("lang-en") ? "en" : "ko"); } catch (e) {}
      syncToggle();
    });
  });
  syncToggle();

  /* ---- Mobile menu ---- */
  var mnav = document.getElementById("mobile-nav");
  document.querySelectorAll("[data-menu-toggle]").forEach(function (b) {
    b.addEventListener("click", function () { if (mnav) mnav.classList.toggle("hidden"); });
  });

  /* ---- Scroll reveal (weighty, staggered) ---- */
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll("[data-reveal],[data-reveal-x]").forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i % 4, 3) * 80) + "ms";
      io.observe(el);
    });
  } else {
    document.querySelectorAll("[data-reveal],[data-reveal-x]").forEach(function (el) { el.classList.add("is-in"); });
  }
});
