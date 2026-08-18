"use client";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="mx-auto max-w-xl py-16"><ErrorMessage title="The hotel server is unavailable" message="We could not load this workspace. Check that the backend is running and try again." /><Button className="mt-4" onClick={retry}>Try again</Button></div>;
}
