import { useEffect, useState } from "react";
import { faviconUrl } from "../lib/launchpad";

export function AppIcon({
  url,
  fallback,
  size = 32,
  className = "",
}: {
  url: string;
  fallback?: string;
  size?: number;
  className?: string;
}) {
  const src = faviconUrl(url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className={"app-emoji " + className} aria-hidden="true">
        {fallback || "↗"}
      </span>
    );
  }

  return (
    <img
      className={"app-favicon " + className}
      src={src}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}