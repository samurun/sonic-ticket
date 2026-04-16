"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "sonic-user-id"

export function useUserId() {
  const [userId, setUserId] = useState("")

  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    setUserId(id)
  }, [])

  return userId
}
