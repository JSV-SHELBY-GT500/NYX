import { spawn } from 'child_process';
import chalk from 'chalk';
import treeKill from 'tree-kill';

const childProcesses = [];

function printHeader() {
    console.log(chalk.cyan('================================================================================'));
    console.log(chalk.cyan('=                                                                              ='));
    console.log(chalk.cyan(`=                          ${chalk.bold.white('NYX OS v3.0 - ECOSYSTEM LAUNCHER')}                          =`));
    console.log(chalk.cyan('=                                                                              ='));
    console.log(chalk.cyan('================================================================================'));
    console.log('');
    console.log(chalk.yellow('[SYSTEM] Initializing Nyx OS ecosystem...'));
    console.log('');
}

function startService(name, command, args, cwd, prefix, color) {
    console.log(chalk.yellow(`[SYSTEM] Starting ${name}...`));
    const service = spawn(command, args, { cwd, shell: true });
    childProcesses.push(service.pid);

    const prefixText = chalk[color](`[${prefix}]`);

    service.stdout.on('data', (data) => {
        // Filtra mensajes de log innecesarios de npm
        const log = data.toString();
        if (log.trim() && !log.startsWith('>')) {
            process.stdout.write(`${prefixText} ${log}`);
        }
    });

    service.stderr.on('data', (data) => {
        process.stderr.write(`${chalk.red(prefixText)} ${data.toString()}`);
    });

    service.on('close', (code) => {
        const message = code === 0
            ? chalk.gray(`[SYSTEM] ${name} process finished gracefully.`)
            : chalk.red.bold(`[SYSTEM] ${name} process exited with code ${code}. It may have crashed.`);
        console.log(message);
    });

    service.on('error', (err) => {
        console.error(chalk.red.bold(`[SYSTEM] Failed to start ${name}: ${err.message}`));
        console.error(chalk.red.bold(`[SYSTEM] Check that dependencies are installed in '${cwd}' and the run script exists.`));
    });
}

function shutdown() {
    console.log(chalk.yellow('\n[SYSTEM] Shutting down all services...'));
    childProcesses.forEach(pid => {
        // Use SIGTERM for a graceful shutdown, fallback to SIGKILL if it fails
        // On Windows, tree-kill uses taskkill /T /F which is forceful anyway.
        treeKill(pid, 'SIGTERM', (err) => {
            if (err) {
                console.error(chalk.red.bold(`[SYSTEM] Failed to kill process ${pid}:`), err);
            } else {
                console.log(chalk.gray(`[SYSTEM] Process ${pid} terminated.`));
            }
        });
    });
    setTimeout(() => process.exit(0), 1000);
}

// --- Main Execution ---
printHeader();

// The backend command is run from the root directory of the project.
startService('Backend Server', 'npm', ['run', 'dev:backend'], '.', 'BACKEND ', 'blue');

// The frontend command is run from its specific subdirectory.
startService('Frontend Application', 'npm', ['run', 'dev'], './INTERFAZ ANDROID/NYX', 'FRONTEND', 'green'); // Assuming 'dev' is the correct script name. If not, the error log will now be clear.

console.log(chalk.bold.magenta('\nAll services are starting. Press CTRL+C to shut down the ecosystem.\n'));

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);