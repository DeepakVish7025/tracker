import "./globals.css";
import Link from "next/link";
import Nav from "./components/Nav";

export const metadata = {
  title: "TeamTracker - Daily Work Sheets",
  description: "Daily slot-wise task tracking for the team",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="brand-text">Team<b>Tracker</b></span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="container page">{children}</main>
        <footer className="footer">TeamTracker &middot; Daily work sheets, saved date-wise</footer>
      </body>
    </html>
  );
}
