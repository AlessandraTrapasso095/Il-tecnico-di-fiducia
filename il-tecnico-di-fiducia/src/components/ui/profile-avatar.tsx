import Image from "next/image";

type ProfileAvatarPerson = {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

type ProfileAvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const sizeClasses: Record<ProfileAvatarSize, string> = {
  xs: "size-8 text-[11px]",
  sm: "size-10 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-16 text-lg",
  "2xl": "size-28 text-3xl sm:size-40 sm:text-4xl",
};

export function profileDisplayName(
  person: ProfileAvatarPerson | null | undefined,
  fallback = "Utente",
) {
  return `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || fallback;
}

export function profileInitials(
  person: ProfileAvatarPerson | null | undefined,
  fallback = "U",
) {
  const first = person?.first_name?.trim().slice(0, 1).toUpperCase() ?? "";
  const last = person?.last_name?.trim().slice(0, 1).toUpperCase() ?? "";
  return `${first}${last}` || fallback;
}

export function ProfileAvatar({
  person,
  alt,
  size = "md",
  className = "",
  imageClassName = "",
  fallbackClassName = "",
  fallback = "U",
  priority = false,
  unoptimized = true,
}: {
  person: ProfileAvatarPerson | null | undefined;
  alt?: string;
  size?: ProfileAvatarSize;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  fallback?: string;
  priority?: boolean;
  unoptimized?: boolean;
}) {
  const avatarUrl = person?.avatar_url?.trim();
  const displayName = alt ?? profileDisplayName(person);

  return (
    <div
      className={[
        "relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-white",
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          fill
          sizes="(max-width: 640px) 64px, 96px"
          priority={priority}
          unoptimized={unoptimized}
          className={["object-cover", imageClassName].join(" ")}
        />
      ) : (
        <span className={fallbackClassName}>{profileInitials(person, fallback)}</span>
      )}
    </div>
  );
}
