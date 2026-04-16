"use client"

import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useState } from "react"

export function Countdown({ seconds }: { seconds: number }) {
  const queryClient = useQueryClient()
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => setRemaining(seconds), [seconds])

  useEffect(() => {
    if (remaining <= 0) {
      queryClient.invalidateQueries({ queryKey: ["status"] })
      queryClient.invalidateQueries({ queryKey: ["available"] })
      return
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, queryClient])

  const mm = Math.floor(Math.max(remaining, 0) / 60)
  const ss = (Math.max(remaining, 0) % 60).toString().padStart(2, "0")

  return (
    <div
      className={cn(
        "text-2xl font-bold",
        remaining > 60 && "text-green-600",
        remaining > 30 && remaining <= 60 && "text-yellow-600",
        remaining > 0 && remaining <= 30 && "text-red-600"
      )}
    >
      {mm}:{ss}
    </div>
  )
}
