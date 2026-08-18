"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, Play, Plus, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { maintenanceService } from "@/services/catalog.service";
import type { ApiMaintenanceRequest, ApiRoom, ApiSystemUser } from "@/types/api-contracts";

export function MaintenanceManager({ requests, rooms, users, canCreate, canUpdate }: {
  requests: ApiMaintenanceRequest[]; rooms: ApiRoom[]; users: ApiSystemUser[];
  canCreate: boolean; canUpdate: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [assignedToId, setAssignedToId] = useState("unassigned");
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => { setShowForm(false); setRoomId(""); router.refresh(); },
  });

  return <div className="space-y-6">
    {mutation.error ? <Alert variant="destructive"><AlertTitle>Maintenance request could not be changed</AlertTitle><AlertDescription>{getApiError(mutation.error).message}</AlertDescription></Alert> : null}
    {showForm ? <Card>
      <CardHeader><CardTitle>New maintenance request</CardTitle></CardHeader>
      <CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        mutation.mutate(() => maintenanceService.create({ roomId, problem: String(data.get("problem") ?? "").trim(), notes: String(data.get("notes") ?? "").trim() || undefined, assignedToId: assignedToId === "unassigned" ? undefined : assignedToId }));
      }}>
        <div className="space-y-2"><Label htmlFor="maintenance-room">Room</Label><Select value={roomId} onValueChange={setRoomId} required><SelectTrigger id="maintenance-room" className="w-full"><SelectValue placeholder="Choose a room" /></SelectTrigger><SelectContent>{rooms.filter((room) => room.isActive).map((room) => <SelectItem key={room.id} value={room.id}>{room.roomNumber} · {room.status.toLowerCase()}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="maintenance-assignee">Assignee</Label><Select value={assignedToId} onValueChange={setAssignedToId}><SelectTrigger id="maintenance-assignee" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{users.filter((user) => user.status === "ACTIVE").map((user) => <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="problem">Problem</Label><Textarea id="problem" name="problem" minLength={3} maxLength={2000} required placeholder="Describe the issue and where it was observed." /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" maxLength={2000} placeholder="Optional instructions for the assignee." /></div>
        <div className="flex justify-end gap-2 border-t pt-4 md:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={!roomId || mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}Create request</Button></div>
      </form></CardContent>
    </Card> : canCreate ? <div className="flex justify-end"><Button onClick={() => { mutation.reset(); setShowForm(true); }}><Plus />New request</Button></div> : null}
    <Card className="overflow-hidden py-0">
      {requests.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><Wrench className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">No maintenance requests</p><p className="text-sm text-muted-foreground">Open requests will appear here.</p></div> : <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Problem</TableHead><TableHead>Assigned to</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>{requests.map((request) => <TableRow key={request.id}>
          <TableCell className="font-mono font-semibold">{request.room.roomNumber}</TableCell><TableCell><p className="max-w-lg font-medium">{request.problem}</p>{request.notes ? <p className="max-w-lg truncate text-xs text-muted-foreground">{request.notes}</p> : null}</TableCell><TableCell>{request.assignedTo?.fullName ?? "Unassigned"}</TableCell><TableCell><MaintenanceBadge status={request.status} /></TableCell><TableCell className="text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.createdAt))}</TableCell>
          <TableCell><div className="flex justify-end gap-1">{canUpdate && request.status === "OPEN" ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.start(request.id))}><Play />Start</Button> : null}{canUpdate && request.status === "IN_PROGRESS" ? <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.complete(request.id, {}))}><CheckCircle2 />Complete</Button> : null}</div></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    </Card>
  </div>;
}

function MaintenanceBadge({ status }: { status: ApiMaintenanceRequest["status"] }) {
  return <Badge variant={status === "DONE" ? "secondary" : status === "IN_PROGRESS" ? "default" : "outline"}>{status === "IN_PROGRESS" ? "In progress" : status === "DONE" ? "Done" : "Open"}</Badge>;
}
