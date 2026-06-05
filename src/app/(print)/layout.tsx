export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 py-6 dark:bg-slate-900 print:bg-white print:py-0">
      {children}
    </div>
  );
}
