import type { SVGProps } from "react";

import type { ProfessionIconName } from "@/lib/professions/taxonomy";

type ProfessionCardIconProps = {
  name: ProfessionIconName;
  className?: string;
};

type ProfessionCardVisualProps = {
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

function visualScene(name: ProfessionIconName) {
  switch (name) {
    case "architect":
      return (
        <>
          <rect width="320" height="220" fill="#dbe2f9" />
          <path d="M0 150h320v70H0z" fill="#002654" opacity="0.16" />
          <path d="M42 165 138 46l99 119H42Z" fill="#fff" opacity="0.7" />
          <path d="M42 165 138 46l99 119H42Z" stroke="#002654" strokeWidth="5" fill="none" />
          <path d="M138 88v51M104 165h68" stroke="#0b3c78" strokeWidth="5" strokeLinecap="round" />
          <path d="m219 57 34 34-92 92-42 9 9-42 91-93Z" fill="#ff8814" opacity="0.92" />
          <path d="M40 38h82M40 62h58M224 156h62" stroke="#002654" opacity="0.35" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "blacksmith":
      return (
        <>
          <rect width="320" height="220" fill="#101828" />
          <path d="M0 0h320v220H0z" fill="#002654" opacity="0.35" />
          <path d="M56 154h136c31 0 55-23 59-52H139c-12 0-22-10-22-22V57H62v25c0 26 21 47 47 47h18" fill="#dbe2f9" opacity="0.88" />
          <path d="M98 154v34h88v-34" fill="#0b3c78" />
          <path d="M234 47 260 21M253 75l40-11M204 34l9-32M216 91l63-63" stroke="#ff8814" strokeWidth="8" strokeLinecap="round" />
          <circle cx="279" cy="28" r="6" fill="#ff8814" />
          <circle cx="293" cy="63" r="4" fill="#ffb783" />
          <path d="M42 190h244" stroke="#ffffff" opacity="0.18" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "electrician":
      return (
        <>
          <rect width="320" height="220" fill="#dbe2f9" />
          <rect x="42" y="28" width="132" height="160" rx="20" fill="#002654" />
          <path d="M72 66h72M72 96h72M72 126h72" stroke="#aac7ff" strokeWidth="7" strokeLinecap="round" />
          <path d="M222 20 145 126h64l-16 80 81-121h-62l10-65Z" fill="#ff8814" />
          <path d="M210 135c26 0 49 21 49 47" stroke="#0b3c78" strokeWidth="9" strokeLinecap="round" />
          <path d="M251 182h-42" stroke="#0b3c78" strokeWidth="9" strokeLinecap="round" />
        </>
      );
    case "engineering":
      return (
        <>
          <rect width="320" height="220" fill="#e9edff" />
          <path d="M0 166h320v54H0z" fill="#0b3c78" opacity="0.16" />
          <path d="M60 117c10-52 54-82 101-82s92 30 102 82" fill="#ff8814" opacity="0.92" />
          <path d="M47 117h229" stroke="#002654" strokeWidth="9" strokeLinecap="round" />
          <path d="M91 117V66M231 117V66" stroke="#002654" strokeWidth="7" strokeLinecap="round" />
          <path d="M84 150h138M70 178h82M187 178h61" stroke="#002654" strokeWidth="6" strokeLinecap="round" />
          <path d="M35 46h74M210 45h62M228 64h32" stroke="#435e94" opacity="0.55" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "informatics":
      return (
        <>
          <rect width="320" height="220" fill="#001b3e" />
          <path d="M38 40h244v134H38z" fill="#0b3c78" />
          <path d="M70 72h54M70 103h96M70 134h138" stroke="#aec6ff" strokeWidth="8" strokeLinecap="round" />
          <circle cx="240" cy="77" r="11" fill="#ff8814" />
          <circle cx="240" cy="111" r="11" fill="#84a8eb" />
          <circle cx="240" cy="145" r="11" fill="#ffb783" />
          <path d="M72 190h176M160 174v16" stroke="#dbe2f9" strokeWidth="8" strokeLinecap="round" />
        </>
      );
    case "law":
      return (
        <>
          <rect width="320" height="220" fill="#ffdcc5" />
          <path d="M0 155h320v65H0z" fill="#411d00" opacity="0.16" />
          <path d="M158 35v134M78 64h160M55 181h210" stroke="#411d00" strokeWidth="8" strokeLinecap="round" />
          <path d="m80 64-40 74h80L80 64ZM237 64l-40 74h80l-40-74Z" fill="#703700" opacity="0.84" />
          <path d="M131 165h54v16h-54z" fill="#ff8814" />
          <path d="M36 41h58M226 39h52" stroke="#411d00" opacity="0.28" strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "mason":
      return (
        <>
          <rect width="320" height="220" fill="#ffdcc5" />
          <path d="M0 32h320v188H0z" fill="#703700" />
          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 5 }).map((__, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 72 - (row % 2 ? 36 : 0)}
                y={42 + row * 34}
                width="68"
                height="28"
                rx="4"
                fill={row % 2 ? "#ffb783" : "#ff8814"}
                opacity={col % 2 ? 0.82 : 0.95}
              />
            )),
          )}
          <path d="M210 42 283 115" stroke="#301400" strokeWidth="13" strokeLinecap="round" />
          <path d="M188 35h47l-29 45-33-33 15-12Z" fill="#e9edff" />
          <path d="M33 176h254" stroke="#301400" opacity="0.22" strokeWidth="7" strokeLinecap="round" />
        </>
      );
    case "plumber":
      return (
        <>
          <rect width="320" height="220" fill="#d8e2ff" />
          <path d="M0 0h320v220H0z" fill="#0b6d8f" opacity="0.14" />
          <path d="M56 76h112v58H56z" fill="#0b3c78" />
          <path d="M168 104h54c31 0 56 25 56 56v11" stroke="#002654" strokeWidth="20" strokeLinecap="round" />
          <path d="M55 134h128" stroke="#ff8814" strokeWidth="13" strokeLinecap="round" />
          <path d="M242 164h60v38h-60z" fill="#0b3c78" />
          <path d="M272 202v14" stroke="#002654" strokeWidth="9" strokeLinecap="round" />
          <path d="M249 57v19H93V57" stroke="#002654" strokeWidth="12" strokeLinecap="round" />
          <path d="M244 211c19-18 37-18 56 0" stroke="#84a8eb" strokeWidth="8" strokeLinecap="round" />
        </>
      );
    case "solar":
      return (
        <>
          <rect width="320" height="220" fill="#d7e3ff" />
          <circle cx="242" cy="62" r="36" fill="#ff8814" />
          <path d="M0 155h320v65H0z" fill="#002654" opacity="0.2" />
          <path d="M54 88h204l-27 98H28l26-98Z" fill="#0b3c78" />
          <path d="M78 88 53 186M126 88l-13 98M174 88l1 98M222 88l17 98M42 121h207M35 154h205" stroke="#aac7ff" strokeWidth="5" />
          <path d="M42 195h210" stroke="#002654" strokeWidth="9" strokeLinecap="round" />
          <path d="M242 12v22M193 37l17 15M291 37l-17 15" stroke="#ff8814" strokeWidth="8" strokeLinecap="round" />
        </>
      );
    case "surveyor":
      return (
        <>
          <rect width="320" height="220" fill="#dbe2f9" />
          <path d="M0 162h320v58H0z" fill="#435e94" opacity="0.24" />
          <path d="M118 58h88v57h-88z" fill="#0b3c78" />
          <path d="M161 115v31M104 205l57-59 58 59M161 146v59" stroke="#002654" strokeWidth="8" strokeLinecap="round" />
          <path d="M83 56h35M206 56h35M229 32 91 171" stroke="#ff8814" strokeWidth="7" strokeLinecap="round" />
          <path d="M36 181h248" stroke="#002654" opacity="0.22" strokeWidth="5" strokeLinecap="round" />
        </>
      );
    case "thermotechnic":
      return (
        <>
          <rect width="320" height="220" fill="#e9edff" />
          <rect x="58" y="55" width="166" height="112" rx="20" fill="#0b3c78" />
          <path d="M95 82v59M141 82v59M187 82v59" stroke="#aac7ff" strokeWidth="11" strokeLinecap="round" />
          <path d="M236 48h43v87h-43z" fill="#ff8814" />
          <circle cx="257" cy="91" r="14" fill="#ffdcc5" />
          <path d="M78 193c22-18 43-18 64 0s43 18 65 0 43-18 65 0" stroke="#ff8814" strokeWidth="8" strokeLinecap="round" />
          <path d="M92 18c-15 17-15 33 0 50M193 18c15 17 15 33 0 50" stroke="#435e94" strokeWidth="7" strokeLinecap="round" opacity="0.6" />
        </>
      );
    case "generic":
      return (
        <>
          <rect width="320" height="220" fill="#dbe2f9" />
          <rect x="70" y="67" width="180" height="115" rx="20" fill="#0b3c78" />
          <path d="M115 67V44h90v23M70 112h180M139 112v26h42v-26" stroke="#aac7ff" strokeWidth="9" strokeLinecap="round" />
          <circle cx="235" cy="55" r="27" fill="#ff8814" />
        </>
      );
  }
}

export function ProfessionCardVisual({ name, className }: ProfessionCardVisualProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 220"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      {visualScene(name)}
    </svg>
  );
}
