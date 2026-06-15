import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Image
        src="/yoremio-mark.svg"
        alt="Yoremio logosu"
        width={compact ? 38 : 48}
        height={compact ? 38 : 48}
        priority
      />
      <div className="min-w-0">
        <p className="truncate font-serif text-xl font-black leading-5 tracking-normal text-brand-brown">
          Yöremio
        </p>
        <p className="truncate text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Yöremio
        </p>
      </div>
    </div>
  );
}
