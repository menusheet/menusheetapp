import Image from 'next/image';

/** Intrinsic size of public/icons/logo2.png. Width follows from the aspect ratio. */
const WORDMARK_W = 811;
const WORDMARK_H = 223;

/**
 * The horizontal MenuSheet lockup. Callers must pass a height class (`h-*`).
 *
 * The base class deliberately sets only `w-auto`, never `h-auto`: Tailwind emits
 * `.h-auto` after `.h-<n>` in the stylesheet, so an `h-auto` here would silently beat
 * the caller's height and blow the image up to its full 223px natural size on mobile.
 */
export function Wordmark({
  className = '',
  priority = false,
  alt = 'MenuSheet',
}: {
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <Image
      src="/icons/logo2.png"
      alt={alt}
      width={WORDMARK_W}
      height={WORDMARK_H}
      priority={priority}
      className={`w-auto ${className}`}
    />
  );
}
