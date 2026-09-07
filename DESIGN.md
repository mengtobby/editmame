---
name: Editmame
description: A Google Docs-style visual system for a peer-to-peer collaborative video editor — white surfaces, hairline borders, and one blue accent, so editing together feels as approachable as a shared document.
colors:
  ink: "#111827"
  ink-secondary: "#4b5563"
  ink-muted: "#9ca3af"
  shell: "#f9fafb"
  surface: "#ffffff"
  border: "#e5e7eb"
  border-strong: "#d1d5db"
  accent: "#1a73e8"
  accent-hover: "#1765cc"
  accent-tint: "#e8f0fe"
  clip-video: "#4285f4"
  clip-audio: "#34a853"
  playhead: "#d93025"
typography:
  body:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  title:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
  label:
    fontFamily: "Roboto, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  mono:
    fontFamily: "'Roboto Mono', ui-monospace, monospace"
    fontSize: "12px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "6px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-toolbar:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  avatar:
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    size: "32px"
---

## Overview

Editmame looks like the document app its product mechanism claims to be: a peer-to-peer,
local-first video editor that wants editing together to feel as low-friction as editing a Google
Doc together. The visual system is borrowed directly from Google Docs' own chrome — white
surfaces floating on a light-gray shell, hairline gray borders instead of heavy panels, one
committed blue accent, circular initials for presence — applied to a video timeline instead of a
text canvas. This replaced an earlier dark, dense "Premiere/CapCut" pro-NLE treatment; the product
and its capabilities are unchanged, only the visual world is.

## Colors

Restrained strategy: neutrals carry the whole interface, one accent (`#1a73e8`, Google's own blue)
does every job color needs to do — primary actions, focus rings, selection state, links. Two
additional hues exist only to distinguish content, never chrome: `clip-video` (`#4285f4`) and
`clip-audio` (`#34a853`) color-code timeline clips by track kind. The playhead is
`#d93025` — red is the one non-negotiable convention borrowed from video editors generally, not
from Docs, because a red playhead is how every video tool communicates "this is where playback is."

- `shell` (`#f9fafb`) is the app's own background — the "desk" everything else sits on.
- `surface` (`#ffffff`) is every panel, card, row, and input.
- `border` (`#e5e7eb`) separates regions; `border-strong` (`#d1d5db`) is reserved for dividers that
  need more visual weight (rare — most of the interface uses the lighter hairline).
- Text is `ink` for primary content, `ink-secondary` for supporting text (status lines, metadata),
  `ink-muted` for placeholder/disabled/tertiary text.

## Typography

Roboto throughout — Google's own UI face, loaded from Google Fonts, chosen because the brief
pinned Google Docs directly and Roboto is what makes the chrome actually read as Docs' own rather
than a Docs-shaped Inter page. Weights are 400 (body) and 500 (title/emphasis) only; no display
weight is used anywhere, matching an Operate surface where hierarchy comes from size and color, not
weight extremes. `Roboto Mono` is reserved for anything numeric or identifier-like: timecodes,
peer-id fragments, room ids.

## Layout

Three regions: a fixed-height top bar, a flexible main column (preview canvas, a slim icon
toolbar, the scrollable timeline), and a right rail (People). The right rail is genuinely
supplementary — connection state and peer/throughput detail, not required for editing — so it
hides below the `lg` breakpoint (1024px) rather than forcing a squeezed three-column layout. This
is a desktop precision-editing tool; below `lg`, the core preview/toolbar/timeline stack keeps
working full-width rather than pretending to support touch timeline editing it was never built for.
The icon toolbar row scrolls horizontally instead of wrapping when it doesn't fit.

## Elevation & Depth

Mostly flat, hairline-bordered surfaces — Docs itself uses almost no shadow. The two exceptions are
functional, not decorative: the preview canvas gets a `shadow-card` to read as a "page" resting on
the gray shell, and the Share button and scrub-handle get a small `shadow-toolbar` lift so the
single primary action and the interactive playhead handle stand off the surface. Both shadow tokens
carry an offset and soft blur (`0 1px 3px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.1)` for
card; a tighter version for toolbar) — never a flat colored halo.

## Shapes

Rounded but not soft: `4px` for small controls and toggle chips, `6px` for clips and the toolbar
buttons, `8px` for the preview canvas card, full-round (`9999px`) for every pill/circular element —
the Share and New Room buttons, the scrub-bar handle, and every Avatar. Borders are 1px hairlines
everywhere; nothing in this system uses a 2px+ border as a design choice.

## Components

- **Avatar**: circular, background = a deterministic per-peer-id color, initials in white 500-weight
  text. The one identity unit reused everywhere a person needs representing — the top bar's
  presence stack and the People rail's peer rows both render the same component.
- **TopBar**: app icon (blue rounded square) + inline-editable project title (borderless until
  hover/focus, exactly Docs' document-title interaction — typing a new name calls
  `engine.updateMeta` and syncs to every peer) + a quiet status line beneath it + the avatar stack +
  "New room" (text button) + "Share" (the one filled-pill primary button in the whole app).
- **ToolbarButton**: icon + label, transparent until hover (light gray fill), no border — the
  Import Media / Add Video Track / Add Audio Track row underneath the preview canvas.
- **ClipBlock**: flat rounded rectangle, colored by track kind, white label text, blue ring when
  selected. Left/right 6px hit zones for trim, full-body drag to move.
- **TrackRow**: white header (name + reorder arrows that appear on hover + M/L/H toggle chips) beside
  a white lane holding that track's clips, separated from the row below by a 1px `border-gray-100`
  hairline (lighter than the header/lane divider, so lanes read as one continuous surface).
- **PreviewCanvas**: black canvas in a white-shadowed rounded card on the gray shell; beneath it, a
  thin accent-filled scrub bar (hover reveals a draggable handle), a filled-circle play/pause
  button, and two quiet icon buttons for frame-step — explicitly drawn previous/next glyphs
  (bar-then-triangle and triangle-then-bar), not a single mirrored icon, since a mirrored 14px glyph
  reads ambiguously.
- **NetworkPanel ("People")**: peer rows (Avatar + name + short id + live throughput), a one-line
  reminder of the product's actual P2P mechanism, and a compact media-transfer log — restyled from
  the original dark "Network Topology" panel with the same information, calmer presentation.

## Do's and Don'ts

- Do keep the accent to exactly one blue, used only for primary actions, selection, and focus —
  introducing a second "important" color would undercut the one-committed-action clarity Docs
  itself relies on.
- Do keep clip colors (`clip-video` / `clip-audio`) reserved for track-kind identity only; they are
  content color, not UI color, and should never appear on a button, badge, or panel chrome.
- Do route every new "a person is here" affordance through the shared Avatar component rather than
  inventing a second presence pattern.
- Don't reach for a second border weight, a drop shadow on a list row, or a gradient — this system's
  entire depth vocabulary is one hairline color and two shadow tokens, both used sparingly.
- Don't add mobile-specific timeline editing without a real design pass for touch trim/drag
  interactions; hiding the People rail below `lg` is a stopgap that keeps the core tool usable, not
  a mobile editing experience.
