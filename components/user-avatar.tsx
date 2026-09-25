export function UserAvatar({
  user,
  className,
}: {
  user: { name: string; initials: string; avatarHue: string; picture?: string };
  className: string;
}) {
  if (user.picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.picture}
        alt={user.name}
        referrerPolicy="no-referrer"
        className={`block shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ background: user.avatarHue }}
      aria-hidden
    >
      {user.initials}
    </span>
  );
}
