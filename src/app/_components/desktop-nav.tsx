import Link from "next/link";

const NAV_LINKS = [
  { href: "/threads", label: "Threads" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/savings", label: "Savings" },
  { href: "/docs/api", label: "Docs" },
  { href: "/changelog", label: "Changelog" },
];

export function DesktopNav() {
  return (
    <nav className="hidden md:flex items-center gap-1">
      {NAV_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-[var(--muted)] transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
