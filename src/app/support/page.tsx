import Link from "next/link";

export const metadata = {
  title: "Support | Threadzy",
  description: "Get help with Threadzy. Contact our support team.",
};

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          &larr; Back to home
        </Link>
      </div>

      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
        Support
      </h1>

      <div className="space-y-6 text-sm leading-relaxed text-[var(--foreground)]">
        <p>
          Need help with Threadzy? We are here for you.
        </p>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 backdrop-blur-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[var(--accent-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Email Us</h2>
          <p className="text-[var(--muted-foreground)]">
            Send us an email and we will get back to you as soon as possible.
          </p>
          <a
            href="mailto:threadzy@productcoalition.com"
            className="inline-block px-6 py-3 text-sm font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            threadzy@productcoalition.com
          </a>
        </div>

        <div className="space-y-2 text-[var(--muted-foreground)]">
          <p>
            You can also check out these resources:
          </p>
          <ul className="space-y-1">
            <li>
              <Link href="/docs/api" className="text-[var(--accent)] hover:underline">
                API Documentation
              </Link>
              {" "}for technical integration help
            </li>
            <li>
              <Link href="/changelog" className="text-[var(--accent)] hover:underline">
                Changelog
              </Link>
              {" "}for the latest updates
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
