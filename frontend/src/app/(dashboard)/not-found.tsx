import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardNotFound() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="py-14 text-center">
        <FileQuestion className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">Record not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This hotel record may have been removed, or the link may be incorrect.
        </p>
        <Button asChild className="mt-6"><Link href="/dashboard">Return to dashboard</Link></Button>
      </CardContent>
    </Card>
  );
}
