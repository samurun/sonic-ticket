"use client"

import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.health.get()
      if (error) throw error
      return data
    },
    refetchInterval: 5000,
  })
}
