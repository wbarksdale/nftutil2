import { Keypair } from "@solana/web3.js"
import * as fs from 'fs'
import path from 'path'

const GEN_DIR = path.resolve(".", "gen")

export const loadKeyFromPath = (keyPath: string): Keypair => {
    const data = fs.readFileSync(keyPath, 'utf8');
    const dataJson = JSON.parse(data);
    return Keypair.fromSecretKey(Uint8Array.from(dataJson));
}