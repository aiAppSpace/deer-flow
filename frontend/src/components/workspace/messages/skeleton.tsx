import { Skeleton } from "@/components/ui/skeleton";

const STAGGER_MS = 60;

function SkeletonBar({
  className,
  style,
  originRight,
}: {
  className?: string;
  style?: React.CSSProperties;
  originRight?: boolean;
}) {
  return (
    <div
      // No `opacity: 0` here, and no `fill-mode-[forwards]` override: the
      // animation is `both`, so the keyframes cover the stagger delay and the
      // element's own resting style stays visible. Making the element itself
      // transparent meant a withheld animation left the whole skeleton blank —
      // the same defect the suggestion chips carried until 2026-09-08.
      // `motion-safe:` withholds the entrance under `prefers-reduced-motion`,
      // which is only safe because of the above.
      className={`motion-safe:animate-skeleton-entrance overflow-hidden rounded-md ${originRight ? "origin-[right]" : "origin-[left]"} ${className ?? ""}`}
      style={style}
    >
      <Skeleton className="h-full w-full rounded-md" />
    </div>
  );
}

export function MessageListSkeleton() {
  let index = 0;
  return (
    <div className="flex w-full max-w-(--container-width-md) flex-col gap-12 p-8 pt-16">
      <div
        role="human-message"
        className="flex w-[50%] flex-col items-end gap-2 self-end"
      >
        <SkeletonBar
          className="h-6 w-full"
          originRight
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-[80%]"
          originRight
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
      </div>
      <div role="assistant-message" className="flex flex-col gap-2">
        <SkeletonBar
          className="h-6 w-full"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-full"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-[70%]"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-full"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-full"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-full"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-[60%]"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
        <SkeletonBar
          className="h-6 w-[40%]"
          style={{ animationDelay: `${index++ * STAGGER_MS}ms` }}
        />
      </div>
    </div>
  );
}
