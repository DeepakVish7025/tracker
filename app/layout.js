import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Team Daily Tracker",
  description: "Daily slot-wise task tracking for the team",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container inner">
            <Link href="/" className="brand">Team<span>Tracker</span></Link>
            <nav className="navlinks">
              <Link href="/">Dashboard</Link>
              <Link href="/reports">Reports &amp; Export</Link>
            </nav>
          </div>
        </header>
        <main className="container page">{children}</main>
      </body>
    </html>
  );
}
