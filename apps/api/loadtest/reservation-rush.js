import http from "k6/http"
import { check } from "k6"

const API = __ENV.API_URL || "http://localhost:4000"
const PEAK_RPS = Number(__ENV.PEAK_RPS || 2500)
const MAX_VUS = Number(__ENV.MAX_VUS || 5000)

export const options = {
  scenarios: {
    rush: {
      executor: "ramping-arrival-rate",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: 500,
      maxVUs: MAX_VUS,
      stages: [
        { duration: "1s", target: PEAK_RPS },
        { duration: "2s", target: PEAK_RPS },
        { duration: "1s", target: 0 },
      ],
    },
  },
  thresholds: {
    "http_req_duration{op:hold}": ["p(95)<500"],
    "http_req_duration{op:confirm}": ["p(95)<500"],
    checks: ["rate>0.98"],
  },
}

const EXPECTED_HOLD_ERRORS = /sold_out|already_holding|already_booked/

function postJson(path, body, op) {
  return http.post(`${API}${path}`, JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    tags: { op },
  })
}

export function setup() {
  const r = http.post(`${API}/tickets/seed`)
  if (r.status !== 200) throw new Error(`seed failed: ${r.status} ${r.body}`)
}

export default function () {
  const userId = crypto.randomUUID()

  const hold = postJson(`/tickets/booking`, { userId }, "hold")
  check(hold, {
    "hold resolved": (r) =>
      r.status === 200 || EXPECTED_HOLD_ERRORS.test(String(r.body)),
  })
  if (hold.status !== 200) return

  const confirm = postJson(`/tickets/confirm`, { userId }, "confirm")
  check(confirm, { "confirm 200": (r) => r.status === 200 })
}

export function teardown() {
  const r = http.get(`${API}/tickets/available`)
  console.log(`available after: ${r.json("available")}`)
}

export function handleSummary(data) {
  const m = data.metrics
  const p95 = (name) => `${(m[name]?.values?.["p(95)"] ?? 0).toFixed(2)}ms`
  const ok = (name) =>
    !Object.values(m[name]?.thresholds ?? {}).some((t) => !t.ok)
  const mark = (pass) => (pass ? "✓" : "✗")

  const reqs = m.http_reqs.values.count
  const rps = m.http_reqs.values.rate.toFixed(0)
  const checksRate = (m.checks.values.rate * 100).toFixed(1)

  const lines = [
    "",
    "━━━ Sonic Ticket Rush ━━━",
    `requests     ${reqs} (${rps}/s)`, // total requests and achieved RPS
    `iterations   ${m.iterations.values.count}`, // total iterations (successful VU executions)
    "",
    `${mark(ok("http_req_duration{op:hold}"))}  hold p95      ${p95("http_req_duration{op:hold}")}`,
    `${mark(ok("http_req_duration{op:confirm}"))}  confirm p95   ${p95("http_req_duration{op:confirm}")}`,
    `${mark(ok("checks"))}  checks        ${checksRate}%`,
    "",
  ]

  return { stdout: lines.join("\n") + "\n" }
}
