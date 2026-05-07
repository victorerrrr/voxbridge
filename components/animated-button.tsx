"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";

type Variant = "primary" | "secondary";

const variantClass: Record<Variant, string> = {
  primary: "anim-btn-primary",
  secondary: "anim-btn-secondary",
};

const DEFAULT_DELAY = 150;

function buildClassName(variant: Variant, extra?: string) {
  return ["anim-btn", variantClass[variant], extra].filter(Boolean).join(" ");
}

function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:|#)/i.test(href);
}

type SharedProps = {
  variant?: Variant;
  className?: string;
  children: ReactNode;
};

type AnimatedButtonAsButton = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    /**
     * If set, the onClick handler will be invoked after this delay (ms).
     * Useful for `type="button"` triggers that perform navigation themselves.
     * Ignored for `type="submit"` to keep native form behavior intact.
     */
    actionDelay?: number;
  };

type AnimatedButtonAsLink = SharedProps & {
  href: string;
  /** Delay (ms) between click and `router.push` so the press animation can play. */
  navigationDelay?: number;
  prefetch?: boolean | null;
  target?: string;
  rel?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  "aria-label"?: string;
};

export type AnimatedButtonProps = AnimatedButtonAsButton | AnimatedButtonAsLink;

export function AnimatedButton(props: AnimatedButtonProps) {
  if ("href" in props && props.href !== undefined) {
    const {
      href,
      navigationDelay = DEFAULT_DELAY,
      onClick,
      prefetch,
      target,
      rel,
      children,
      className,
      variant = "primary",
      "aria-label": ariaLabel,
    } = props;

    return (
      <DelayedNavLink
        href={href}
        delay={navigationDelay}
        prefetch={prefetch}
        target={target}
        rel={rel}
        onClick={onClick}
        aria-label={ariaLabel}
        className={buildClassName(variant, className)}
      >
        {children}
      </DelayedNavLink>
    );
  }

  const {
    variant = "primary",
    className,
    children,
    onClick,
    actionDelay,
    type,
    ...rest
  } = props;

  const wrappedOnClick =
    actionDelay && actionDelay > 0 && onClick && type !== "submit"
      ? (event: MouseEvent<HTMLButtonElement>) => {
          event.persist?.();
          window.setTimeout(() => onClick(event), actionDelay);
        }
      : onClick;

  return (
    <button
      {...rest}
      type={type ?? "button"}
      onClick={wrappedOnClick}
      className={buildClassName(variant, className)}
    >
      {children}
    </button>
  );
}

interface DelayedNavLinkProps {
  href: string;
  delay: number;
  prefetch?: boolean | null;
  target?: string;
  rel?: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  "aria-label"?: string;
  children: ReactNode;
}

function DelayedNavLink({
  href,
  delay,
  prefetch,
  target,
  rel,
  className,
  onClick,
  "aria-label": ariaLabel,
  children,
}: DelayedNavLinkProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(event);
    if (event.defaultPrevented) return;

    if (target && target !== "_self") return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    if (isExternalHref(href)) return;

    event.preventDefault();
    const safeDelay = Math.max(0, delay);
    window.setTimeout(() => {
      router.push(href);
    }, safeDelay);
  };

  return (
    <Link
      href={href}
      prefetch={prefetch ?? undefined}
      target={target}
      rel={rel}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Link>
  );
}

export default AnimatedButton;
