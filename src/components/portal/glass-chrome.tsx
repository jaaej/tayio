import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { ToriiMark } from "@/components/brand/wordmark";
import { signOutAction } from "@/app/auth/actions";

// Brand mark and signed-in person row of the glass portal sidebar, shared by
// every role that uses GlassPortalShell.

/**
 * The torii gate mark in its own colours, with no tile behind it, and the
 * name set beside it. The collapsed rail hides the name and keeps the gate.
 */
export function GlassBrandMark({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Taiyo Tuition home"
      className="flex items-center gap-2.5 rounded-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <span className="grid h-[34px] w-[40px] shrink-0 place-items-center">
        <ToriiMark width={40} />
      </span>
      <span className="portal-brand-text flex flex-col leading-[1.1]">
        <span className="text-[15px] font-extrabold text-ink">Taiyo</span>
        <span className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          Tuition
        </span>
      </span>
    </Link>
  );
}

function SignOutButton({ size = "sidebar" }: { size?: "sidebar" | "header" }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-soft transition-colors hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <LogOut
          className={size === "header" ? "h-[18px] w-[18px]" : "h-[17px] w-[17px]"}
          aria-hidden
        />
      </button>
    </form>
  );
}

/**
 * Bottom-of-sidebar account row. `href` makes the avatar and name a link to
 * the person's own profile; `avatar` is a 32px round element.
 */
export function GlassAccount({
  name,
  roleLabel,
  avatar,
  href,
}: {
  name: string;
  roleLabel: string;
  avatar: ReactNode;
  href?: string;
}) {
  const person = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center" aria-hidden>
        {avatar}
      </span>
      <span className="portal-account-text flex min-w-0 flex-1 flex-col leading-[1.2]">
        <span className="truncate text-[13px] font-bold text-ink">{name}</span>
        <span className="text-[12px] text-ink-soft">{roleLabel}</span>
      </span>
    </>
  );
  return (
    <div className="portal-account flex items-center gap-2.5 pb-1.5 pl-2.5 pr-1.5 pt-2">
      {href ? (
        <Link
          href={href}
          aria-label={`${name}, ${roleLabel}. Open your profile`}
          title="Your profile"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {person}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2.5">{person}</span>
      )}
      <SignOutButton />
    </div>
  );
}

/** Ink initial disc used when a person has no photo or icon. */
export function GlassInitial({ initial }: { initial: string }) {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[13px] font-extrabold text-white">
      {initial}
    </span>
  );
}

/** Phone header: brand on the left, search, an optional extra and sign out. */
export function GlassMobileHeader({
  brandHref,
  search,
  extra,
  nav,
}: {
  brandHref: string;
  search: ReactNode;
  extra?: ReactNode;
  nav: ReactNode;
}) {
  return (
    <header className="glass sticky top-0 z-40 rounded-b-[20px] border-t-0 lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
        <GlassBrandMark href={brandHref} />
        <div className="flex items-center gap-1.5">
          {search}
          {extra}
          <SignOutButton size="header" />
        </div>
      </div>
      {nav}
    </header>
  );
}
