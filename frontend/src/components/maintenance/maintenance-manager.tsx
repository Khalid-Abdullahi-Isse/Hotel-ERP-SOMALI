"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleOff,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Undo2,
  UserPlus,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiError } from "@/lib/api-error";
import { maintenanceService } from "@/services/catalog.service";
import type { ApiMaintenancePriority, ApiMaintenanceRequest, ApiMaintenanceStatus, ApiRoom, ApiSystemUser } from "@/types/api-contracts";

const PRIORITIES: ApiMaintenancePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function MaintenanceManager({ requests, rooms, users, canCreate, canUpdate }: {
  requests: ApiMaintenanceRequest[]; rooms: ApiRoom[]; users: ApiSystemUser[];
  canCreate: boolean; canUpdate: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [assignedToId, setAssignedToId] = useState("unassigned");
  const [priority, setPriority] = useState<ApiMaintenancePriority>("MEDIUM");
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
        mutation.mutate(() => maintenanceService.create({ roomId, problem: String(data.get("problem") ?? "").trim(), notes: String(data.get("notes") ?? "").trim() || undefined, assignedToId: assignedToId === "unassigned" ? undefined : assignedToId, category: String(data.get("category") ?? "").trim() || undefined, priority }));
      }}>
        <div className="space-y-2"><Label htmlFor="maintenance-room">Room</Label><Select value={roomId} onValueChange={setRoomId} required><SelectTrigger id="maintenance-room" className="w-full"><SelectValue placeholder="Choose a room" /></SelectTrigger><SelectContent>{rooms.filter((room) => room.isActive).map((room) => <SelectItem key={room.id} value={room.id}>{room.roomNumber} · {room.status.toLowerCase()}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="maintenance-assignee">Assignee</Label><Select value={assignedToId} onValueChange={setAssignedToId}><SelectTrigger id="maintenance-assignee" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{users.filter((user) => user.status === "ACTIVE").map((user) => <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="maintenance-priority">Priority</Label><Select value={priority} onValueChange={(value) => setPriority(value as ApiMaintenancePriority)}><SelectTrigger id="maintenance-priority" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((item) => <SelectItem key={item} value={item}>{item[0] + item.slice(1).toLowerCase()}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="maintenance-category">Category</Label><Input id="maintenance-category" name="category" maxLength={100} placeholder="e.g. Plumbing, Electrical" /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="problem">Problem</Label><Textarea id="problem" name="problem" minLength={3} maxLength={2000} required placeholder="Describe the issue and where it was observed." /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" maxLength={2000} placeholder="Optional instructions for the assignee." /></div>
        <div className="flex justify-end gap-2 border-t pt-4 md:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={!roomId || mutation.isPending}>{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}Create request</Button></div>
      </form></CardContent>
    </Card> : canCreate ? <div className="flex justify-end"><Button onClick={() => { mutation.reset(); setShowForm(true); }}><Plus />New request</Button></div> : null}
    <Card className="overflow-hidden py-0">
      {requests.length === 0 ? <div className="flex flex-col items-center px-6 py-14 text-center"><Wrench className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">No maintenance requests</p><p className="text-sm text-muted-foreground">Requests in this view will appear here.</p></div> : <div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Problem</TableHead><TableHead>Assigned to</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>{requests.map((request) => <TableRow key={request.id}>
          <TableCell className="font-mono font-semibold">{request.room.roomNumber}</TableCell><TableCell><p className="max-w-lg font-medium">{request.problem}</p>{request.category ? <p className="max-w-lg truncate text-xs text-muted-foreground">{request.category}</p> : null}</TableCell><TableCell>{request.assignedTo?.fullName ?? "Unassigned"}</TableCell><TableCell><PriorityBadge priority={request.priority} /></TableCell><TableCell><MaintenanceBadge status={request.status} /></TableCell><TableCell className="text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(request.createdAt))}</TableCell>
          <TableCell><div className="flex justify-end gap-1">{!canUpdate ? null : <>
            {request.status === "OPEN" ? <>
              <AssignButton users={users} disabled={mutation.isPending} onAssign={(assignedToId) => mutation.mutate(() => maintenanceService.assign(request.id, assignedToId))} />
              <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.start(request.id))}><Play />Start</Button>
              <CancelButton disabled={mutation.isPending} onCancel={(reason) => mutation.mutate(() => maintenanceService.cancel(request.id, reason))} />
            </> : null}
            {request.status === "ASSIGNED" ? <>
              <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.start(request.id))}><Play />Start</Button>
              <CancelButton disabled={mutation.isPending} onCancel={(reason) => mutation.mutate(() => maintenanceService.cancel(request.id, reason))} />
            </> : null}
            {request.status === "IN_PROGRESS" ? <>
              <HoldButton disabled={mutation.isPending} onHold={(reason) => mutation.mutate(() => maintenanceService.hold(request.id, reason))} />
              <CompleteMaintenanceButton disabled={mutation.isPending} onComplete={(input) => mutation.mutateAsync(() => maintenanceService.complete(request.id, input)).then(() => undefined)} />
              <CancelButton disabled={mutation.isPending} onCancel={(reason) => mutation.mutate(() => maintenanceService.cancel(request.id, reason))} />
            </> : null}
            {request.status === "ON_HOLD" ? <>
              <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.resume(request.id))}><Undo2 />Resume</Button>
              <CancelButton disabled={mutation.isPending} onCancel={(reason) => mutation.mutate(() => maintenanceService.cancel(request.id, reason))} />
            </> : null}
            {request.status === "COMPLETED" ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.verify(request.id))}><ShieldCheck />Verify</Button> : null}
            {request.status === "VERIFIED" ? <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate(() => maintenanceService.close(request.id))}><CheckCircle2 />Close</Button> : null}
          </>}</div></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    </Card>
  </div>;
}

function AssignButton({ users, disabled, onAssign }: { users: ApiSystemUser[]; disabled: boolean; onAssign: (assignedToId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [assignedToId, setAssignedToId] = useState("");
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={disabled}><UserPlus />Assign</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Assign maintenance work</AlertDialogTitle><AlertDialogDescription>Choose a hotel staff member to take responsibility.</AlertDialogDescription></AlertDialogHeader>
      <div className="space-y-2"><Label htmlFor="maintenance-assign-to">Assignee</Label><Select value={assignedToId} onValueChange={setAssignedToId}><SelectTrigger id="maintenance-assign-to" className="w-full"><SelectValue placeholder="Choose an assignee" /></SelectTrigger><SelectContent>{users.filter((user) => user.status === "ACTIVE").map((user) => <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>)}</SelectContent></Select></div>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!assignedToId || disabled} onClick={(event) => { event.preventDefault(); if (!assignedToId) return; onAssign(assignedToId); setOpen(false); }}>Assign</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function HoldButton({ disabled, onHold }: { disabled: boolean; onHold: (reason?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={disabled}><Pause />Hold</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Put maintenance on hold?</AlertDialogTitle><AlertDialogDescription>Optionally record why work is paused.</AlertDialogDescription></AlertDialogHeader>
      <div className="space-y-2"><Label htmlFor="maintenance-hold-reason">Reason</Label><Textarea id="maintenance-hold-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Optional reason for the hold." /></div>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); onHold(reason.trim() || undefined); setOpen(false); }}>Hold</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function CancelButton({ disabled, onCancel }: { disabled: boolean; onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={disabled}><CircleOff />Cancel</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Cancel maintenance work?</AlertDialogTitle><AlertDialogDescription>A reason is required. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
      <div className="space-y-2"><Label htmlFor="maintenance-cancel-reason">Reason</Label><Textarea id="maintenance-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={1} maxLength={500} required placeholder="Why is this maintenance being cancelled?" /></div>
      <AlertDialogFooter><AlertDialogCancel>Back</AlertDialogCancel><AlertDialogAction disabled={!reason.trim() || disabled} onClick={(event) => { event.preventDefault(); if (!reason.trim()) return; onCancel(reason.trim()); setOpen(false); }}>Cancel maintenance</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function CompleteMaintenanceButton({ disabled, onComplete }: { disabled: boolean; onComplete: (input: { cost?: string; notes?: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button size="sm" disabled={disabled}><CheckCircle2 />Complete</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Complete maintenance work?</AlertDialogTitle><AlertDialogDescription>Record the outcome. If a cost is entered, an auto-approved expense is created. The room returns to service only on close.</AlertDialogDescription></AlertDialogHeader>
      <div className="grid gap-4"><div className="space-y-2"><Label htmlFor="maintenance-cost">Cost</Label><Input id="maintenance-cost" type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0.00" /></div><div className="space-y-2"><Label htmlFor="maintenance-completion-notes">Completion notes</Label><Textarea id="maintenance-completion-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Work completed, parts replaced, or follow-up required." /></div></div>
      <AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={async (event) => { event.preventDefault(); setSaving(true); try { await onComplete({ cost: cost || undefined, notes: notes.trim() || undefined }); setOpen(false); } catch { /* Mutation state renders the API error above the table. */ } finally { setSaving(false); } }}>{saving ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}{saving ? "Saving..." : "Complete work"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function PriorityBadge({ priority }: { priority: ApiMaintenancePriority }) {
  return <Badge variant={priority === "URGENT" ? "destructive" : priority === "HIGH" ? "secondary" : "outline"}>{priority[0] + priority.slice(1).toLowerCase()}</Badge>;
}

function MaintenanceBadge({ status }: { status: ApiMaintenanceStatus }) {
  const label = status[0] + status.slice(1).toLowerCase().replace(/_/g, " ");
  const variant: "default" | "secondary" | "outline" | "destructive" =
    status === "IN_PROGRESS" ? "default"
      : status === "ON_HOLD" ? "secondary"
        : status === "CANCELLED" ? "destructive"
          : status === "CLOSED" ? "outline"
            : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}
