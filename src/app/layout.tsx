import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "DoOnce",
  description: "Record a browser task once. Run it every day."
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
