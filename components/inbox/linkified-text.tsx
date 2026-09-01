"use client";

import { Fragment, useMemo } from "react";
import { linkifyParts } from "@/lib/mail/linkify";

export function LinkifiedText({
  text,
  className,
  linkClassName = "font-medium underline underline-offset-2",
}: {
  text: string;
  className?: string;
  linkClassName?: string;
}) {
  const parts = useMemo(() => linkifyParts(text), [text]);

  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (part.type === "link") {
          return (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
            >
              {part.label}
            </a>
          );
        }
        return <Fragment key={index}>{part.value}</Fragment>;
      })}
    </p>
  );
}
