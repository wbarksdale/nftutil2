
import yargs, { Argv, ArgumentsCamelCase, env } from 'yargs'
import { Connection, clusterApiUrl, Keypair, Cluster, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Metaplex, bundlrStorage, keypairIdentity, BundlrStorageDriver, toMetaplexFile } from "@metaplex-foundation/js";
import * as fs from 'fs'
import path from 'path'
import { airdropAmount, loadKeyFromPath } from './utils';
import { GraphQLClient, gql } from 'graphql-request';
import base58 from 'bs58';

export type GqlUpdateNftArgs =
    { payer: string } &
    { update_authority: string } &
    { mint_id: string} &
    { new_uri?: string } &
    { new_metadata?: string } &
    { cluster: string }
    

export const gqlUpdateNft = {
    command: "gqlUpdateNft",
    description: "update an nft using the graphql API",
    builder: (args: Argv): Argv<GqlUpdateNftArgs> => {
        return args.option("payer", {
            description: "path to keypair to be used as payer",
            type: "string",
            required: true,
        })
        .option("update_authority", {
            description: "path to update authority keypair",
            type: "string",
            required: true,
        })
        .option("mint_id", {
            description: "public key of mint id (base58 encoded string)",
            type: "string",
            required: true,
        })
        .option("new_uri", {
            description: "new uri to update nft",
            type: "string",
        })
        .option("new_metadata", {
            description: "path to metadata file to upload",
            type: 'string',
        })
        .option("cluster", {
            description: "cluster to generate NFTs on",
            type: "string",
            default: "devnet",
            choices: ["devnet", "mainnet-beta"]
        })
    },
    handler: async (args: ArgumentsCamelCase<GqlUpdateNftArgs>) => {
        console.log("create with args: ", args)

        const payerKeypair = loadKeyFromPath(args.payer)
        const payerSecret = base58.encode(payerKeypair.secretKey)
        const updateAuthority = loadKeyFromPath(args.update_authority)
        const updateAuthoritySecret = base58.encode(updateAuthority.secretKey)

        let metadataJSON = null;
        if (!!args.new_metadata) {
            let raw = fs.readFileSync(args.new_metadata, { encoding: 'utf-8' });
            metadataJSON = JSON.parse(raw);
        }

        if (args.cluster === "devnet") {
            const connection = new Connection(clusterApiUrl(args.cluster))
            await airdropAmount(5 * LAMPORTS_PER_SOL, 2 * LAMPORTS_PER_SOL, payerKeypair.publicKey, connection)
        }

        const graphQLClient = new GraphQLClient(
            'http://localhost:4000/graphql',
        );

        const result = await graphQLClient.request(
          gql`
            mutation updateNft(
              $payer: String!
              $updateAuthority: String!
              $nftMintId: String!
              $newUri: String,
              $newMetadataJson: NftMetadata,
              $cluster: String!
            ) {
                updateNft(
                    payer: $payer
                    updateAuthority: $updateAuthority
                    nftMintId: $nftMintId
                    newUri: $newUri
                    newMetadataJson: $newMetadataJson
                    cluster: $cluster
              ) {
                success,
                message,
                processId, 
                newUri
              }
            }
          `,
          {
            payer: payerSecret,
            updateAuthority: updateAuthoritySecret,
            nftMintId: args.mint_id,
            newUri: args.new_uri,
            newMetadataJson: metadataJSON,
            cluster: args.cluster,
          },
        );
          
        console.log(result);
    },
}