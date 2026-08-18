"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, UserRoundSearch } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatShortDate, titleCase } from "@/lib/format";
import type { GuestSummary } from "@/types/guest";

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function GuestStatus({ guest }: { guest: GuestSummary }) { return guest.status ? <Badge variant="outline" className={guest.status === "in_house" ? "border-primary/20 bg-primary/8 text-primary" : "bg-muted/50"}>{titleCase(guest.status)}</Badge> : <span className="text-xs text-muted-foreground">—</span>; }
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(event) => onChange(event.target.value)} type="search" placeholder="Search name, guest ID, phone, or nationality" aria-label="Search guests" className="h-9 pl-9" /></div>; }

export function GuestsTable({ guests }: { guests: GuestSummary[] }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visible = guests.filter((guest) => !query || [guest.name, guest.guestCode, guest.phone, guest.email, guest.nationality].some((value) => value?.toLowerCase().includes(query)));
  return <div><div className="border-b p-4"><SearchBox value={search} onChange={setSearch} /></div>{visible.length === 0 ? <EmptyState icon={UserRoundSearch} title="No guests found" description="Try another name, phone number, or guest ID." action={<Button variant="outline" onClick={() => setSearch("")}>Clear search</Button>} /> : <><div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Guest ID</TableHead><TableHead>Contact</TableHead><TableHead>Nationality</TableHead><TableHead>Last stay</TableHead><TableHead>Stays</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Profile</TableHead></TableRow></TableHeader><TableBody>{visible.map((guest) => <TableRow key={guest.id}><TableCell><div className="flex items-center gap-3"><Avatar className="size-8"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(guest.name)}</AvatarFallback></Avatar><div><p className="font-medium">{guest.name}</p>{guest.currentRoom ? <p className="text-[11px] text-muted-foreground">Currently in room {guest.currentRoom}</p> : null}</div></div></TableCell><TableCell className="font-mono text-xs text-primary">{guest.guestCode}</TableCell><TableCell><p className="text-xs">{guest.phone}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{guest.email ?? "Email not provided"}</p></TableCell><TableCell>{guest.nationality}</TableCell><TableCell>{guest.lastStay ? formatShortDate(guest.lastStay) : "—"}</TableCell><TableCell>{guest.totalStays ?? "—"}</TableCell><TableCell><GuestStatus guest={guest} /></TableCell><TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link href={`/guests/${guest.id}`}>View</Link></Button></TableCell></TableRow>)}</TableBody></Table></div><div className="divide-y md:hidden">{visible.map((guest) => <article key={guest.id} className="space-y-3 p-4"><div className="flex items-center gap-3"><Avatar><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(guest.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="font-medium">{guest.name}</p><p className="text-xs text-muted-foreground">{guest.guestCode} · {guest.nationality}</p></div><GuestStatus guest={guest} /></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Phone</p><p className="mt-1 font-medium">{guest.phone}</p></div><div><p className="text-muted-foreground">Previous stays</p><p className="mt-1 font-medium">{guest.totalStays ?? "—"}</p></div></div><Button asChild variant="outline" size="sm" className="w-full"><Link href={`/guests/${guest.id}`}>Open guest profile</Link></Button></article>)}</div></>}<div className="border-t px-4 py-3 text-xs text-muted-foreground">{visible.length} of {guests.length} guests</div></div>;
}
