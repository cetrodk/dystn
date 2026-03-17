const avatarModules = import.meta.glob("@/assets/avatars/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const AVATARS: Array<{ name: string; src: string }> = Object.entries(
  avatarModules,
).map(([path, src]) => ({
  name: path.replace(/.*\/(.+)\.png$/, "$1"),
  src,
}));

const AVATAR_MAP = new Map(AVATARS.map((a) => [a.name, a.src]));

export function getAvatarSrc(name: string | undefined): string | undefined {
  return name ? AVATAR_MAP.get(name) : undefined;
}
