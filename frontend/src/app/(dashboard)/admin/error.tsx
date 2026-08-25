"use client";

import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const denied = /permission|administrator|forbidden/i.test(error.message);
  return <div className="mx-auto max-w-xl py-16"><ErrorMessage title={denied ? "Access denied" : "Administration could not be loaded"} message={denied ? "You do not have permission to perform this action." : "The request could not be completed. No account data was changed."} />{denied ? null : <Button className="mt-4" onClick={retry}>Try again</Button>}</div>;
}
