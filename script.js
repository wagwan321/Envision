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

  /* ---------- Interactive 3D Möbius object ---------- */
  var canvas = document.getElementById("hero-canvas");
  var visual = document.getElementById("hero-visual");

  if (canvas && visual) {
    var context = canvas.getContext("2d");
    var width = 0;
    var height = 0;
    var pixelRatio = 1;
    var sceneVisible = true;
    var scenePausedForScroll = false;
    var scrollResumeTimer = 0;
    var animationFrame = 0;
    var pointerX = 0;
    var pointerY = 0;
    var targetX = 0;
    var targetY = 0;
    var startTime = performance.now();
    var lastDrawTime = 0;
    var frameInterval = coarsePointer ? 1000 / 24 : 0;

    var particles = [];
    var particleCount = coarsePointer ? 16 : 24;
    for (var particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
      var phi = Math.acos(1 - 2 * (particleIndex + 0.5) / particleCount);
      var theta = Math.PI * (1 + Math.sqrt(5)) * particleIndex;
      particles.push({
        x: Math.sin(phi) * Math.cos(theta) * 2.22,
        y: Math.cos(phi) * 2.22,
        z: Math.sin(phi) * Math.sin(theta) * 2.22,
        size: 0.7 + (particleIndex % 5) * 0.16
      });
    }

    function resizeCanvas() {
      var bounds = visual.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      pixelRatio = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1 : 1.3);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (reduceMotion) drawScene(performance.now());
      else requestSceneFrame();
    }

    function rotatePoint(point, rotationX, rotationY, rotationZ) {
      var cosY = Math.cos(rotationY);
      var sinY = Math.sin(rotationY);
      var x1 = point.x * cosY - point.z * sinY;
      var z1 = point.x * sinY + point.z * cosY;

      var cosX = Math.cos(rotationX);
      var sinX = Math.sin(rotationX);
      var y2 = point.y * cosX - z1 * sinX;
      var z2 = point.y * sinX + z1 * cosX;

      var cosZ = Math.cos(rotationZ);
      var sinZ = Math.sin(rotationZ);
      return {
        x: x1 * cosZ - y2 * sinZ,
        y: x1 * sinZ + y2 * cosZ,
        z: z2
      };
    }

    function project(point, scale) {
      var camera = 5.7;
      var depth = camera / Math.max(2.6, camera - point.z);
      return {
        x: width * 0.5 + point.x * scale * depth,
        y: height * 0.48 + point.y * scale * depth,
        depth: depth,
        z: point.z
      };
    }

    function mobiusPoint(u, v) {
      var radius = 1.36;
      var edge = radius + v * Math.cos(u * 0.5);
      return {
        x: edge * Math.cos(u),
        y: edge * Math.sin(u),
        z: v * Math.sin(u * 0.5)
      };
    }

    function drawPolyline(points, color, lineWidth) {
      if (points.length < 2) return;
      var depth = 0;
      var perspective = 0;
      points.forEach(function (point) {
        depth += point.z;
        perspective += point.depth;
      });
      depth /= points.length;
      perspective /= points.length;
      var alpha = Math.max(0.1, Math.min(0.62, 0.3 + depth * 0.14));
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (var lineIndex = 1; lineIndex < points.length; lineIndex += 1) {
        context.lineTo(points[lineIndex].x, points[lineIndex].y);
      }
      context.strokeStyle = color.replace("ALPHA", alpha.toFixed(3));
      context.lineWidth = lineWidth * perspective;
      context.stroke();
    }

    function requestSceneFrame() {
      if (reduceMotion || !sceneVisible || scenePausedForScroll || document.hidden || animationFrame) return;
      animationFrame = requestAnimationFrame(drawScene);
    }

    function drawScene(now) {
      animationFrame = 0;
      if (!context || !width || !height) return;
      if (!reduceMotion && now - lastDrawTime < frameInterval) {
        requestSceneFrame();
        return;
      }
      lastDrawTime = now;
      context.clearRect(0, 0, width, height);

      var elapsed = reduceMotion ? 1200 : now - startTime;
      pointerX += (targetX - pointerX) * 0.18;
      pointerY += (targetY - pointerY) * 0.18;
      var rotationY = elapsed * 0.00007 + pointerX * 1.15;
      var rotationX = -0.52 + Math.sin(elapsed * 0.00011) * 0.05 + pointerY * 0.72;
      var rotationZ = 0.18 + Math.sin(elapsed * 0.00013) * 0.1;
      var scale = Math.min(width, height) * 0.205;

      context.save();
      context.globalCompositeOperation = "lighter";
      context.shadowColor = "rgba(49,239,160,0.22)";
      context.shadowBlur = coarsePointer ? 0 : 2;

      var vSteps = coarsePointer ? 6 : 8;
      var uSteps = coarsePointer ? 40 : 52;
      for (var vIndex = 0; vIndex < vSteps; vIndex += 1) {
        var v = -0.52 + (vIndex / (vSteps - 1)) * 1.04;
        var ribbon = [];
        for (var uIndex = 0; uIndex <= uSteps; uIndex += 1) {
          var u = (uIndex / uSteps) * Math.PI * 2;
          var rotated = rotatePoint(mobiusPoint(u, v), rotationX, rotationY, rotationZ);
          ribbon.push(project(rotated, scale));
        }
        var mix = vIndex / Math.max(1, vSteps - 1);
        var ribbonColor = mix > 0.55 ? "rgba(83,203,208,ALPHA)" : "rgba(49,239,160,ALPHA)";
        drawPolyline(ribbon, ribbonColor, vIndex === 0 || vIndex === vSteps - 1 ? 1.5 : 0.7);
      }

      var crossEvery = coarsePointer ? 10 : 8;
      for (var crossIndex = 0; crossIndex < uSteps; crossIndex += crossEvery) {
        var crossLine = [];
        var crossU = (crossIndex / uSteps) * Math.PI * 2;
        for (var edgeIndex = 0; edgeIndex <= 9; edgeIndex += 1) {
          var crossV = -0.52 + (edgeIndex / 9) * 1.04;
          var crossRotated = rotatePoint(mobiusPoint(crossU, crossV), rotationX, rotationY, rotationZ);
          crossLine.push(project(crossRotated, scale));
        }
        drawPolyline(crossLine, "rgba(159,248,210,ALPHA)", 0.55);
      }

      context.shadowBlur = coarsePointer ? 0 : 2;
      particles.forEach(function (particle, index) {
        var drifting = {
          x: particle.x,
          y: particle.y + Math.sin(elapsed * 0.0005 + index) * 0.035,
          z: particle.z
        };
        var particleRotated = rotatePoint(drifting, rotationX * 0.45, -rotationY * 0.28, rotationZ);
        var screen = project(particleRotated, scale);
        var alpha = Math.max(0.08, Math.min(0.65, 0.18 + screen.z * 0.11));
        context.beginPath();
        context.arc(screen.x, screen.y, particle.size * screen.depth, 0, Math.PI * 2);
        context.fillStyle = index % 4 === 0 ? "rgba(83,203,208," + alpha + ")" : "rgba(49,239,160," + alpha + ")";
        context.fill();
      });
      context.restore();

      var glow = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.min(width,height) * 0.32);
      glow.addColorStop(0, "rgba(49,239,160,0.075)");
      glow.addColorStop(1, "rgba(49,239,160,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      requestSceneFrame();
    }

    function clampRange(value) {
      return value < -1.4 ? -1.4 : value > 1.4 ? 1.4 : value;
    }

    function trackPointer(event) {
      if (coarsePointer) return;
      var bounds = visual.getBoundingClientRect();
      var centreX = bounds.left + bounds.width * 0.5;
      var centreY = bounds.top + bounds.height * 0.48;
      targetX = clampRange((event.clientX - centreX) / (window.innerWidth * 0.5));
      targetY = clampRange((event.clientY - centreY) / (window.innerHeight * 0.5));
      scenePausedForScroll = false;
      requestSceneFrame();
    }

    window.addEventListener("pointermove", trackPointer, { passive: true });

    document.addEventListener("pointerleave", function () {
      targetX = 0;
      targetY = 0;
      requestSceneFrame();
    });

    if ("ResizeObserver" in window) new ResizeObserver(resizeCanvas).observe(visual);
    else window.addEventListener("resize", resizeCanvas);

    if ("IntersectionObserver" in window && !reduceMotion) {
      new IntersectionObserver(function (entries) {
        sceneVisible = entries[0].isIntersecting;
        if (!sceneVisible && animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        if (sceneVisible) requestSceneFrame();
      }, { threshold: 0.02 }).observe(visual);
    }

    if (!reduceMotion) {
      window.addEventListener("scroll", function () {
        scenePausedForScroll = true;
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        window.clearTimeout(scrollResumeTimer);
        scrollResumeTimer = window.setTimeout(function () {
          scenePausedForScroll = false;
          requestSceneFrame();
        }, 140);
      }, { passive: true });

      document.addEventListener("visibilitychange", function () {
        if (document.hidden && animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        } else {
          requestSceneFrame();
        }
      });
    }

    resizeCanvas();
    requestSceneFrame();
  }

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
