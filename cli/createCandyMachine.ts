
import yargs, { Argv, ArgumentsCamelCase, env } from 'yargs'
import { Connection, clusterApiUrl, Keypair, Cluster, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Metaplex, bundlrStorage, keypairIdentity, BundlrStorageDriver, toMetaplexFile } from "@metaplex-foundation/js";
import * as fs from 'fs'
import path from 'path'
import { airdropAmount, loadKeyFromPath } from './utils';
import { GraphQLClient, gql } from 'graphql-request';
import base58 from 'bs58';

export type CreateCandyMachineCommandArgs =
    { payer: string } &
    { cmdir: string } &
    { cluster: string }
    

export const createCandyMachineCommand = {
    command: "createcm",
    description: "create a candy machine",
    builder: (args: Argv): Argv<CreateCandyMachineCommandArgs> => {
        return args.option("payer", {
            description: "path to keypair to be used as payer",
            type: "string",
            required: true,
        })
        .option("cmdir", {
            description: "path to an image for the nft",
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
    handler: async (args: ArgumentsCamelCase<CreateCandyMachineCommandArgs>) => {
        console.log("create with args: ", args)

        const payerKeypair = loadKeyFromPath(args.payer)
        const payerSecret = base58.encode(payerKeypair.secretKey)
        console.log("using payer: ", payerKeypair.publicKey.toBase58())
        const rpcUrl = clusterApiUrl(args.cluster as Cluster)
        const connection = new Connection(rpcUrl)

        await airdropAmount(5 * LAMPORTS_PER_SOL, 2 * LAMPORTS_PER_SOL, payerKeypair.publicKey, connection)

        const configJSON: any = {
            "price": 0.01,
            "number": 10,
            "gatekeeper": null,
            "solTreasuryAccount": "FTRY1THFYyV8tBV39aiRkdx8xNYvLiEr4xB8k4R8u4op",
            "splTokenAccount": null,
            "splToken": null,
            "goLiveDate": 1654999999,
            "endSettings": null,
            "whitelistMintSettings": null,
            "hiddenSettings": null,
            "storage": "arweave",
            "ipfsInfuraProjectId": null,
            "ipfsInfuraSecret": null,
            "awsS3Bucket": null,
            "nftStorageKey": null,
            "noRetainAuthority": false,
            "noMutable": false
        }

        const graphQLClient = new GraphQLClient(
            'http://localhost:4000/graphql',
        );

        const zipFileUrl = 'https://github.com/kevinrodriguez-io/stash/raw/master/assets.zip';
        const callbackUrl = 'https://derp.com'
        const collectionMint = 'J9JByPaQD6JNBHm25uNCtw6XjqnbgnfMYU7Tw6b7ts7t'
        const setCollectionMint = true

        const result = await graphQLClient.request(
          gql`
            mutation candyMachineUpload(
              $keyPair: String!
              $callbackUrl: String!
              $config: JSON!
              $collectionMint: String!
              $setCollectionMint: Boolean!
              $filesZipUrl: String!
              $guid: String
              $rpc: String!
              $env: String!
            ) {
              candyMachineUpload(
                keyPair: $keyPair
                callbackUrl: $callbackUrl
                config: $config
                collectionMint: $collectionMint
                setCollectionMint: $setCollectionMint
                filesZipUrl: $filesZipUrl
                guid: $guid
                rpc: $rpc
                env: $env
              ) {
                processId
              }
            }
          `,
          {
            keyPair: payerSecret,
            callbackUrl: callbackUrl,
            config: configJSON,
            collectionMint: collectionMint,
            setCollectionMint: setCollectionMint,
            filesZipUrl: zipFileUrl,
            guid: "--",
            env: args.cluster,
            rpc: rpcUrl,
          },
        );
          
        console.log(result);
    },
}