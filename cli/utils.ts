import { Keypair, PublicKey, Connection, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js"
import * as fs from 'fs'
import path from 'path'

const GEN_DIR = path.resolve(".", "gen")

export const loadKeyFromPath = (keyPath: string): Keypair => {
    const data = fs.readFileSync(keyPath, 'utf8');
    const dataJson = JSON.parse(data);
    return Keypair.fromSecretKey(Uint8Array.from(dataJson));
}


// Airdrop funds to `pubkey`, if current balance is less than minAmount
// this will top up the account to the target amount
export const airdropAmount = async (
    targetAmount: number,
    minAmount: number,
    pubkey: PublicKey,
    connection?: Connection) => {

    if (!connection) {
        connection = new Connection(clusterApiUrl("devnet"))
    }
    
    let balance = await connection.getBalance(pubkey)

    if (balance < minAmount) {
        let fundingNeeded = targetAmount - balance
        while (fundingNeeded > 0) {
            fundingNeeded = fundingNeeded - LAMPORTS_PER_SOL
            const result = await connection.requestAirdrop(pubkey, LAMPORTS_PER_SOL)
            console.log("Airdrop result: " + result)
            // wait on tx to finalize, seems to avoid too may airdrop requests issue
            // but not robust and uses deprecated method
            await connection.confirmTransaction(result, "finalized")
        }
    }
}