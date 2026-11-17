import type { Metadata } from "next";
import { Provider } from "@/components/ui/Provider";
import { geistMono, lora } from "@/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "People Search — Interfaze",
  description:
    "Find the people behind the work. Discover researchers and inventors through papers and patents, with source evidence you can inspect. Start without a key, or connect your Interfaze account.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistMono.variable} ${lora.variable}`}>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
