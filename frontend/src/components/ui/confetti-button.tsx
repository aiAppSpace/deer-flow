"use client";

import React, { type MouseEventHandler } from "react";
import confetti from "canvas-confetti";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/core/dom/render-activity";

interface ConfettiButtonProps extends React.ComponentProps<typeof Button> {
  angle?: number;
  particleCount?: number;
  startVelocity?: number;
  spread?: number;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function ConfettiButton({
  className,
  children,
  angle = 90,
  particleCount = 75,
  startVelocity = 35,
  spread = 70,
  onClick,
  ...props
}: ConfettiButtonProps) {
  // Confetti is decorative motion the user did not ask for. Honor the
  // preference and skip it; `onClick` still runs, so nothing functional is
  // gated on the animation.
  const reducedMotion = usePrefersReducedMotion();

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    const target = event.currentTarget;
    if (target && !reducedMotion) {
      const rect = target.getBoundingClientRect();
      confetti({
        particleCount,
        startVelocity,
        angle,
        spread,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
      });
    }
    onClick?.(event);
  };

  return (
    <Button onClick={handleClick} className={className} {...props}>
      {children}
    </Button>
  );
}
