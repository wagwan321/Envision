(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  /* ---------- Short, deterministic loading transition ---------- */
  var loader = document.getElementById("loader");
  var loaderPercent = document.getElementById("loader-percent");
  var loaderProgress = document.getElementById("loader-progress");
  var loaderFinished = false;

  function finishLoader() {
    if (loaderFinished) return;
    loaderFinished = true;
    if (loaderPercent) loaderPercent.textContent = "100";
    if (loaderProgress) loaderProgress.style.transform = "scaleX(1)";
    root.classList.add("is-ready");
    root.classList.remove("is-loading");
    if (loader) {
      loader.setAttribute("aria-hidden", "true");
      window.setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 760);
    }
  }

  if (reduceMotion) {
    finishLoader();
  } else {
    var loaderStart = performance.now();
    var loaderDuration = 1050;
    function updateLoader(now) {
      if (loaderFinished) return;
      var raw = Math.min(1, (now - loaderStart) / loaderDuration);
      var eased = 1 - Math.pow(1 - raw, 3);
      var value = Math.min(100, Math.floor(eased * 100));
      if (loaderPercent) loaderPercent.textContent = String(value).padStart(2, "0");
      if (loaderProgress) loaderProgress.style.transform = "scaleX(" + eased.toFixed(3) + ")";
      if (raw < 1) requestAnimationFrame(updateLoader);
      else finishLoader();
    }
    requestAnimationFrame(updateLoader);
    window.setTimeout(finishLoader, 1450);
  }

  /* ---------- Navigation and scroll state ---------- */
  var topbar = document.getElementById("topbar");
  var menuToggle = document.getElementById("menu-toggle");
  var navigation = document.getElementById("site-navigation");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
  var sections = navLinks.map(function (link) {
    return document.getElementById(link.getAttribute("data-section"));
  }).filter(Boolean);

  function closeMenu() {
    if (!menuToggle || !navigation) return;
    menuToggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }

  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", function () {
      var next = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(next));
      navigation.classList.toggle("is-open", next);
      document.body.classList.toggle("menu-open", next);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (!navigation.classList.contains("is-open")) return;
      if (!topbar.contains(event.target)) closeMenu();
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function () {
      closeMenu();
    });
  });

  var scrollTicking = false;
  function updateScrollState() {
    scrollTicking = false;
    var marker = window.scrollY + Math.min(260, window.innerHeight * 0.34);
    var activeId = "home";
    sections.forEach(function (section) {
      if (section.offsetTop <= marker) activeId = section.id;
    });

    navLinks.forEach(function (link) {
      var current = link.getAttribute("data-section") === activeId;
      link.classList.toggle("is-active", current);
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (topbar) topbar.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  window.addEventListener("scroll", function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateScrollState);
  }, { passive: true });
  updateScrollState();

  /* ---------- Section reveals ---------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9% 0px", threshold: 0.08 });

    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = Math.min((index % 4) * 45, 135) + "ms";
      revealObserver.observe(item);
    });
  }

  /* The hero object lives in hero-scene.js (WebGL). */

  /* ---------- Pause decorative CSS motion outside the viewport ---------- */
  var animatedDecorations = Array.prototype.slice.call(document.querySelectorAll(".ticker-track, .project-film, .project-tour"));
  if ("IntersectionObserver" in window && !reduceMotion) {
    var motionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-paused", !entry.isIntersecting);
      });
    }, { rootMargin: "120px 0px", threshold: 0.01 });
    animatedDecorations.forEach(function (item) { motionObserver.observe(item); });
  }

  /* ---------- Small magnetic affordance on precise pointers ---------- */
  if (!coarsePointer && !reduceMotion) {
    document.querySelectorAll(".magnetic").forEach(function (button) {
      button.addEventListener("pointermove", function (event) {
        var bounds = button.getBoundingClientRect();
        var x = event.clientX - bounds.left - bounds.width * 0.5;
        var y = event.clientY - bounds.top - bounds.height * 0.5;
        button.style.transform = "translate(" + (x * 0.08).toFixed(1) + "px," + (y * 0.12).toFixed(1) + "px)";
      });
      button.addEventListener("pointerleave", function () {
        button.style.transform = "";
      });
    });
  }

  /* ---------- Contact handoff ---------- */
  var contactForm = document.getElementById("contact-form");
  var formStatus = document.getElementById("form-status");
  if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }

      var fields = contactForm.elements;
      var subject = "Project enquiry from " + fields.name.value.trim();
      var body = [
        "Name: " + fields.name.value.trim(),
        "Email: " + fields.email.value.trim(),
        "Project type: " + fields.type.value,
        "Budget: " + (fields.budget.value || "Not specified"),
        "",
        "Project details:",
        fields.message.value.trim()
      ].join("\n");

      if (formStatus) formStatus.textContent = "Opening your email app with the details ready…";
      window.location.href = "mailto:envision.startup@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
