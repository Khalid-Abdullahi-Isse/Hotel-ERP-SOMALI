import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main className="grid min-h-dvh place-items-center p-6"><div className="max-w-md text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted"><MapPinOff className="size-6 text-muted-foreground" /></div><p className="mt-6 text-sm font-medium text-primary">404</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">The page you are looking for does not exist or has moved.</p><Button asChild className="mt-6"><Link href="/dashboard">Go to dashboard</Link></Button></div></main>; }
