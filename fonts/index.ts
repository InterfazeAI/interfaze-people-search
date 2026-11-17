import localFont from "next/font/local";

export const geistMono = localFont({
  src: [
    { path: "./geist-mono-latin-400.ttf", weight: "400", style: "normal" },
    { path: "./geist-mono-latin-500.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["monospace"],
});

export const lora = localFont({
  src: "./lora-latin-600.ttf",
  weight: "600",
  style: "normal",
  variable: "--font-lora",
  display: "swap",
  fallback: ["Georgia", "serif"],
});
