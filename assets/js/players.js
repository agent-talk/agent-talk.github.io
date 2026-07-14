// agent-talk — asciinema-player embedding, pi.dev style.
// Reads data-* attributes on .player containers and instantiates the vendored,
// fully-static asciinema-player. No external / asciinema.org calls at runtime.
//
// Supported attributes:
//   data-cast="/assets/casts/x.cast"   (required) local path to the .cast file
//   data-loop="true"                    loop playback
//   data-autoplay="onscroll|true|false" start on scroll into view, immediately,
//                                        or not at all (default: onscroll)
//   data-speed="1.0"                    playback speed
//   data-idle="2"                       idleTimeLimit seconds
//   data-controls="false"               show player controls
//   data-font="small|medium|big"        terminalFontSize
//   data-theme="asciinema"              player theme

(function () {
  "use strict";

  function boolAttr(el, name, dflt) {
    var v = el.getAttribute(name);
    if (v === null) return dflt;
    return v === "true" || v === "1" || v === "";
  }

  function optionsFor(el) {
    return {
      fit: "width",
      loop: boolAttr(el, "data-loop", false),
      controls: boolAttr(el, "data-controls", false),
      autoPlay: false, // we drive play/pause ourselves
      idleTimeLimit: parseFloat(el.getAttribute("data-idle") || "2"),
      speed: parseFloat(el.getAttribute("data-speed") || "1"),
      terminalFontSize: el.getAttribute("data-font") || "small",
      theme: el.getAttribute("data-theme") || "asciinema",
      poster: "npt:0:01"
    };
  }

  function mount(el) {
    if (!window.AsciinemaPlayer || !el.dataset.cast) return null;
    var player = window.AsciinemaPlayer.create(
      el.dataset.cast,
      el,
      optionsFor(el)
    );
    return player;
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var containers = Array.prototype.slice.call(
      document.querySelectorAll(".player[data-cast]")
    );
    var entries = containers.map(function (el) {
      return { el: el, player: mount(el), started: false,
               mode: el.getAttribute("data-autoplay") || "onscroll" };
    });

    // Immediate autoplay
    entries.forEach(function (e) {
      if (e.player && e.mode === "true") {
        try { e.player.play(); e.started = true; } catch (_) {}
      }
    });

    // Autoplay on scroll into view (pi.dev-style). Pauses off-screen loops.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (obs) {
        obs.forEach(function (entry) {
          var rec = entries.filter(function (e) {
            return e.el === entry.target;
          })[0];
          if (!rec || !rec.player || rec.mode !== "onscroll") return;
          if (entry.isIntersecting) {
            try { rec.player.play(); rec.started = true; } catch (_) {}
          } else if (rec.started) {
            try { rec.player.pause(); } catch (_) {}
          }
        });
      }, { threshold: 0.4 });
      entries.forEach(function (e) {
        if (e.mode === "onscroll") io.observe(e.el);
      });
    } else {
      // No IO support: just play the onscroll ones.
      entries.forEach(function (e) {
        if (e.player && e.mode === "onscroll") {
          try { e.player.play(); } catch (_) {}
        }
      });
    }
  });
})();
