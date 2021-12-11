# Getting Started with Omnibot

Welcome to Omnibot!

This guide will get you up and running as fast as possible.

## Prerequisites

Here's what you'll need.

- A Discord Bot Token ([this guide](https://www.writebots.com/discord-bot-token/) walks you through creating one). Add the bot to a server.
- Node.js v16 or higher installed on your computer (Heroku isn't supported just yet)
  If you don't have it, install it from [nodejs.org](https://nodejs.org).

## Downloading and configuring Omnibot

Create an empty folder for Omnibot. Make sure you can read and write all files in that folder.

Head [here](https://github.com/iamtheyammer/omnibot/releases/latest) and download the
`omnibot.bundle.js` file. Save it in the folder you just created.

### Configuring Omnibot

1. In the folder with the downloaded file, create a file called `omnibotconfig.json`.
2. Paste in [the contents of this file](examples/omnibotconfig.json).
3. Add your Discord token.
4. If you know what modules you want to install, feel free to edit the modules section. If not, that's OK-- the example file will load an example module that should help you get started.

## Start it up

1. Open a terminal on macOS or Linux or a command prompt (win+r, cmd) on Windows
2. Type `cd`, a space, then click and drag the folder with the configuration file into the terminal window. Hit enter.
3. Run `node omnibot.bundle.js`
4. All set! Your bot should be running. If you're running the example config, you'll see a line print out every time a message is received by the bot.

## Further configuration and next steps

- Check out the [modules guide](/modules) for info about loading and writing modules.
- [Open an issue](https://github.com/iamtheyammer/omnibot/issues) if you have a question, need something, or have a suggestion.
