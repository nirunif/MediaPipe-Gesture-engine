# 💧 Water Ripple — Hand-Tracked Liquid Surface

An interactive web experience that turns your webcam feed into a pool of water. Move your
hands in front of the camera and your fingertips draw **expanding ripples** across the image,
with a subtle **silvery / mercury sheen** riding the wave crests. The surface settles back to
calm on its own.

Built with real-time hand tracking ([MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker))
and a custom **WebGL ripple shader** — everything runs locally in the browser; your video
never leaves your machine.

---

## ✨ Features

- **Real-time hand tracking** — follows your index fingertip via MediaPipe.
- **Two-handed** — tracks both hands independently (lift both and draw two ripple trails at once).
- **GPU water shader** — smooth, high-resolution concentric ripples that refract the live video.
- **Mercury sheen** — a cool metallic glint appears only where the surface is moving.
- **Auto-reset** — ripples expand, decay, and fade within ~1.6s, so the water always returns to calm.
- **Jitter-free** — a [One-Euro filter](https://gery.casiez.net/1euro/) keeps tracking smooth when still and responsive when fast.
- **Mouse fallback** — move the pointer to ripple, handy for testing without raising a hand.

---

## 🚀 Running it

The camera (`getUserMedia`) only works in a **secure context** — `localhost` or HTTPS. You
can't just double-click `index.html` (a `file://` URL will fail).

### Locally

```bash
# from the project folder
python3 -m http.server 8000
```

Then open **http://localhost:8000** (use `localhost` exactly, not a file path or bare IP)
and click **Open Webcam**.

> Any static server works — e.g. `npx serve`, `php -S localhost:8000`, or the VS Code
> "Live Server" extension.

### Online (GitHub Pages)

Because it's pure static files, you can host it for free on **GitHub Pages**, which serves
over HTTPS so the camera works for anyone who visits:

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**,
   pick your branch and `/ (root)`.
3. Open the published URL and click **Open Webcam**.

---

## 🕹️ How to use

1. Click **Open Webcam** and allow camera access when prompted.
2. Wait a moment while the hand model loads (first visit downloads it from a CDN).
3. Raise a hand and move it — your fingertip leaves a trail of water ripples.
4. Use both hands for two trails at once.

---

## 📁 Project structure

| File | Purpose |
|------|---------|
| `index.html` | Markup — the video element, WebGL canvas, and start button. |
| `styles.css` | Styling — pastel start screen and the whimsical 3D "Open Webcam" button (Fredoka font). |
| `app.js`     | All the logic — WebGL ripple shader, MediaPipe hand tracking, One-Euro filter, main loop. |

---

## 🔧 Tuning

Most of the look lives in the fragment shader (`FS`) and a couple of constants in `app.js`:

| What | Where | Effect |
|------|-------|--------|
| Ripple expansion speed | `radius = age * 0.50` | How fast the wavefront grows. |
| Ring frequency | `sin(diff * 42.0)` | More/fewer concentric rings. |
| Fade speed (reset) | `exp(-age * 3.2)` | Higher = quicker return to calm. |
| Distortion strength | `amp = ... * 0.06` | How much the image bends. |
| Mercury amount | `motion * 0.35` | Strength of the silvery sheen. |
| Crest glint | `abs(crest) * 2.6` | Brightness of the wave highlights. |
| Ripple spacing | `STEP = 0.018` (`spawnTrail`) | Density of ripples along the hand's path. |
| Ripple lifetime | `LIFETIME` constant | Seconds a ripple lives. |
| Tracking smoothness | `new OneEuro(min, beta)` | Lower `min` = smoother; higher `beta` = snappier. |

---

## 🧩 Requirements

- A modern browser with **WebGL** and `getUserMedia` (Chrome/Edge recommended).
- A **webcam**.
- **Internet on first load** — MediaPipe's WASM runtime and hand model are fetched from a CDN.

> The app requests the GPU delegate for MediaPipe and automatically **falls back to CPU**
> if the GPU one isn't available, so it works across a range of machines.

---

## 🔒 Privacy

All processing happens in your browser. The webcam stream is used only for on-device hand
tracking and rendering — it is never uploaded or recorded.

---

## 🛠️ Built with

- [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) — hand landmark detection
- **WebGL** — the water ripple shader
- [One-Euro filter](https://gery.casiez.net/1euro/) — smooth, low-latency tracking
- [Fredoka](https://fonts.google.com/specimen/Fredoka) — the whimsical UI font
