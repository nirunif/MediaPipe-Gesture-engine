# 💧 Water Ripple — Hand-Tracked Liquid Surface

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge)](https://nirunif.github.io/MediaPipe-Gesture-engine/)


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


## 🕹️ How to use

1. Click **Open Webcam** and allow camera access when prompted.
2. Wait a moment while the hand model loads (first visit downloads it from a CDN).
3. Raise a hand and move it — your fingertip leaves a trail of water ripples.
4. Use both hands for two trails at once.
