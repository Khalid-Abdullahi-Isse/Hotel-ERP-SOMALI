import Link from "next/link";
import { UserRoundX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
export default function GuestNotFound() { return <EmptyState icon={UserRoundX} title="Guest not found" description="This guest record may have been removed or the address is invalid." action={<Button asChild><Link href="/guests">Return to guests</Link></Button>} />; }
