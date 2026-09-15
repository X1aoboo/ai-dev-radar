import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const virtualEnvironmentPython = process.platform === 'win32'
  ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(projectRoot, '.venv', 'bin', 'python')

function parseOptions(argv) {
  const env = { ...process.env }
  let cwd = projectRoot
  let index = 0

  while (index < argv.length) {
    if (argv[index] === '--cwd') {
      const relativeCwd = argv[index + 1]
      if (!relativeCwd) throw new Error('--cwd requires a directory')
      cwd = path.resolve(projectRoot, relativeCwd)
      index += 2
      continue
    }

    if (argv[index] === '--env') {
      const assignment = argv[index + 1]
      const separator = assignment?.indexOf('=') ?? -1
      if (separator <= 0) throw new Error('--env requires KEY=VALUE')
      const key = assignment.slice(0, separator)
      env[key] = assignment.slice(separator + 1)
      index += 2
      continue
    }

    break
  }

  return { cwd, env, pythonArgs: argv.slice(index) }
}

function main() {
  const { cwd, env, pythonArgs } = parseOptions(process.argv.slice(2))
  if (pythonArgs.length === 0) throw new Error('missing Python arguments')
  if (!existsSync(virtualEnvironmentPython)) {
    throw new Error(`找不到项目虚拟环境 Python：${virtualEnvironmentPython}。请先执行 npm run setup。`)
  }

  const result = spawnSync(virtualEnvironmentPython, pythonArgs, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

try {
  main()
} catch (error) {
  console.error(`[python-runner] ERROR: ${error.message}`)
  process.exitCode = 1
}
