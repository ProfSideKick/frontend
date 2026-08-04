import { useAuthenticatedImageUrl } from '@/lib/authenticatedImage';

interface AuthenticatedImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  token: string | null;
}

/**
 * Drop-in replacement for <img> when the source is served from /uploads/*,
 * which requires an Authorization header (or a valid guest session run) —
 * plain <img src> can't attach that header. See src/lib/authenticatedImage.ts.
 */
export default function AuthenticatedImg({ src, token, ...imgProps }: AuthenticatedImgProps) {
  const objectUrl = useAuthenticatedImageUrl(src, token);
  if (!objectUrl) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} {...imgProps} />;
}
