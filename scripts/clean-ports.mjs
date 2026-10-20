import { execSync } from 'child_process';
import process from 'process';

const PORTS = [5173, 5174, 3001];

console.log('[clean-ports] Verificando portas:', PORTS.join(', '));

for (const port of PORTS) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
      for (const pid of pids) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        console.log(`[clean-ports] Finalizado PID ${pid} na porta ${port}.`);
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const pids = output.trim().split('\n').filter(Boolean);
      for (const pid of pids) {
        if (Number(pid) !== process.pid) {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`[clean-ports] Finalizado PID ${pid} na porta ${port}.`);
        }
      }
    }
  } catch {
    // Porta já livre
  }
}

console.log('[clean-ports] Limpeza concluída.');
