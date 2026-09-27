"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ className, width = 120, height = 120 }: LogoProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!mounted) {
    return (
      <div style={{ width, height }} className={className} />
    );
  }

  return (
    <Image
      src="/logo.png"
      alt="Pulse"
      width={width}
      height={height}
      className={className}
      priority
      unoptimized
    />
  );
}
