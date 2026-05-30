"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";

export type NavItem = {
  href: string;
  label: string;
};

export function ResponsiveNav({
  authenticated,
  items
}: {
  authenticated: boolean;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", isOpen);
    return () => {
      document.body.classList.remove("mobile-menu-open");
    };
  }, [isOpen]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <>
      <nav className="nav desktop-nav" aria-label="Primary">
        {items.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
        {authenticated ? <LogoutButton /> : null}
      </nav>

      <button
        aria-controls="mobile-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className="menu-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`mobile-nav-overlay${isOpen ? " open" : ""}`} id="mobile-navigation">
        <div className="mobile-nav-header">
          <span className="mobile-nav-title">Menu</span>
          <button className="mobile-nav-close" onClick={() => setIsOpen(false)} type="button">
            Close
          </button>
        </div>
        <nav className="mobile-nav" aria-label="Mobile primary">
          {items.map((item) => (
            <Link href={item.href} key={item.href} onClick={() => setIsOpen(false)}>
              {item.label}
            </Link>
          ))}
          {authenticated ? <LogoutButton /> : null}
        </nav>
      </div>
    </>
  );
}
