"use client"

import { Button } from "@workspace/ui/components/button"

import { useHealth } from "@/hooks/use-health"
import { useAvailable } from "@/hooks/use-available"
import { useBooking } from "@/hooks/use-booking"
import { useStatus } from "@/hooks/use-status"
import { useConfirm } from "@/hooks/use-confirm"
import { useUserId } from "@/hooks/use-user-id"
import { Countdown } from "@/components/countdown"

export default function Page() {
  const userId = useUserId()
  const health = useHealth()
  const available = useAvailable()
  const status = useStatus(userId)
  const booking = useBooking(userId)
  const confirmation = useConfirm(userId)

  const availableSeats = available.data?.available ?? 0
  const canBook =
    !available.isLoading && availableSeats > 0 && !booking.isPending

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <header>
          <h1 className="font-medium">Sonic Ticket</h1>
          <p className="text-muted-foreground">API health (live polling)</p>
        </header>

        <div className="rounded-md border border-border p-4 font-mono text-xs">
          {health.isLoading && <span>Loading…</span>}
          {health.isError && (
            <span className="text-destructive">
              Error: {(health.error as Error).message}
            </span>
          )}
          {health.data && (
            <div>
              <span className="text-muted-foreground">available: </span>
              <span
                className={
                  availableSeats > 0 ? "text-green-600" : "text-red-600"
                }
              >
                {availableSeats}
              </span>
            </div>
          )}
        </div>

        {status.data?.status === "holding" && (
          <>
            <Countdown
              seconds={Math.floor(
                (status.data.expiresAt.getTime() - Date.now()) / 1000
              )}
            />
            <Button
              className="w-fit"
              disabled={confirmation.isPending}
              onClick={() => confirmation.mutate()}
            >
              {confirmation.isPending ? "Confirming..." : "Confirm"}
            </Button>
          </>
        )}

        {status.data?.status === "none" && (
          <Button
            className="w-fit"
            disabled={!canBook}
            onClick={() => booking.mutate()}
          >
            {booking.isPending ? "Booking..." : "Book"}
          </Button>
        )}

        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}
