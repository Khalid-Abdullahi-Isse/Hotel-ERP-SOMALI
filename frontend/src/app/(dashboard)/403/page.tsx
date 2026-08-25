import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Access denied" };
export default function ForbiddenPage() {
  return <Card className="mx-auto max-w-xl"><CardContent className="py-14 text-center"><ShieldX className="mx-auto size-10 text-destructive" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold">Access denied</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">You do not have permission to access this administration area.</p><Button asChild className="mt-6"><Link href="/dashboard">Return to dashboard</Link></Button></CardContent></Card>;
}
