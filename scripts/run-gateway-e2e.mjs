import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOST = '127.0.0.1'

function npmInvocation(args, options = {}) {
  const npmCli = process.env.npm_execpath
  if (!npmCli) throw new Error('Run this command through npm so npm can resolve its own CLI.')
  return run(process.execPath, [npmCli, ...args], options)
}

function run(command, args, { cwd = ROOT, env = process.env, inherit = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(command)} exited with ${code ?? signal ?? 'unknown status'}`))
    })
  })
}

function startServer(command, args, env) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })
  const job = { child, stdout: [], stderr: [], exit: null, error: null }
  let resolveExit
  job.exitPromise = new Promise((resolve) => { resolveExit = resolve })
  child.stdout.on('data', (chunk) => job.stdout.push(chunk))
  child.stderr.on('data', (chunk) => job.stderr.push(chunk))
  child.once('error', (error) => {
    job.error = error
    job.exit = { code: null, signal: null }
    resolveExit()
  })
  child.once('exit', (code, signal) => {
    job.exit = { code, signal }
    resolveExit()
  })
  return job
}

function logs(job) {
  if (!job) return ''
  return [
    Buffer.concat(job.stdout).toString('utf8'),
    Buffer.concat(job.stderr).toString('utf8'),
  ].filter(Boolean).join('\n')
}

function processFailure(job, label) {
  if (job?.error) return new Error(`${label} could not start: ${job.error.message}\n${logs(job)}`)
  return new Error(`${label} exited before becoming ready (${job?.exit?.code ?? job?.exit?.signal ?? 'unknown'}).\n${logs(job)}`)
}

async function waitForHttp(url, job, label) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (job.exit) throw processFailure(job, label)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) })
      if (response.ok) return
    } catch {
      // Retry until the server is ready or the bounded deadline expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`${label} did not become ready at ${url}.\n${logs(job)}`)
}

async function reservePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, HOST, resolve)
  })
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function stop(job) {
  if (!job || job.exit) return
  job.child.kill('SIGTERM')
  await Promise.race([
    job.exitPromise,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ])
  if (!job.exit) {
    job.child.kill('SIGKILL')
    await job.exitPromise
  }
}

async function removeWithRetry(target) {
  let lastError
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 })
      return
    } catch (error) {
      lastError = error
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

async function findPython() {
  const pythonPath = process.platform === 'win32'
    ? path.join(ROOT, '.venv', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv', 'bin', 'python')
  const { access } = await import('node:fs/promises')
  try {
    await access(pythonPath)
    return pythonPath
  } catch {
    throw new Error('Project Python was not found. Run npm run setup first.')
  }
}

async function main() {
  if (process.env.E2E_FRONTEND_BUILT !== '1') {
    await npmInvocation(['--prefix', 'frontend', 'run', 'build'])
  }

  const python = await findPython()
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ai-dev-radar-gateway-e2e-'))
  const runName = `gateway-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
  const evidenceDir = path.join(ROOT, 'e2e-results', runName)
  await mkdir(evidenceDir, { recursive: true })

  const dbPath = path.resolve(tempDir, 'gateway-e2e.db').replaceAll('\\', '/')
  const env = {
    ...process.env,
    APP_ENV: 'e2e',
    DATABASE_URL: `sqlite:///${dbPath}`,
    SESSION_SECRET: 'e2e-only-session-secret',
    SESSION_HTTPS_ONLY: '0',
    SEED_PASSWORD: 'e2e-password',
    STATIC_DIR: path.join(ROOT, 'frontend', 'dist'),
    PYTHONPATH: [path.join(ROOT, 'backend'), ROOT, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  }

  let mock
  let radar
  let failure
  let cleanupError
  try {
    await run(python, [path.join(ROOT, 'e2e', 'support', 'prepare_e2e_data.py')], { env })

    const mockPort = await reservePort()
    const radarPort = await reservePort()
    const gatewayUrl = `http://${HOST}:${mockPort}`
    const radarUrl = `http://${HOST}:${radarPort}`

    mock = startServer(python, [
      '-m', 'uvicorn', 'e2e.mock_gateway.app:app',
      '--host', HOST, '--port', String(mockPort), '--no-access-log',
    ], env)
    await waitForHttp(`${gatewayUrl}/health/live`, mock, 'Mock Gateway')
    const reset = await fetch(`${gatewayUrl}/_mock/reset`, { method: 'POST' })
    if (!reset.ok) throw new Error(`Mock Gateway reset failed with ${reset.status}.`)

    radar = startServer(python, [
      '-m', 'uvicorn', 'app.main:app', '--app-dir', path.join(ROOT, 'backend'),
      '--host', HOST, '--port', String(radarPort), '--no-access-log',
    ], env)
    await waitForHttp(`${radarUrl}/openapi.json`, radar, 'Radar')

    const playwrightCli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js')
    await run(process.execPath, [playwrightCli, 'test', '--config=playwright.config.mjs'], {
      env: {
        ...env,
        E2E_RADAR_URL: radarUrl,
        E2E_GATEWAY_URL: gatewayUrl,
        E2E_RESULTS_DIR: evidenceDir,
      },
    })
  } catch (error) {
    failure = error
  } finally {
    await stop(radar)
    await stop(mock)
    try {
      await removeWithRetry(tempDir)
    } catch (error) {
      cleanupError = error
    }
    if (failure || cleanupError) {
      await writeFile(path.join(evidenceDir, 'radar.log'), logs(radar), 'utf8')
      await writeFile(path.join(evidenceDir, 'mock-gateway.log'), logs(mock), 'utf8')
    }
    if (!failure && !cleanupError && process.env.E2E_KEEP_ARTIFACTS !== '1') {
      await removeWithRetry(evidenceDir)
    }
  }

  if (!failure && cleanupError) failure = cleanupError
  if (failure) {
    console.error(`Gateway Project E2E failed. Evidence retained in ${evidenceDir}`)
    throw failure
  }
  if (process.env.E2E_KEEP_ARTIFACTS === '1') console.log(`Gateway Project E2E artifacts: ${evidenceDir}`)
}

main().catch((error) => {
  console.error(`[gateway-e2e] ${error.message}`)
  process.exitCode = 1
})
