"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Segmented } from "./ui/segmented";

export function LanguageSwitch({ label }: { label: string }) {
  const locale = useLocale() as "et" | "en";
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Segmented
      size="sm"
      label={label}
      value={locale}
      onChange={(code) => {
        // Read the live query: the explorer updates it via history.replaceState.
        const query = window.location.search;
        router.replace(`${pathname}${query}${window.location.hash}`, { locale: code, scroll: false });
      }}
      options={[
        { value: "et", label: "ET", ariaLabel: "Eesti keel" },
        { value: "en", label: "EN", ariaLabel: "English" },
      ]}
    />
  );
}
