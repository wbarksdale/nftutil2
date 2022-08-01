import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { createCommand } from './cli/createnft'
import { getCommand } from './cli/getnft'
import { updateCommand } from './cli/updatenfts'
import { uploadFileCommand } from './cli/uploadfile'
import { createCandyMachineCommand } from './cli/createCandyMachine'
import { gqlUpdateNft } from './cli/gqlUpdateNfts'

yargs
    .command(getCommand)
    .command(updateCommand)
    .command(createCommand)
    .command(uploadFileCommand)
    .command(createCandyMachineCommand)
    .command(gqlUpdateNft)

yargs.demandCommand()
yargs.argv