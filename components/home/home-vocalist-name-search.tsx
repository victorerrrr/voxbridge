"use client";

import { VocalistNameSearch } from "@/components/vocalist-name-search";

type HomeVocalistNameSearchProps = {
  inputId?: string;
  className?: string;
};

export function HomeVocalistNameSearch({
  inputId = "home-vocalist-search",
  className = "",
}: HomeVocalistNameSearchProps) {
  return (
    <VocalistNameSearch variant="hero" inputId={inputId} className={className} />
  );
}
