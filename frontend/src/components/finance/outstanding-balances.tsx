import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatShortDate } from "@/lib/format";
import type { OutstandingBalance } from "@/types/finance";

export function OutstandingBalances({ balances }: { balances: OutstandingBalance[] }) { return <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Guest</TableHead><TableHead>Booking</TableHead><TableHead>Room</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader><TableBody>{balances.map((balance) => <TableRow key={balance.id}><TableCell className="font-medium">{balance.guestName}</TableCell><TableCell className="font-mono text-xs text-primary">{balance.bookingId}</TableCell><TableCell>{balance.roomNumber}</TableCell><TableCell><span className="flex items-center gap-2 whitespace-nowrap">{formatShortDate(balance.dueDate)}{balance.overdue ? <Badge variant="destructive"><AlertCircle />Overdue</Badge> : null}</span></TableCell><TableCell className="text-right font-semibold tabular-nums">{formatCurrency(balance.amount, balance.currency)}</TableCell></TableRow>)}</TableBody></Table></div>; }
