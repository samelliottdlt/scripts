import fs from 'fs'
import os from 'os'
import path from 'path'

export function updateShell (): void {
  // Define path to the binary
  const binaryPath = path.dirname(process.execPath)
  const binaryAbsolutePath = path.resolve(binaryPath, 'out-macos')

  // Define the new alias and path
  const aliasCmd = `alias s="${binaryAbsolutePath}"`
  const pathCmd = `export PATH="$PATH:${binaryAbsolutePath}"`

  // Comment to identify our commands
  const comment = '# Command added for binary shortcut - https://github.com/samelliottdlt/scripts'

  // Define the shell configuration file path based on the user's shell
  const shell = os.userInfo().shell
  const rcFilePath = shell.includes('zsh') ? path.join(os.homedir(), '.zshrc') : path.join(os.homedir(), '.bashrc')

  // Read the existing file
  const fileContents = fs.readFileSync(rcFilePath, 'utf-8').split('\n')

  // Check if the comment exists already
  const commentIndex = fileContents.findIndex(line => line === comment)

  if (commentIndex !== -1) {
    // Comment found, update the lines if they are different
    if (fileContents[commentIndex + 1] !== pathCmd) {
      fileContents[commentIndex + 1] = pathCmd
    }
    if (fileContents[commentIndex + 2] !== aliasCmd) {
      fileContents[commentIndex + 2] = aliasCmd
    }
  } else {
    // Comment not found, append the lines
    fileContents.push(comment, pathCmd, aliasCmd)
  }

  // Write the updated contents back to the file
  fs.writeFileSync(rcFilePath, fileContents.join('\n'))

  console.log('Shell configuration updated successfully. You might need to restart your terminal for the changes to take effect.')
}
