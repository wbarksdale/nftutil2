
import yargs, { Argv, ArgumentsCamelCase, choices } from 'yargs'
import { Connection, clusterApiUrl, Keypair, Cluster, PublicKey } from "@solana/web3.js"
import { Metaplex, bundlrStorage, mockStorage, parseMetadataAccount, LazyMetadata, toLazyMetadata, Nft } from "@metaplex-foundation/js";
import * as fs from 'fs'
import path from 'path'
import { loadKeyFromPath } from './utils';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';

export type GetCommandArgs =
    { metadata_addr?: string } &
    { mint_addr?: string } &
    { cluster: string }

export const getCommand = {
    command: "get",
    description: "Fetch nft data using either the metadata address or the mint address",
    builder: (args: Argv): Argv<GetCommandArgs> => {
        return args.option("metadata_addr", {
            description: "address of token metadata to get",
            type: "string",
        })
        .option("mint_addr", {
            description: "address of token mint to get",
            type: "string",
        })
        .option("cluster", {
            description: "cluster to generate NFTs on",
            type: "string", 
            default: "devnet",
            choices: ["devnet", "mainnet-beta"]
        })
    },
    handler: async (args: ArgumentsCamelCase<GetCommandArgs>) => {
        console.log("get called with args:", args)
        // 9qPJqRVCBfbBFmHq21C5EjT8zvDgbamCxpXUJbc18zZw

        if (!args.metadata_addr && !args.mint_addr) {
            console.error("Must specify either metadata_addr or mint_addr")
            return;
        }

        if (!!args.metadata_addr && !!args.mint_addr) {
            console.warn("Specified both metadata address and mint address, using mint address")
        }

        const connection = new Connection(clusterApiUrl(args.cluster as Cluster))
        const metaplex = new Metaplex(connection)

        let mintAddress: PublicKey  
        if (!args.mint_addr) {
            const metadataAddrPubkey = new PublicKey(args.metadata_addr as string)
            // Load metadata account so we can get a mint address
            const accounts = await metaplex.rpc().getMultipleAccounts([metadataAddrPubkey])

            if (!accounts[0].exists) {
                console.log("failed to load metadata from key", metadataAddrPubkey.toBase58())
                return;
            }

            const metadataAccount = parseMetadataAccount(accounts[0])
            console.log("resolved mint address: ", metadataAccount.data.mint.toBase58())
            mintAddress = metadataAccount.data.mint
        } else {
            mintAddress = new PublicKey(args.mint_addr)
        }

        // load nft using mint address
        const nft = await metaplex.nfts().findByMint(mintAddress).run()
        console.log("Metadata Address:", nft.metadataAddress.toBase58())
        console.log("Mint Address:", nft.mintAddress.toBase58())
        console.log(nft)
        
        // dump nft to a file
        
    },
}