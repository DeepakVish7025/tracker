"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", match: (p) => p === "/" || p.startsWith("/member") },
  { href: "/reports", label: "Reports", match: (p) => p.startsWith("/reports") },
];

export default function Nav() {
  const path = usePathname() || "/";
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={l.match(path) ? "navlink on" : "navlink"}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
