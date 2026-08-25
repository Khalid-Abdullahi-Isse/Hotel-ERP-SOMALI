"use client";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const permissionDenied = /permission|forbidden/i.test(error.message);
  const serverUnavailable = /fetch|network|connect|ECONN|unavailable|timeout/i.test(error.message);
  const title = permissionDenied ? "You don't have access to this page" : serverUnavailable ? "Hotel server unavailable" : "This page could not be loaded";
  const message = permissionDenied ? "Contact an administrator if you need access." : serverUnavailable ? "We can't reach the hotel server right now. Your current data has not been changed." : "The request did not complete. Try again, and contact an administrator if the problem continues.";
  return <div className="mx-auto max-w-xl py-16"><ErrorMessage title={title} message={message} />{permissionDenied ? null : <Button className="mt-4" onClick={retry}>Try again</Button>}</div>;
}
