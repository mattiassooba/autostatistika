import Link from "next/link";
import "./globals.css";

// Served as 404.html by the static host. The root layout is a pass-through, so
// this page brings its own document.
export default function NotFound() {
  return (
    <html lang="et">
      <head>
        <title>404 · Autostatistika</title>
        <meta name="robots" content="noindex" />
      </head>
      <body className="bg-paper font-sans text-ink antialiased">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4">
          <p className="text-[64px] font-semibold leading-none tracking-[-0.03em]">404</p>
          <p className="text-[17px] text-graphite">
            Lehte ei leitud. <span lang="en">Page not found.</span>
          </p>
          <p className="flex gap-4 text-[15px] font-medium">
            <Link className="underline underline-offset-4" href="/et">
              Avalehele
            </Link>
            <Link className="underline underline-offset-4" href="/en" lang="en">
              Home
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
