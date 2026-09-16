export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
      <p
        className="text-3xl font-bold tracking-tight mb-10"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        threadzy<span className="text-[var(--accent)]">.ai</span>
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
        Threadzy is on pause
      </h1>
      <p className="mt-6 max-w-xl text-lg text-[var(--muted-foreground)]">
        We&apos;re closed for new sign-ups while we make improvements. Existing
        users, thanks for your patience, more soon.
      </p>
    </main>
  );
}
