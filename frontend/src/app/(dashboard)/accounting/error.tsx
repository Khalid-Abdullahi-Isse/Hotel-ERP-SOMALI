"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AccountingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <Card><CardContent className="flex min-h-80 flex-col items-center justify-center px-6 text-center"><div className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle className="size-5" /></div><h1 className="mt-5 text-xl font-semibold">Accounting could not be loaded</h1><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{error.message || "The ledger service did not return a usable response."}</p><Button className="mt-5" onClick={reset}><RotateCcw />Try again</Button></CardContent></Card>;
}
