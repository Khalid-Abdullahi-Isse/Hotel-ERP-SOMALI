import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiInvoice } from "@/types/api-contracts";

export function InvoicesTable({ invoices }: { invoices: ApiInvoice[] }) {
  return <Card className="overflow-hidden py-0">{invoices.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><FileText className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">No invoices issued</p><p className="text-sm text-muted-foreground">Invoices are created from checked-out reservations.</p></div> : <div className="overflow-x-auto"><Table>
    <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Guest</TableHead><TableHead>Reservation</TableHead><TableHead>Status</TableHead><TableHead>Issued</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
    <TableBody>{invoices.map((invoice) => <TableRow key={invoice.id}><TableCell className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</TableCell><TableCell className="font-medium">{invoice.reservation.guest.fullName}</TableCell><TableCell className="font-mono text-xs">{invoice.reservation.bookingNumber}</TableCell><TableCell><Badge variant={invoice.status === "VOIDED" ? "destructive" : invoice.status === "ISSUED" ? "default" : "secondary"}>{invoice.status.toLowerCase()}</Badge></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{invoice.issuedAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(invoice.issuedAt)) : "—"}</TableCell><TableCell className="text-right font-mono">{invoice.totalAmount}</TableCell><TableCell className="text-right font-mono font-semibold">{invoice.outstandingAmount}</TableCell></TableRow>)}</TableBody>
  </Table></div>}</Card>;
}
