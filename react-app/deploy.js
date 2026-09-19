import * as ftp from "basic-ftp";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  const client = new ftp.Client();
  // client.ftp.verbose = true; // Uncomment to see detailed FTP logs in terminal

  const {
    FTP_HOST,
    FTP_USER,
    FTP_PASSWORD,
    FTP_PORT,
    FTP_TARGET_DIR
  } = process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    console.error("❌ FTP credentials not found in .env file. Deployment aborted.");
    console.error("Please add FTP_HOST, FTP_USER, FTP_PASSWORD to your .env file.");
    process.exit(1);
  }

  const targetDir = FTP_TARGET_DIR || "/public_html";
  const port = parseInt(FTP_PORT || "21", 10);

  console.log(`🚀 Connecting to FTP server: ${FTP_HOST}...`);

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      port: port,
      secure: true,
      secureOptions: { rejectUnauthorized: false }
    });

    console.log("✅ Connected successfully!");

    console.log(`📁 Navigating to target directory: ${targetDir}`);
    await client.ensureDir(targetDir);

    // Emptying the directory (Caution: removes everything inside)
    // Note: To be safe, we will just upload and overwrite. If you want to empty the directory first, uncomment the next line.
    // await client.clearWorkingDir();
    
    console.log(`📤 Uploading "dist" folder... This may take a moment.`);
    
    // Upload the entire dist directory
    const distPath = path.join(__dirname, "dist");
    await client.uploadFromDir(distPath);

    console.log("🎉 Deployment complete! Your PWA app is now live.");
  } catch (err) {
    console.error("❌ Deployment failed:", err);
  } finally {
    client.close();
  }
}

deploy();
