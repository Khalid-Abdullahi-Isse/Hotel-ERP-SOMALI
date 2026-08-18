import Link from "next/link";
import { BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
export default function RoomNotFound() { return <Card><EmptyState icon={BedDouble} title="Room not found" description="This room may have been removed, or the link is no longer valid." action={<Button asChild><Link href="/rooms">Return to rooms</Link></Button>} /></Card>; }
