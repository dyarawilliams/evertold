import type { ReactNode } from "react";
import type { Route } from "../lib/routes.ts";
import { AppLink } from "./Router.tsx";

const links = [
  { href: "/", name: "dashboard", label: "Dashboard" },
  { href: "/record", name: "record", label: "Record" },
  { href: "/library", name: "library", label: "Library" },
] as const;

export function Shell({ current, children }: { current: Route["name"]; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory text-charcoal">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-charcoal/10 bg-ivory/95">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
          <AppLink href="/" className="font-serif text-2xl tracking-tight">
            EverTold
          </AppLink>
          <nav aria-label="Primary">
            <ul className="flex flex-wrap gap-2">
              {links.map((link) => (
                <li key={link.href}>
                  <AppLink href={link.href} className="nav-link" current={current === link.name}>
                    {link.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="h-1 bg-terracotta" aria-hidden="true" />
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
        {children}
      </main>
      <footer className="border-t border-charcoal/10">
        <p className="mx-auto w-full max-w-6xl px-5 py-8 text-sm leading-relaxed">
          Audio, transcripts, and memories stay on this computer. Whisper and Gemma run locally when you start
          them. Synthetic demo stories are labeled and are not model output.
        </p>
      </footer>
    </div>
  );
}
