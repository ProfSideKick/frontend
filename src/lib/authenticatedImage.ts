import { useEffect, useState } from 'react';

/**
 * /uploads/* now requires auth (session owner, run participant, admin, or a
 * guest with a matching guest session run) — it can contain student PII and
 * instructor-only solution material, so it's no longer a public static mount.
 * <img src> can't attach an Authorization header, so this fetches the image
 * as a blob (with the header when we have a token) and hands back an object
 * URL. When there's no token, the request still goes through — the backend
 * allows it for guest session runs.
 */
export function useAuthenticatedImageUrl(
  url: string | null | undefined,
  token: string | null,
): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load image (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url, token]);

  return objectUrl;
}
