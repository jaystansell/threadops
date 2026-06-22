import { StickmanEmptyState } from "@/app/_components/stickman-animations";

export const metadata = { title: "Threads" };

export default function ThreadsIndexPage() {
  return (
    <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
      <div className="text-center space-y-4">
        <StickmanEmptyState />
        <p className="text-lg">Select a thread</p>
        <p className="text-sm">
          Choose a thread from the sidebar or create a new one.
        </p>
      </div>
    </div>
  );
}
