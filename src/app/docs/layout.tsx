export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-screen"
      style={{ marginLeft: "calc(-50vw + 50%)" }}
    >
      {children}
    </div>
  );
}
