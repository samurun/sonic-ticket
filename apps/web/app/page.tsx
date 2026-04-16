"use client"

import { Button } from "@workspace/ui/components/button"

import { useHealth } from "@/hooks/use-health"

export default function Page() {
  const { data, isLoading, isError, error } = useHealth()

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Sonic Ticket</h1>
          <p className="text-muted-foreground">API health (live polling)</p>
        </div>

        <div className="rounded-md border border-border p-4 font-mono text-xs">
          {isLoading && <span>Loading…</span>}
          {isError && (
            <span className="text-destructive">
              Error: {(error as Error).message}
            </span>
          )}
          {data && (
            <div className="flex flex-col gap-1">
              <div>
                <span className="text-muted-foreground">database: </span>
                <StatusBadge status={data.database} />
              </div>
              <div>
                <span className="text-muted-foreground">redis: </span>
                <StatusBadge status={data.redis} />
              </div>
              <div className="text-muted-foreground">
                at {data.timestamp.toString()}
              </div>
            </div>
          )}
        </div>

        <Button className="w-fit">Button</Button>

        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: "ok" | "down" }) {
  return (
    <span className={status === "ok" ? "text-green-600" : "text-red-600"}>
      {status}
    </span>
  )
}
