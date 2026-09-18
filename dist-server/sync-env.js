import fs from 'fs';
import path from 'path';
const root = process.cwd();
const envPath = path.join(root, '.env');
const envLocalPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
    console.log("Syncing .env -> .env.local...");
    fs.copyFileSync(envPath, envLocalPath);
    console.log("✅ Done! Both files are now identical.");
}
else {
    console.error("❌ .env file not found!");
}
