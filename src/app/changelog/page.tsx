import Link from "next/link";
import { releases } from "./releases";

export const metadata = {
  title: "Changelog - Threadzy",
  description: "Release history and updates for Threadzy.",
};

export default function ChangelogPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 w-full">
      <div className="mb-10">
        <Link
          href="/"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          &larr; Home
        </Link>
        <h1 className="text-3xl font-bold mt-3">Changelog</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          What we shipped. No fluff.
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-0 w-px bg-[var(--border)]" />

        <div className="space-y-8">
          {releases.map((release) => (
            <div key={release.version} className="relative pl-8">
              <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-[var(--accent)] bg-[var(--background)]" />

              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                  v{release.version}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {release.date}
                </span>
              </div>

              <h2 className="text-lg font-semibold">{release.title}</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {release.description}
              </p>

              <ul className="mt-2 space-y-1">
                {release.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="text-sm text-[var(--muted-foreground)] flex items-start gap-2"
                  >
                    <span className="text-[var(--accent)] mt-0.5 shrink-0">&#8226;</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-[var(--border)] text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Threadzy is under active development.{" "}
          <Link href="/signup" className="text-[var(--accent)] hover:underline">
            Get started
          </Link>{" "}
          or{" "}
          <Link href="/docs/api" className="text-[var(--accent)] hover:underline">
            read the docs
          </Link>.
        </p>
      </div>
    </div>
  );
}
