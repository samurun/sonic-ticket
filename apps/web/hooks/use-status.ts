"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function useStatus(userId: string) {
  return useQuery({
    queryKey: ["status", userId],
    queryFn: async () => {
      const { data, error } = await api.tickets.status.get({
        query: { userId },
      })
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}
