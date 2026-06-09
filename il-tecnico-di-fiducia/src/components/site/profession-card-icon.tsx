import type { SVGProps } from "react";

import type { ProfessionIconName } from "@/lib/professions/taxonomy";

type ProfessionCardIconProps = {
  name: ProfessionIconName;
  className?: string;
};

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
} satisfies SVGProps<SVGSVGElement>;

function iconPath(name: ProfessionIconName) {
  switch (name) {
    case "architect":
      return (
        <>
          <path d="M6 28 20 6l14 22H6Z" />
          <path d="M20 15v8" />
          <path d="M16 28h8" />
          <path d="M29 7l4 4-12 12-5 1 1-5L29 7Z" />
        </>
      );
    case "blacksmith":
      return (
        <>
          <path d="M7 25h18c4 0 7-3 7-7H18c-1 0-2-1-2-2v-3H8v3c0 2 2 4 4 4h3" />
          <path d="M13 25v5h12v-5" />
          <path d="M29 8l3-3" />
          <path d="m31 13 4-1" />
          <path d="m25 6 1-4" />
          <path d="M24 12l7-7" />
        </>
      );
    case "electrician":
      return (
        <>
          <path d="M21 3 10 21h9l-2 16 11-20h-9l2-14Z" />
          <path d="M6 29h8" />
          <path d="M27 29h7" />
          <path d="M31 23h3" />
        </>
      );
    case "engineering":
      return (
        <>
          <path d="M9 20a11 11 0 0 1 22 0" />
          <path d="M7 20h26" />
          <path d="M13 20v-6" />
          <path d="M27 20v-6" />
          <path d="M12 26h16" />
          <path d="M10 31h12" />
          <path d="M25 31h5" />
        </>
      );
    case "informatics":
      return (
        <>
          <rect x="7" y="7" width="26" height="18" rx="3" />
          <path d="M14 31h12" />
          <path d="M20 25v6" />
          <path d="M13 13h6" />
          <path d="M13 18h14" />
          <path d="M25 13h2" />
        </>
      );
    case "law":
      return (
        <>
          <path d="M20 5v28" />
          <path d="M11 10h18" />
          <path d="M8 30h24" />
          <path d="m11 10-5 10h10l-5-10Z" />
          <path d="m29 10-5 10h10l-5-10Z" />
        </>
      );
    case "mason":
      return (
        <>
          <path d="M6 13h28v18H6V13Z" />
          <path d="M6 19h28" />
          <path d="M6 25h28" />
          <path d="M14 13v6" />
          <path d="M26 13v6" />
          <path d="M20 19v6" />
          <path d="M14 25v6" />
          <path d="M26 25v6" />
          <path d="m28 8 5 5" />
          <path d="m23 7 4 4" />
        </>
      );
    case "plumber":
      return (
        <>
          <path d="M9 11h12v7H9z" />
          <path d="M21 14h5a5 5 0 0 1 5 5v2" />
          <path d="M31 21h-6v5h10v-5h-4Z" />
          <path d="M30 26v3" />
          <path d="M27 34c2-2 4-2 6 0" />
          <path d="M13 11V7h8" />
          <path d="M7 18h16" />
        </>
      );
    case "solar":
      return (
        <>
          <path d="M8 18h24l-3 15H5l3-15Z" />
          <path d="M12 18 9 33" />
          <path d="M20 18v15" />
          <path d="M28 18l3 15" />
          <path d="M7 25h24" />
          <path d="M20 4v5" />
          <path d="m10 8 4 4" />
          <path d="m30 8-4 4" />
          <path d="M27 12a8 8 0 0 0-14 0" />
        </>
      );
    case "surveyor":
      return (
        <>
          <path d="M14 11h12v8H14z" />
          <path d="M20 19v4" />
          <path d="M12 35l8-12 8 12" />
          <path d="M20 23v12" />
          <path d="M10 11h4" />
          <path d="M26 11h4" />
          <path d="M29 7 11 25" />
        </>
      );
    case "thermotechnic":
      return (
        <>
          <rect x="9" y="9" width="22" height="20" rx="4" />
          <path d="M14 14v10" />
          <path d="M20 14v10" />
          <path d="M26 14v10" />
          <path d="M12 34c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <path d="M15 5c-2 2-2 4 0 6" />
          <path d="M25 5c2 2 2 4 0 6" />
        </>
      );
    case "generic":
      return (
        <>
          <path d="M13 12V8h14v4" />
          <rect x="7" y="12" width="26" height="20" rx="4" />
          <path d="M7 20h26" />
          <path d="M17 20v3h6v-3" />
        </>
      );
  }
}

export function ProfessionCardIcon({ name, className }: ProfessionCardIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className={className}
      {...iconProps}
    >
      {iconPath(name)}
    </svg>
  );
}
