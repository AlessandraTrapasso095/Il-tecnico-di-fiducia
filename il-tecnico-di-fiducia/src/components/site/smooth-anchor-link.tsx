"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type SmoothAnchorLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: `#${string}`;
  children: ReactNode;
};

export function SmoothAnchorLink({
  href,
  children,
  onClick,
  ...props
}: SmoothAnchorLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", href);
    window.setTimeout(() => {
      target.focus({ preventScroll: true });
    }, 350);
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
