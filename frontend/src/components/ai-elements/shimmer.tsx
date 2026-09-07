"use client";

import { usePrefersReducedMotion } from "@/core/dom/render-activity";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  type CSSProperties,
  type ElementType,
  type JSX,
  memo,
  useMemo,
} from "react";

export type TextShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements,
  );

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread],
  );

  // `motion/react` does not consult `prefers-reduced-motion` on its own, so it
  // has to be asked. Parking on `initial` rather than dropping the gradient:
  // that frame already appears once per cycle today — the highlight band sits
  // off the left edge there, so the text is painted entirely by the solid
  // `--color-muted-foreground` layer underneath and stays readable. The words
  // carry the status; only the sweep is withheld.
  const reducedMotion = usePrefersReducedMotion();
  const parked = { backgroundPosition: "100% center" };

  return (
    <MotionComponent
      animate={reducedMotion ? parked : { backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]",
        className,
      )}
      initial={parked}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              repeat: Number.POSITIVE_INFINITY,
              duration,
              ease: "linear",
            }
      }
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);
