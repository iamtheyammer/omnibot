# Modules

Modules are at the core of Omnibot. They give Omnibot functionality!
Modules can act as discord "bots", or they can just assist other modules.

Modules are written in JavaScript, and can be local or fetched from the web.

- If you want to load a module you (or someone else) wrote, check out [Loading Modules](#loading-modules).
- If you're a developer and want to write a module, check out [Writing Modules](#writing-modules).

## Loading Modules

Modules can be stored locally or on a remote server.

To load a module, you'll add an object to the `modules` array in your config file.
It looks like the following:

```json
{
  "id": "tic-tac-toe-bot",
  "source": {
    "source": "local",
    "local_path": "relative path to module, like ./modules/tic-tac-toe.js"
  },
  "dependencies": [
    "omnibot:core"
  ]
}
```

#### Module ID

The ID is a **unique** identifier for the module. While they can technically have any character,
we recommend using lowercase characters separated by dashes, like the following examples:

- tic-tac-toe-bot
- moderator-bot
- corl-bot

#### Module Source

A module can be either local or remote. A local module means that the code for the module
is stored on the computer running Omnibot. A remote module means that the code is on a server.

The source object in the config for a **local** module looks like this:

```json
{
  // ...
  "source": {
    "source": "local",
    "local_path": "./modules/my-module.js"
  }
}
```

The source is local, and the path is a relative path (from the Omnibot JavaScript file) to the module's code.

For a **remote** module, it looks like this:

```json
{
  // ...
  "source": {
    "source": "remote",
    "url": "https://example.com/module.json"
  }
}
```

The source is remote, and `url` points to a remote _module configuration file_.
We'll explain this more in [Loading Remote Modules](#loading-remote-modules).

#### Module Dependencies

To learn more about dependencies, head over [here](/dependencies.md).

### Loading Local Modules

To load a local module, add the following to the modules array in your config file:

```json
{
  "id": "must be unique, separate by dashes, like tic-tac-toe-bot",
  "source": {
    "source": "local",
    "local_path": "relative path to module, like ./modules/tic-tac-toe.js"
  },
  "dependencies": [
    "omnibot:core"
  ]
}
```

Make sure that the local path is either absolute (starts with `/` instead of `./`) or relative
to the Omnibot JavaScript file.

### Loading Remote Modules

Loading remote modules is super easy.

However, modules from sources you don't trust can allow attackers
to read any file from your computer, steal your bot's discord token, and more.
Make sure you trust the author of the module.

**If you're unsure about a module, don't use it.**

Now that the warning is out of the way, let's get to it.

**A note on dependencies:**

Module authors can specify dependencies to make your job easier.
But, since you're running the bot, we put you in charge.
If you specify a dependencies array, it will be used. No matter what.
If you want to go along with the module author's recommendation, just leave the
dependencies array out.

Try adding the following to the modules array in your config file (make sure to change the id and url!):

```json
{
  "id": "example-remote-module",
  "source": {
    "source": "remote",
    "url": "https://omnibot.iamtheyammer.com/examples/remote_modules/example_module_config.json"
  }
}
```

Note: the module above will use the author's recommended dependencies.
To see those, just visit the config url and look for dependencies.
If you specify a dependencies array, it will **always** be used, no matter
what the module author specifies.

If you'd like to try an example remote module that just prints every message, 
add the following to your modules array:

```json
{
  "id": "example-module",
  "source": {
    "source": "remote",
    "url": "https://omnibot.iamtheyammer.com/examples/remote_modules/example_module_config.json"
  }
}
```

## Writing Modules

Ok, so you're a big brain developer. And you want to write a module.
Don't worry. We got you.

Writing modules is easy. First, you'll export an `init` function with
one parameter: `omnibot`. The `omnibot` parameter is super useful, so we
recommend you make it a global. Check out our boilerplate module below:

```js
let omnibot;

module.exports.init = function (initOmnibot) {
  omnibot = initOmnibot;

  // you can use any event from discord.js!
  omnibot.on("discord:message", (msg) => {
    // please use the omnibot logger!
    // it shows which module is logging.
    // the following levels are available (omnibot.logger.<level>):
    // debug, info (AKA log), warn, error, fatal
    omnibot.logger.info(
      `${msg.user} said "${msg.content}"!`
    );
  });
  
  omnibot.on("omnibot:beforeunload", () => {
    // This function will be called before the module is unloaded.
    // While you do NOT need to remove any omnibot.on event listeners (we do it for you),
    // please stop any other pending tasks. The default unload timeout is 30 seconds before
    // the module is forcefully terminated.
    omnibot.logger.info("Goodbye world, for I am being unloaded!")
  })
};
```

(note that the above module requires the `omnibot:core` dependency as it uses a Discord event listener.)

A full Omnibot SDK doc is coming soon.

### Using NPM Dependencies

Just call them like you would in any other project:

```js
const axios = require("axios");
```

Just make sure that each package is in your dependencies. The above code requires `npm:axios`, for example.

### Using Intermodule Dependencies

If your module requires another (by adding `omnibot:module:<module id>` to its dependency list),
you'll be able to access exports from other modules!

Call them like this (where `util-module` is the module we are requesting):

```js
const util = omnibot.modules["util-module"];

// you can also do this!
omnibot.modules["util-module"].someFunction();
```

For remote module authors, you might notice that we need the ID of the module, not the name.
This requires the person running the bot needs to match up the ids. We recommend that you
recommend IDs for your remote modules.

### Exporting for other modules

How kind of you to help other modules out.

Before your module is imported by any other module, your `init` function will
be called.

The best way to explain how to export is to just show you:

```js
let omnibot;

// this line is REQUIRED by Node.js!
// if it's not there, it'll be like you didn't export anything at all.
// don't worry-- you can add dynamic exports in your init function!
module.exports.omnibotExports = {};

// since the init function is called before exports are requested,
// we can actually export stuff here.
module.exports.init = function (initOmnibot) {
  omnibot = initOmnibot;
  
  module.exports.omnibotExports.sayHello = () => omnibot.logger.info("Hello!");
  module.exports.omnibotExports.helloConstant = "Hello!";
  
  // sayHello and helloConstant are now available to dependents!
};
```

## Hosting Remote Modules

Hosting modules allows you to host your module's code from another server.

You'll need to host two files: a "remote module configuration file" and
your module's code.

**Every time an Omnibot configuration that uses your module starts,
it will re-fetch this file.**

Host the files wherever is easiest for you, but make sure that they're always available.
GitHub Pages or Amazon S3 are some good options, but you're by no means limited to them.
You can gate access by adding query string params, but no custom headers or cookies are supported.

Note that URLs must start with either `https://` or `http://localhost`.

While not required, we highly recommend you set the `Content-Type` header of your
config file to `application/json` and the `Content-Type` header of your code to
`application/javascript`. If you don't, users will see a warning.

### Remote Module Configuration File

The Remote Module Configuration File holds all the info Omnibot needs to load your
module.

We **highly** recommend using versioned config files so that users don't encounter
breaking changes. (Remember that Omnibot fetches this file each time it starts.)

Host a simple JSON file like this:

```json
{
  "schema_version": 1,
  "name": "Remote module",
  "code_url": "https://iamtheyammer.github.io/omnibot/examples/remote_modules/example_module.js",
  "checksum": {
    "sha256": "9f585a6943b6b385451b9bff6a9fcecf8cc3c2b7d1397eed19449c8f3b35cdf2"
  },
  "dependencies": [
    "omnibot:core",
    "npm:axios"
  ]
}
```

- `schema_version` should always be 1.
- `name` is required, and is a **human-readable** name for your module.
- `code_url` is where your code can be found.
- `checksum.sha256` is a required SHA256 checksum of your code.
If this checksum doesn't match the checksum of the downloaded file, the module will not be loaded.
- `dependencies` is a recommended array of dependencies. If the config file for the Omnibot that
imports this module specifies a dependencies array, it will **always** be used. This means
  you'll want to check for every dependency you specify.
  (You can call `omnibot.module.dependencies.hasDependency(dependencyString)` in your module to ensure dependencies).
  
### Remote Module Code

Just host your code at the `code_url` url in the config file.

Remember that when your code changes, you'll need to update your checksum or Omnibot will reject
the module and show a scary warning to users.

Also, try to set the `Content-Type` header to `application/javascript`. Omnibot will show a not-so-scary yellow warning
if this isn't the case.
