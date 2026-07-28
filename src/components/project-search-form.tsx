"use client";

import { FormEvent } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function ProjectSearchForm() {
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (!query) return;
    const params = new URLSearchParams({ q: query });
    router.push(`/knowledge?${params.toString()}`);
  }
  return <form className="search-box" action="/knowledge" method="get" role="search" onSubmit={submit}><input name="q" aria-label="Search this project" placeholder="Search controlled project knowledge…" /><button className="search-submit" type="submit" aria-label="Search project"><Search size={17} /></button></form>;
}
