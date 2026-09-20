import * as ftp from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function deploy() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    
    const targetDir = process.env.FTP_TARGET_DIR || 'hackieeofficial.store';

    try {
        console.log("Connecting to FTP...");
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });
        
        console.log("Connected! Checking remote directory...");
        
        // The admin FTP account lands in /public_html
        // We want to upload to /public_html/hackieeofficial.store
        await client.ensureDir(targetDir.replace(/^\//, '')); // Remove leading slash if any
        console.log(`Navigated to ${targetDir}...`);
        
        console.log("Uploading files from dist...");
        await client.uploadFromDir(path.join(process.cwd(), 'dist'));
        
        console.log("Deployment completed successfully!");
    }
    catch(err) {
        console.error("Deployment failed:", err);
    }
    finally {
        client.close();
    }
}

deploy();
