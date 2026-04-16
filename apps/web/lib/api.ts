import { treaty } from "@elysiajs/eden"
import type { App } from "api"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export const api: ReturnType<typeof treaty<App>> = treaty<App>(apiUrl)
