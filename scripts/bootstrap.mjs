import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const virtualEnvironment = path.join(projectRoot, '.venv')
const virtualEnvironmentPython = isWindows
  ? path.join(virtualEnvironment, 'Scripts', 'python.exe')
  : path.join(virtualEnvironment, 'bin', 'python')

function run(command, args, label, cwd = projectRoot, shell = false) {
  console.log(`\n[setup] ${label}`)
  console.log(`       ${command} ${args.join(' ')}`)

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell,
  })

  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

function canRun(command, args) {
  const result = spawnSync(command, [...args, '--version'], {
    cwd: projectRoot,
    stdio: 'ignore',
    shell: false,
  })
  return !result.error && result.status === 0
}

function findPython() {
  const candidates = isWindows
    ? [
        { command: 'python', args: [] },
        { command: 'py', args: ['-3'] },
      ]
    : [
        { command: 'python', args: [] },
        { command: 'python3', args: [] },
      ]

  return candidates.find(({ command, args }) => canRun(command, args))
}

function createVirtualEnvironment() {
  const python = findPython()
  if (!python) {
    const commandHint = isWindows ? 'python 或 py -3' : 'python 或 python3'
    throw new Error(`找不到可用的 Python。请先安装 ${commandHint}。`)
  }

  run(
    python.command,
    [...python.args, '-m', 'venv', virtualEnvironment],
    `create Python virtual environment with ${python.command}`,
  )
}

function main() {
  console.log(`[setup] project root: ${projectRoot}`)

  const npmCli = process.env.npm_execpath
  const invokeNpm = (args, label) => npmCli
    ? run(process.execPath, [npmCli, ...args], label)
    : run(npmCommand, args, label, projectRoot, isWindows)

  invokeNpm(['ci'], 'install root Node.js dependencies')
  invokeNpm(
    ['--prefix', path.join(projectRoot, 'frontend'), 'ci'],
    'install frontend Node.js dependencies',
  )
  run(
    process.execPath,
    [path.join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js'), 'install', 'chromium'],
    'install Playwright Chromium for the Project E2E gate',
  )

  if (!existsSync(virtualEnvironmentPython)) {
    createVirtualEnvironment()
  } else {
    console.log(`\n[setup] reuse Python virtual environment: ${virtualEnvironment}`)
  }

  if (!canRun(virtualEnvironmentPython, ['-m', 'pip'])) {
    run(
      virtualEnvironmentPython,
      ['-m', 'ensurepip', '--upgrade'],
      'bootstrap pip in Python virtual environment',
    )
  }

  run(
    virtualEnvironmentPython,
    [
      '-m',
      'pip',
      'install',
      '-r',
      path.join(projectRoot, 'backend', 'requirements.txt'),
    ],
    `install Python dependencies with ${virtualEnvironmentPython}`,
  )

  console.log('\n[setup] initialization complete')
  console.log(`[setup] Python virtual environment: ${virtualEnvironment}`)
  console.log('[setup] no .env file or database was created')
}

try {
  main()
} catch (error) {
  console.error(`\n[setup] ERROR: ${error.message}`)
  console.error('[setup] Check the failed command, install the missing prerequisite, and run npm run setup again.')
  process.exitCode = 1
}
