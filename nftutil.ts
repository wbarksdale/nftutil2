import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { createCommand } from './cli/createnft'
import { getCommand } from './cli/getnft'
import { updateCommand } from './cli/updatenfts'
import { uploadFileCommand } from './cli/uploadfile'

yargs
    .command(getCommand)
    .command(updateCommand)
    .command(createCommand)
    .command(uploadFileCommand)

yargs.demandCommand()
yargs.argv