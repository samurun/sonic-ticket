"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api"

export function useBooking(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["booking"],
    mutationFn: async () => {
      const { data, error } = await api.tickets.booking.post({ userId })
      if (error) throw error
      return data
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["available"] })
      queryClient.invalidateQueries({ queryKey: ["status", userId] })
    },
  })
}
