import fs from 'fs';
import path from 'path';
import { buildMikroOrmConfig } from './src/infrastructure/mikro-orm/config/mikro-orm.config';

// 외부 dotenv 패키지 없이 .env 파일을 직접 파싱하여 process.env에 주입
function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.resolve(__dirname, '.env'));

export default buildMikroOrmConfig({
  get: (key: string) => process.env[key],
});
