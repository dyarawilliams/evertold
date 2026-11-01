import type { ReactNode } from "react";

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "status" | "demo";
  children: ReactNode;
}) {
  const className = tone === "status" ? "banner banner-sage" : "banner";
  return (
    <p className={className} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
