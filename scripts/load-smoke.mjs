const baseUrl = process.env.LOAD_URL || 'http://127.0.0.1:4177/'
const concurrency = Math.max(1, Number(process.env.LOAD_CONCURRENCY || 10))
const rounds = Math.max(1, Number(process.env.LOAD_ROUNDS || 20))

const samples = []
let failures = 0
for (let round = 0; round < rounds; round += 1) {
  const results = await Promise.all(Array.from({ length: concurrency }, async () => {
    const started = performance.now()
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' })
      const elapsed = performance.now() - started
      if (!response.ok) failures += 1
      return elapsed
    } catch {
      failures += 1
      return null
    }
  }))
  samples.push(...results.filter((value) => value !== null))
}

if (!samples.length) {
  console.error(`Nenhuma resposta recebida de ${baseUrl}`)
  process.exit(1)
}

samples.sort((a, b) => a - b)
const percentile = (ratio) => samples[Math.min(samples.length - 1, Math.floor(samples.length * ratio))]
const failureRate = failures / (rounds * concurrency)
console.log(JSON.stringify({
  url: baseUrl,
  requests: rounds * concurrency,
  failures,
  failureRate: Number(failureRate.toFixed(4)),
  p50Ms: Number(percentile(0.5).toFixed(1)),
  p95Ms: Number(percentile(0.95).toFixed(1)),
  maxMs: Number(samples.at(-1).toFixed(1)),
}, null, 2))

if (failureRate > 0.01) process.exit(1)
