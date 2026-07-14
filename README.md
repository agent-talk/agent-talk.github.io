# agent-talk.github.io

Marketing and docs site for [agent-talk](https://github.com/xhluca/agent-talk),
a plugin that lets coding agents message each other over an end-to-end-encrypted
relay. Hosted at https://agent-talk.github.io.

## Layout

```
index.html                 landing page (hero, demo, why, how, quickstart, compare, FAQ)
docs.html                  core concepts and project layout
assets/css/style.css       styles (dark terminal aesthetic)
assets/js/players.js       instantiates the vendored asciinema-player from data-* attrs
assets/vendor/asciinema-player/   vendored player (v3.17.0), fully static, no CDN at runtime
assets/casts/*.cast        PII-scrubbed asciinema v2 recordings
assets/favicon.svg
.nojekyll                  serve /assets and .cast verbatim on GitHub Pages
.github/workflows/deploy.yml   packages the repo and publishes to Pages (no build step)
```

## Local preview

The site is plain static files. Serve the directory over HTTP so the player can
fetch the `.cast` files:

```
python3 -m http.server 8000
# open http://localhost:8000/
```

Opening `index.html` directly via `file://` will not load the casts (fetch is
blocked for local files); use the HTTP server above.

## Terminal demos

Demos are embedded pi.dev style: a `<div class="player" data-cast="...">` in the
HTML, instantiated by `assets/js/players.js` via
`AsciinemaPlayer.create(castPath, el, opts)`. The player and casts are vendored
locally, so playback makes no external network calls.

To add a cast, scrub it first (from the agent-talk repo):

```
.demo-tools/.venv/bin/python .demo-tools/scrub.py in.cast assets/casts/out.cast
```

then add a `.player` container pointing at it.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes the
repo to GitHub Pages. Pages must be set to "GitHub Actions" as the source in the
repository settings.
