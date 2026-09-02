/* Envision motion: GSAP hero entrance, scroll reveals, card tilt. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ---------- Nav: transparent at top, glass on scroll ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("scrolled", window.scrollY > 10);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Email copy ---------- */
  var emailBtn = document.querySelector(".email-copy");
  if (emailBtn) {
    emailBtn.addEventListener("click", function () {
      var email = emailBtn.getAttribute("data-email");
      function done() {
        emailBtn.classList.add("copied");
        setTimeout(function () { emailBtn.classList.remove("copied"); }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, done);
      } else {
        done();
      }
    });
  }

  /* ---------- Contact form → prefilled email ---------- */
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var name = form.name.value.trim();
      var business = form.business.value.trim();
      var type = form.type.value;
      var need = form.need.value.trim();
      var budget = form.budget.value;
      var subject = "New project enquiry: " + business;
      var body =
        "Name: " + name + "\n" +
        "Business: " + business + "\n" +
        "Project type: " + type + "\n" +
        "Budget range: " + budget + "\n\n" +
        "What we need:\n" + need;
      status.textContent = "Opening your email app with the details filled in…";
      window.location.href =
        "mailto:envision.startup@gmail.com" +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
    });
  }

  /* ---------- Cursor glow, ~120ms lag ---------- */
  if (!reduceMotion && !touch) {
    var glow = document.querySelector(".glow");
    if (glow) {
      var mx = -600, my = -600, gx = -600, gy = -600, glowShown = false;
      document.addEventListener("mousemove", function (e) {
        mx = e.clientX;
        my = e.clientY;
        if (!glowShown) {
          glowShown = true;
          glow.classList.add("on");
        }
      }, { passive: true });
      (function tick() {
        gx += (mx - gx) * 0.14;
        gy += (my - gy) * 0.14;
        glow.style.left = gx + "px";
        glow.style.top = gy + "px";
        requestAnimationFrame(tick);
      })();
    }
  }

  /* ---------- Card tilt (desktop only) ---------- */
  if (!reduceMotion && !touch) {
    document.querySelectorAll(".tilt").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          "perspective(900px) rotateX(" + (-py * 4).toFixed(2) + "deg)" +
          " rotateY(" + (px * 4).toFixed(2) + "deg) translateY(-2px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* ---------- Hero entrance + scroll reveals (GSAP / Lenis) ---------- */
  function initMotion() {
    if (reduceMotion) return;                 /* CSS keeps everything visible */
    if (!window.gsap || !window.ScrollTrigger) return; /* CDN blocked: page stays static, fully visible */

    gsap.registerPlugin(ScrollTrigger);

    var lenis = null;
    if (window.Lenis) {
      lenis = new Lenis({ lerp: 0.09 });      /* a touch more glide */
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var target = document.querySelector(a.getAttribute("href"));
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, { offset: 0 });
          }
        });
      });
    }

    /* Hide reveals only once JS is ready, so a broken script never blanks the page */
    document.documentElement.classList.add("anim-ready");

    /* Hero entrance: headline lines rise, then the rest.
       Held until the loading screen lifts so it is not spent behind the overlay. */
    gsap.set(".hero-el", { y: 18 });
    var heroPlayed = false;
    function playHero() {
      if (heroPlayed) return;
      heroPlayed = true;
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .to(".hero-title .line-inner", { y: 0, duration: 1, stagger: 0.14 }, 0.15)
        .to(".hero-el", { opacity: 1, y: 0, duration: 0.9, stagger: 0.1 }, 0.55);
    }
    if (window.__envLoaderDone) {
      playHero();
    } else {
      window.addEventListener("env:loaded", playHero, { once: true });
      setTimeout(playHero, 3500);   /* past the loader's hard cap; never leave the hero hidden */
    }

    /* Hero copy drifts up and fades as you scroll away */
    gsap.to(".hero-inner", {
      yPercent: 12,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    /* Section reveals */
    document.querySelectorAll("section:not(.hero)").forEach(function (section) {
      var items = section.querySelectorAll(".reveal");
      if (!items.length) return;
      gsap.set(items, { y: 26 });
      ScrollTrigger.create({
        trigger: section,
        start: "top 75%",                     /* fires at 25% viewport entry */
        once: true,
        onEnter: function () {
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.08,
            overwrite: true
          });
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMotion);
  } else {
    initMotion();
  }
})();
