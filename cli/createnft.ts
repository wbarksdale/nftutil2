
import yargs, { Argv, ArgumentsCamelCase } from 'yargs'
import { Connection, clusterApiUrl, Keypair, Cluster, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Metaplex, bundlrStorage, keypairIdentity, BundlrStorageDriver, toMetaplexFile } from "@metaplex-foundation/js";
import * as fs from 'fs'
import path from 'path'
import { loadKeyFromPath } from './utils';

export type CreateCommandArgs =
    { payer_keypair_path: string } &
    { image_path: string } &
    { json_path: string } &
    { cluster: string }
    

export const createCommand = {
    command: "create",
    description: "create an nft",
    builder: (args: Argv): Argv<CreateCommandArgs> => {
        return args.option("payer_keypair_path", {
            description: "path to keypair to be used as payer",
            type: "string",
            required: true,
        })
        .option("image_path", {
            description: "path to an image for the nft",
            type: "string",
            required: true,
        })
        .option("json_path", {
            description: "path to json file for the nft",
            type: "string",
            required: true,
        })
        .option("cluster", {
            description: "cluster to generate NFTs on",
            type: "string", 
            default: "devnet",
            choices: ["devnet", "mainnet-beta"]
        })
    },
    handler: async (args: ArgumentsCamelCase<CreateCommandArgs>) => {
        console.log("create with args: ", args)

        const payerKeypair = loadKeyFromPath(args.payer_keypair_path)

        console.log("using payer: ", payerKeypair.publicKey.toBase58())

        
        // const nftMetadataJson = JSON.parse(nftMetadataData);

        const connection = new Connection(clusterApiUrl(args.cluster as Cluster))

        // Airdrop to payer

        let balance = await connection.getBalance(payerKeypair.publicKey)
        console.log("Payer keypair balance: ", balance);
        const minBalance = 2 * LAMPORTS_PER_SOL
        if (balance < minBalance) {
            while (balance < minBalance) {
                console.log("Requesting Airdrop")
                const result = await connection.requestAirdrop(payerKeypair.publicKey, LAMPORTS_PER_SOL)
                console.log("Airdrop Result: ", result)

                // wait on tx to finalize, seems to avoid too may airdrop requests issue
                // but not robust and uses deprecated method
                await connection.confirmTransaction(result, "finalized")
                balance = await connection.getBalance(payerKeypair.publicKey, "finalized")
                console.log("Payer keypair balance: ", balance);
            }
        }

        // Setup bundlr

        const metaplex = new Metaplex(connection)
        metaplex.use(keypairIdentity(payerKeypair))
        metaplex.use(bundlrStorage({
            address: 'https://devnet.bundlr.network', // don't pass in address for mainnet
            providerUrl: 'https://api.devnet.solana.com', // this defaults to metaplex connection url
            timeout: 60000,
        }));

        const myBundlrStorage = metaplex.storage().driver() as BundlrStorageDriver;

        const nftImageData = fs.readFileSync(args.image_path)
        const nftMetadataData = fs.readFileSync(args.json_path);
        
        const nftImageMetaplexFile = toMetaplexFile(nftImageData, "my-nft-image.jpeg")
        const nftMetadataMetaplexFile = toMetaplexFile(nftMetadataData, "my-nft-metadata.json")

        const uploadPrice = await myBundlrStorage.getUploadPrice(nftImageData.byteLength + nftMetadataData.byteLength)
        myBundlrStorage.fund(uploadPrice)

        const [nftImageUri, nftMetadataUri] = await myBundlrStorage.uploadAll([nftImageMetaplexFile, nftMetadataMetaplexFile])

        console.log("Upload Results:")
        console.log("nftImageUri:", nftImageUri)
        console.log("nftMetadataUri:", nftMetadataUri)

        const { nft } = await metaplex.nfts()
            .create({
                uri: nftMetadataUri,
                name: "My Nft",
                sellerFeeBasisPoints: 500,
            })
            .run()

        console.log("created NFT")
        console.log("nft mint address:", nft.mint.address.toBase58())
        console.log("nft metadata addresss: ", nft.metadataAddress.toBase58())
        console.log(nft)

        // const { nft } = await metaplex.nfts()
        //     .create({
        //         uri: "https://arweave.net/123",
        //         name: "My NFT",
        //         sellerFeeBasisPoints: 500; // Represents 5.00%.
        //     })
        //     .run();
        
    },
}