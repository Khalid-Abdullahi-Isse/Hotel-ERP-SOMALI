"use client";
import { Button } from "@/components/ui/button";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html lang="en"><body className="grid min-h-dvh place-items-center bg-background p-6"><main className="max-w-md text-center"><h1 className="text-2xl font-semibold">Hotel ERP could not start</h1><p className="mt-3 text-sm text-muted-foreground">Refresh the workspace. If the problem continues, check the frontend and API logs.</p><Button className="mt-6" onClick={reset}>Try again</Button></main></body></html>; }
