import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Google Docs' own palette: hairline-bordered white surfaces on a light-gray shell.
        accent: {
          50: "#e8f0fe",
          100: "#d2e3fc",
          500: "#1a73e8",
          600: "#1765cc",
          700: "#185abc",
        },
        clip: {
          video: "#4285f4",
          "video-dark": "#3367d6",
          audio: "#34a853",
          "audio-dark": "#1e8e3e",
        },
        playhead: "#d93025",
      },
      fontFamily: {
        sans: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'Roboto Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        toolbar: "0 1px 2px 0 rgba(60,64,67,0.15)",
        card: "0 1px 3px 0 rgba(60,64,67,0.15), 0 1px 2px 0 rgba(60,64,67,0.1)",
        popover: "0 2px 6px 2px rgba(60,64,67,0.15), 0 1px 2px 0 rgba(60,64,67,0.3)",
      },
    },
  },
  plugins: [],
} satisfies Config;
