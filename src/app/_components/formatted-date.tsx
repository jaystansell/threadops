"use client";

interface FormattedDateProps {
  date: string;
  includeTime?: boolean;
}

export function FormattedDate({ date, includeTime = false }: FormattedDateProps) {
  const d = new Date(date);
  const formatted = includeTime
    ? d.toLocaleString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });

  return <span suppressHydrationWarning>{formatted}</span>;
}
