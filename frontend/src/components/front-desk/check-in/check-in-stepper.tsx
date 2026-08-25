import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckInStep } from "@/types/check-in";

export const CHECK_IN_STEPS: Array<{ id: CheckInStep; label: string }> = [
  { id: "reservation", label: "Reservation" },
  { id: "guest", label: "Guest" },
  { id: "room", label: "Room" },
  { id: "payment", label: "Payment" },
  { id: "confirm", label: "Confirm" },
];

export function CheckInStepper({ current }: { current: CheckInStep }) {
  const currentIndex = CHECK_IN_STEPS.findIndex((step) => step.id === current);
  return (
    <nav aria-label="Check-in progress">
      <p className="mb-3 text-xs font-medium text-muted-foreground sm:hidden">
        Step {currentIndex + 1} of {CHECK_IN_STEPS.length} · {CHECK_IN_STEPS[currentIndex].label}
      </p>
      <ol className="flex items-center" role="list">
        {CHECK_IN_STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.id} className={cn("flex items-center", index < CHECK_IN_STEPS.length - 1 && "flex-1")} aria-current={active ? "step" : undefined}>
              <span className="flex items-center gap-2">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold", completed && "border-primary bg-primary text-primary-foreground", active && "border-primary text-primary", !completed && !active && "text-muted-foreground")}>
                  {completed ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span className={cn("hidden text-xs font-medium sm:block", active ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
              </span>
              {index < CHECK_IN_STEPS.length - 1 ? <span className={cn("mx-2 h-px flex-1 bg-border sm:mx-3", completed && "bg-primary")} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
