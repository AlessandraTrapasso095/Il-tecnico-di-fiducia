import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={[
        "w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

