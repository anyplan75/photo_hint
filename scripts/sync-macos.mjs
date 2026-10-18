import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'macos/App/App/public');
rmSync(dest, { recursive: true, force: true });
cpSync(join(root, 'dist'), dest, { recursive: true });
console.log('맥 앱 화면에 웹 빌드를 넣었습니다.');
