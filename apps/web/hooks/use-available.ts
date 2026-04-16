"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function useAvailable() {
  return useQuery({
    queryKey: ["available"],
    queryFn: async () => {
      const { data, error } = await api.tickets.available.get()
      if (error) throw error
      return data
    },
  })
}
