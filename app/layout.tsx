import type { Metadata } from "next";
import { Crimson_Text, DM_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

// The three faces the Figma file uses; wired to the @theme font variables in
// globals.css so Tailwind's font-sans / font-display / font-mono resolve to them.
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Area",
  description: "Area turns regional data into clear, vibrant visuals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${crimsonText.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
