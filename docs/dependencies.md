# Module Dependencies

Each module needs a dependency array, like the one below.

```json
// omnibot config
{
  // ...
  "modules": [
    {
      // ...
      "dependencies": [
        "omnibot:core",
        "npm:axios"
      ]
    }
  ]
}
```

The module above specifies two dependencies: `omnibot:core` and `npm:axios`.

Dependencies prefixed with `omnibot` are explained [here](#omnibot-dependencies), and
dependencies prefixed with `npm` are explained [here](#npm-dependencies).

### Checking For Dependencies

If you're writing a remote module, remember that the person loading the module may have specified their own
dependency array that takes precedence over your dependency array.

You can use the Omnibot API `omnibot.module.dependencies.hasDependency(dependencyString)` to check whether you
have access to a specified dependency.

## Omnibot Dependencies

Dependencies prefixed with `omnibot:` are considered Omnibot dependencies.
Below is a list of all Omnibot dependencies and their functionality.

| Dependency | Effects and usage |
| ---------: | ----------------: |
| `omnibot:core` | Core Omnibot functionality. See [here](#omnibot-core-dependency) for details. |
| `omnibot:module:<module id>` | Marks <module_id> as a dependency for this module. See [here](#inter-module-dependencies) for more details. |
| `omnibot:inittimeout:<timeout in milliseconds>` | If a promise is returned from the init function, how long to wait before timing out and loading other modules? |

### Omnibot Core Dependency

The Omnibot Core Dependency is required for all modules that need to interact with Discord.

Add it with `omnibot:core`.

### Inter-Module Dependencies

Sometimes, you might want to write a library that just exposes functions to other modules.
Omnibot fully supports this!

To make a "dependency module", you'll export all functions like this:

```js
function doSomething() {
  // ...
}

function doSomethingElse() {
  // ...
}

function anotherFunction() {
  
}

module.exports.omnibotExports = {
  doSomething,
  doSomethingElse,
  anotherFunction
}
```

Note: dependencies' `init` function will be called _before_ requesting `omnibotExports`.
If a promise is returned from `init`, it will have 30 seconds to resolve before it times out and other modules are loaded.
This can be disabled by adding `omnibot:inittimeout:<milliseconds to wait>` to the dependency list and setting <milliseconds to wait> to 0,
like `omnibot:inittimeout:0`.

If the **id** of our example dependency module is `exdepmod`, our consumer of this (with ID `exconsumermod`)
must have the dependency `omnibot:module:exdepmod` in its dependency list.
Then, it can call `omnibot.modules.exdepmod` to get the object exported inside of `exdepmod`.

Here's what `exconsumermod` might look like:

```js
module.exports.init = function(omnibot) {
  // get the exports of exdepmod
  const exdepmod = omnibot.modules.exdepmod;
  
  // we can now call functions from it!
  exdepmod.doSomething();
  exdepmod.doSomethingElse();
  exdepmod.anotherFunction();
}
```

## NPM Dependencies

Dependencies prefixed with `npm:` are considered NPM dependencies.
They will be **automatically installed** via yarn or npm, depending on your package manager of choice.

Packages that are no longer in use (the module that depended on the package isn't in use anymore) are **not**
automatically uninstalled. A prune command may come soon.

Adding a dependency is easy: just add the dependency after `npm:`, like this:

- `npm:axios`
- `npm:lodash`
- `npm:oauth`

Packages that come with npm do _not_ need to be added as dependencies, like `fs`.

Remember that the user loading the module may have specified a custom dependency array that does not include your
npm dependency. Read [Checking for Dependencies](#checking-for-dependencies) for more info.

Currently, adding npm dependencies does **not** support versioning. This may come in a future update, but
the best solution right now is to use [`@vercel/ncc`](https://www.npmjs.com/package/@vercel/ncc) to compile your
module with all its dependencies.
