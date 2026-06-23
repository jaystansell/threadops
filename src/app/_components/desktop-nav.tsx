import Link from "next/link";

const ADMIN_EMAIL = "jay+direct@productcoalition.com";

const NAV_LINKS = [
  { href: "/threads", label: "Threads" },
  { href: "/webhooks", label: "Webhooks" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/savings", label: "Savings" },
  { href: "/docs/api", label: "Docs" },
  { href: "/changelog", label: "Changelog" },
];

export function DesktopNav({ userEmail }: { userEmail?: string | null }) {
  const links = userEmail === ADMIN_EMAIL
    ? [...NAV_LINKS, { href: "/feedback", label: "Feedback" }]
    : NAV_LINKS;

  return (
    <nav className="hidden md:flex items-center gap-1">
      {links.map((link) => (
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
