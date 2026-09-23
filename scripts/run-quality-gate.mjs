import { spawn } from 'node:child_process'

const steps = [
  ['Backend tests', ['test']],
  ['Frontend unit and rendering tests', ['--prefix', 'frontend', 'run', 'test:unit']],
  ['Frontend production build', ['--prefix', 'frontend', 'run', 'build']],
  ['Gateway Project E2E', ['run', 'test:e2e:gateway']],
  ['Design documentation check', ['run', 'check:docs']],
  ['Design documentation tests', ['run', 'test:docs']],
]

function runNpm(args, env) {
  const npmCli = process.env.npm_execpath
  if (!npmCli) throw new Error('Run this gate through npm so npm can resolve its own CLI.')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, ...args], {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
      shell: false,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`exit ${code ?? signal ?? 'unknown'}`))
    })
  })
}

for (const [label, args] of steps) {
  console.log(`\n[gate] ${label}`)
  try {
    const env = label === 'Gateway Project E2E'
      ? { ...process.env, E2E_FRONTEND_BUILT: '1' }
      : process.env
    await runNpm(args, env)
  } catch (error) {
    console.error(`[gate] FAILED: ${label} (${error.message})`)
    process.exitCode = 1
    break
  }
}
