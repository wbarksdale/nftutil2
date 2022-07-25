import yargs, { Argv, ArgumentsCamelCase } from 'yargs'
import Bundlr from '@bundlr-network/client';
import * as fs from 'fs'

export type UploadFileCommandArgs = 
    { file_path: string } &
    { payer_keypath: string } &
    { cluster: string }

export const uploadFileCommand = {
    command: "upload",
    description: "upload a file to arweave using bundlr",
    builder: (args: Argv): Argv<UploadFileCommandArgs> => {
        return args.option("file_path", {
            description: "path to file to upload",
            type: "string",
            required: true,
        })
        .option("payer_keypath", {
            description: "path to payer keypaire file",
            type: "string",
            required: true,
        })
        .option("cluster", {
            description: "cluster to connect to",
            type: "string",
            choices: ["devnet", "mainnet-beta"],
            default: "devnet",
        })
    },
    handler: async (args: ArgumentsCamelCase<UploadFileCommandArgs>) => {
        console.log("upload with args: ", args)
        const payerKeypairJson = JSON.parse(fs.readFileSync(args.payer_keypath).toString());
        const bundlrEndpoint = args.cluster === "mainnet-beta" ? "http://node1.bundlr.network" : "https://devnet.bundlr.network"
        const providerUrl = args.cluster === "mainnet-beta" ? "https://api.mainnet-beta.solana.com/" : "https://api.devnet.solana.com"
        const bundlr = new Bundlr(bundlrEndpoint, "solana", payerKeypairJson, { providerUrl :  providerUrl});

        const balance = await bundlr.getLoadedBalance()
        const convertedBalance = bundlr.utils.unitConverter(balance)

        console.log("Using Solana Address: ", bundlr.address)
        console.log("Current Balance:", convertedBalance.toString(10))

        const fileData = fs.readFileSync(args.file_path)

        bundlr.getBalance
        const price = await bundlr.getPrice(fileData.byteLength);
        const convertedPrice = bundlr.utils.unitConverter(price)
        console.log("Price for file is: ", convertedPrice.toString(10))

        // Sends SOL to bundlr node
        const fundingResponse = await bundlr.fund(price)
        console.log("Funded: ", fundingResponse)

        const uploadResponse = await bundlr.uploader.uploadFile(args.file_path)

        if (uploadResponse.status === 200 && typeof uploadResponse["data"]["id"] === "string") {
            console.log(uploadResponse["data"])
            const arweaveId = uploadResponse["data"]["id"]
            const arweaveUrl = "https://arweave.net/" + arweaveId
            console.log("Success:", arweaveUrl)

            // Save the url in a file that is just the input file + .upload.{cluster}
            const uploadResultFile = args.file_path + ".upload." + args.cluster
            console.log("Saving upload result url to" + uploadResultFile)
            fs.writeFileSync(uploadResultFile, arweaveUrl)
        }
    }
}