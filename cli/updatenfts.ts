import { keypairIdentity, Metaplex } from '@metaplex-foundation/js'
import { Cluster, clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'
import yargs, { Argv, ArgumentsCamelCase, scriptName } from 'yargs'
import { loadKeyFromPath } from './utils'
import * as fs from 'fs'
import path from 'path'

export type UpdateCommandArgs = 
    { payer: string} &
    { update_authority: string } &
    { data_dir: string } &
    { cluster: string}

export const updateCommand = {
    command: "update",
    description: "update all nfts in a directory, makes a bunch of assumptions about the layout of the directory based on outputs of 'validate_nfts.py' and 'uploadfile.ts'",
    builder: (args: Argv): Argv<UpdateCommandArgs> => {
        return args
        .option("payer", {
            description: "path to keypair json for the payer of the transaction",
            type: "string",
            required: true,
        })
        .option("update_authority", {
            description: "path to keypair json for the update authority of the NFTs",
            type: "string",
            required: true,
        })
        .option("data_dir", {
            description: "path to a directory containing data for one candy machine output by validate_nfts.py",
            type: "string",
            required: true,
        })
        .option("cluster", {
            description: "cluster to generate NFTs on",
            type: "string", 
            default: "devnet"
        })
    },
    handler: async (args: ArgumentsCamelCase<UpdateCommandArgs>) => {
        console.log("Update Called with args: ", args)

        console.log("Scanning: ", args.data_dir)
        const files = fs.readdirSync(args.data_dir)
        let mintIds = files.flatMap((filename) => {
            try {
                const mintId = new PublicKey(filename) // throws if filename is not a valid pubkey
                const filePath = path.resolve(args.data_dir, filename)
                const fileInfo = fs.readFileSync(filePath).toString()
                if (fileInfo === "invalid") {
                    return [mintId]
                } else {
                    return []
                }
            } catch {
                return []
            }
        })

        console.log("Found", mintIds.length, "invalid mint ids")

        if (!files.includes('metadata.json')) {
            console.log("Missing metadata.json")
            return
        }

        if (!files.includes('metadata.json.upload.' + args.cluster)) {
            console.log("Missing metadata.json upload")
            return
        }

        const uploadResultFile = path.resolve(args.data_dir, "metadata.json.upload." + args.cluster)
        const uploadUrl = fs.readFileSync(uploadResultFile, 'utf-8')

        // Should I check if I can download the url?
        // rudimentary check that url is valid
        if (!uploadUrl.includes("arweave")) {
            console.log("Upload url seems bad: ", uploadUrl)
            return
        }

        const updateAuthorityKeypath = loadKeyFromPath(args.update_authority)
        const payerKeypath = loadKeyFromPath(args.payer)

        const connection = new Connection(clusterApiUrl(args.cluster as Cluster))
        const metaplex = new Metaplex(connection)
        metaplex.use(keypairIdentity(payerKeypath))

        for (let mintId of mintIds) {
            const nft = await metaplex.nfts().findByMint(mintId).run()
            
            if (nft.uri === uploadUrl) {
                console.log("NFT was already updated", mintId.toBase58())
                continue
            }

            console.log("Updating NFT: ", mintId.toBase58())

            const {nft: updatedNft } = await metaplex.nfts().update(nft, {
                "uri": uploadUrl,
                "updateAuthority": updateAuthorityKeypath,
            }).run()

            if (updatedNft.uri === args.new_json_uri) {
                console.log("Success: ", mintId.toBase58())
            } else {
                console.log("Failed to update NFT: ", mintId.toBase58())
                console.log(updatedNft)
            }
        }
    },
}
