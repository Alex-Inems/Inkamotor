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
        alt=""
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center font-bold text-white ${className}`}
      style={{ background: user.avatarHue }}
      aria-hidden
    >
      {user.initials}
    </span>
  );
}
