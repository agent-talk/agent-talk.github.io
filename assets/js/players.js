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
//   data-font="small|medium|big|<px>"   terminalFontSize (a px value is used
//                                        only when data-fit="none")
//   data-fit="width|none"               "width" auto-scales glyphs to the
//                                        container (default); "none" keeps a
//                                        fixed terminalFontSize so a full-width
//                                        terminal renders at a chosen px size.
//                                        When the container is too narrow for
//                                        the fixed-size grid (phones, tablets),
//                                        "none" falls back to "width" so the
//                                        whole terminal stays visible
//   data-theme="asciinema"              player theme
//   data-sync-group="name"              lockstep group: all players in the
//                                        group start together and restart
//                                        together when every member has ended
//                                        (used for side-by-side recordings of
//                                        one conversation). Implies looping via
//                                        the group controller, so the player's
//                                        own loop option is disabled.

(function () {
  "use strict";

  function boolAttr(el, name, dflt) {
    var v = el.getAttribute(name);
    if (v === null) return dflt;
    return v === "true" || v === "1" || v === "";
  }

  function optionsFor(el) {
    var synced = !!el.getAttribute("data-sync-group");
    // fit:"width" auto-scales the glyphs to fill the container (used by the
    // side-by-side demos). data-fit="none" keeps a FIXED terminalFontSize
    // instead, so a full-width terminal renders text at a chosen px size
    // (e.g. the site's body size) rather than ballooning with the width.
    var fit = el.getAttribute("data-fit") || "width";
    var fontSize = el.getAttribute("data-font") || "small";
    // A fixed-size grid only makes sense while it fits its container: the
    // quickstart terminal is 76 columns at 17px ≈ 830px. In narrower layouts
    // (phones, tablets) fall back to width-fitting like the other players so
    // the right-hand columns are not clipped by the frame.
    if (fit === "none" && el.getBoundingClientRect().width < 830) {
      fit = "width";
      fontSize = "small";
    }
    return {
      fit: fit,
      // synced players never self-loop: the group controller restarts them
      // together, otherwise the two panes drift apart in the browser.
      loop: synced ? false : boolAttr(el, "data-loop", false),
      controls: boolAttr(el, "data-controls", false),
      autoPlay: false, // we drive play/pause ourselves
      idleTimeLimit: parseFloat(el.getAttribute("data-idle") || "2"),
      speed: parseFloat(el.getAttribute("data-speed") || "1"),
      terminalFontSize: fontSize,
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
    // The skill browser owns its own player (mount + cast swap), so keep it
    // out of the generic auto-mount pass below.
    var containers = Array.prototype.slice.call(
      document.querySelectorAll(".player[data-cast]:not(.skill-player)")
    );
    var entries = containers.map(function (el) {
      return { el: el, player: mount(el), started: false,
               mode: el.getAttribute("data-autoplay") || "onscroll",
               group: el.getAttribute("data-sync-group") || null };
    });

    // ---- lockstep groups ------------------------------------------------
    // Members of a group start in the same tick and, because each cast in a
    // pair is post-processed to the exact same duration, they stay aligned.
    // When every member has fired "ended", the controller seeks all to 0 and
    // replays them together, so the loop itself can never accumulate drift.
    var groups = {};
    entries.forEach(function (e) {
      if (!e.group || !e.player) return;
      (groups[e.group] = groups[e.group] || []).push(e);
    });

    function playGroup(members) {
      members.forEach(function (m) {
        try { m.player.play(); m.started = true; } catch (_) {}
      });
    }

    function pauseGroup(members) {
      members.forEach(function (m) {
        try { m.player.pause(); } catch (_) {}
      });
    }

    Object.keys(groups).forEach(function (name) {
      var members = groups[name];
      var endedCount = 0;
      members.forEach(function (m) {
        m.player.addEventListener("ended", function () {
          endedCount += 1;
          if (endedCount >= members.length) {
            endedCount = 0;
            members.forEach(function (x) {
              try { x.player.seek(0); } catch (_) {}
            });
            // replay together, but only while someone can see it
            var anyVisible = members.some(function (x) { return x.visible; });
            if (anyVisible) playGroup(members);
          }
        });
      });
    });

    function playEntry(e) {
      if (e.group) playGroup(groups[e.group]);
      else { try { e.player.play(); e.started = true; } catch (_) {} }
    }

    function pauseEntry(e) {
      if (e.group) {
        // only pause the group when NO member is on screen
        var anyVisible = groups[e.group].some(function (m) { return m.visible; });
        if (!anyVisible) pauseGroup(groups[e.group]);
      } else {
        try { e.player.pause(); } catch (_) {}
      }
    }

    // Immediate autoplay
    entries.forEach(function (e) {
      if (e.player && e.mode === "true") playEntry(e);
    });

    // Autoplay on scroll into view (pi.dev-style). Pauses off-screen loops.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (obs) {
        obs.forEach(function (entry) {
          var rec = entries.filter(function (e) {
            return e.el === entry.target;
          })[0];
          if (!rec || !rec.player || rec.mode !== "onscroll") return;
          rec.visible = entry.isIntersecting;
          if (entry.isIntersecting) {
            playEntry(rec);
          } else if (rec.started) {
            pauseEntry(rec);
          }
        });
      }, { threshold: 0.4 });
      entries.forEach(function (e) {
        if (e.mode === "onscroll") io.observe(e.el);
      });
    } else {
      // No IO support: just play the onscroll ones.
      entries.forEach(function (e) {
        if (e.player && e.mode === "onscroll") playEntry(e);
      });
    }
  });

  // ---- interactive skill browser -------------------------------------
  // A list of skills on the left; clicking one swaps the cast shown in the
  // terminal on the right and updates the purpose caption. The player is
  // disposed and re-created on each selection so the vendored player always
  // starts the new cast cleanly. Defaults to the first skill, and only plays
  // while the browser is on screen.
  ready(function () {
    if (!window.AsciinemaPlayer) return;
    var root = document.getElementById("skillbrowser");
    var el = document.getElementById("skill-player");
    if (!root || !el) return;

    var items = Array.prototype.slice.call(
      root.querySelectorAll(".skill-item")
    );
    if (!items.length) return;

    var titleEl = document.getElementById("skill-title");
    var purposeEl = document.getElementById("skill-purpose");
    var player = null;
    var current = null;   // currently-selected .skill-item
    var visible = false;

    function makeOptions(cast) {
      return {
        fit: "width",
        loop: true,
        controls: false,
        autoPlay: false,
        idleTimeLimit: parseFloat(el.getAttribute("data-idle") || "1.2"),
        speed: 1,
        terminalFontSize: el.getAttribute("data-font") || "small",
        theme: el.getAttribute("data-theme") || "asciinema",
        poster: "npt:0:01"
      };
    }

    function mountCast(cast) {
      if (player) {
        try { player.dispose(); } catch (_) {}
        player = null;
      }
      el.innerHTML = "";
      el.dataset.cast = cast;
      player = window.AsciinemaPlayer.create(cast, el, makeOptions(cast));
      if (visible) { try { player.play(); } catch (_) {} }
    }

    function select(item) {
      if (item === current) return;
      if (current) current.setAttribute("aria-selected", "false");
      current = item;
      item.setAttribute("aria-selected", "true");
      var cast = item.getAttribute("data-cast");
      var skill = item.getAttribute("data-skill");
      var purpose = item.getAttribute("data-purpose");
      if (titleEl) titleEl.textContent = "skill · " + skill;
      if (purposeEl && purpose) purposeEl.textContent = purpose;
      mountCast(cast);
    }

    items.forEach(function (item) {
      item.setAttribute("aria-selected", "false");
      item.addEventListener("click", function () { select(item); });
    });

    // Default to the first skill.
    select(items[0]);

    // Only play while the browser is visible (pauses off-screen).
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (obs) {
        obs.forEach(function (entry) {
          visible = entry.isIntersecting;
          if (!player) return;
          if (visible) { try { player.play(); } catch (_) {} }
          else { try { player.pause(); } catch (_) {} }
        });
      }, { threshold: 0.35 });
      io.observe(root);
    } else {
      visible = true;
      if (player) { try { player.play(); } catch (_) {} }
    }
  });

  // ---- install tabs --------------------------------------------------
  // Clickable coding-agent tabs that swap the shown install snippet. All
  // panels live in the DOM; the controller just toggles which one is visible.
  // Defaults to the first tab (Claude Code). Fully static; degrades to showing
  // the default panel if JS is unavailable (only the first panel is unhidden).
  ready(function () {
    var root = document.getElementById("installtabs");
    if (!root) return;
    var tabs = Array.prototype.slice.call(
      root.querySelectorAll(".install-tab")
    );
    var panels = Array.prototype.slice.call(
      root.querySelectorAll(".install-panel")
    );
    if (!tabs.length || !panels.length) return;

    function select(host) {
      tabs.forEach(function (t) {
        t.setAttribute("aria-selected", t.getAttribute("data-host") === host
          ? "true" : "false");
      });
      panels.forEach(function (p) {
        if (p.getAttribute("data-host") === host) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
    }

    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        select(t.getAttribute("data-host"));
      });
    });

    // Default to the first tab.
    select(tabs[0].getAttribute("data-host"));
  });
})();
