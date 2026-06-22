import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-8 mt-auto">
      <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          threadzy.ai. Working memory for AI agents.
        </p>
        <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
          <Link href="/docs/api" className="hover:text-[var(--foreground)] transition-colors">
            Docs
          </Link>
          <Link href="/changelog" className="hover:text-[var(--foreground)] transition-colors">
            Changelog
          </Link>
          <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
            Privacy
          </Link>
          <Link href="/security" className="hover:text-[var(--foreground)] transition-colors">
            Security
          </Link>
        </div>
      </div>
    </footer>
  );
}
