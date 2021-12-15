# Filesystem

Sometimes, modules need to read/write files.
Omnibot provides a simple filesystem API to do so in a controlled space.

**For a module to access the Omnibot filesystem APIs, it needs the dependency `omnibot:fs`.**

## Overview

When filesystem access is granted to a module (see [Granting filesystem access](#granting-filesystem-access)),
a directory is created at `module_files/module_id`. This means that if you change a module's ID, it will lose access
to any files it had previously created.

Omnibot automatically prevents access to files outside the module's directory.
Any requests to read or write to a folder outside the module's directory will throw a `CoreDependencyFileManagerIllegalAccessError`.

## Granting filesystem access

To grant a module the ability to read/write files, add `omnibot:fs` to its dependency list.
If a module doesn't have this dependency and attempts to use the `omnibot.fs` APIs, it will throw a `CoreDependencyFileManagerNoDependencyError`.

You can use the `omnibot.module.dependencies.hasDependency("omnibot:fs")` API to determine whether your module is running with filesystem access.

If a module has filesystem access and that access is subsequently removed, the module's files are not removed.
You'd have to manually remove the directory and all contents from `module_files`.

## Omnibot Filesystem API

The Omnibot Filesystem API is fully asynchronous and promise-based.

For any function that takes a path argument, paths can start with `/`, `./` or can just be a filename.
For example, if you specified `test.json` as your path, that would be equivalent to `/test.json` or `./test.json`.
However, if you wanted to access a subdirectory (that you created with `omnibot.fs.mkdir`), you can use either `/subdir/test.json` or `subdir/test.json`.

Any attempts to access higher-level directories than your module's directory (for example, by specifying `..` in a path), will be blocked and a `CoreDependencyFileManagerIllegalAccessError` will be thrown. 

### readFile

`omnibot.fs.readFile(path: string): Promise<string>`

`readFile` reads a file from disk. All files are encoded as UTF-8, so they read in as strings.

### writeFile

`omnibot.fs.writeFile(path: string, contents: string | Buffer): Promise<void>`

`writeFile` writes a file with the specified path. While you can write a buffer, files are always encoded as UTF-8, so they're read back in as strings.
An error will be thrown if you attempt to write a file to a subdirectory that doesn't exist.
Use [`mkdir`](#mkdir) to create the subdirectory first.

### readdir

`omnibot.fs.readdir(path = "/"): Promise<string[]>`

`readdir` enumerates a diretory and returns an array of files in that directory.
It returns an array of files and subdirectories in the path specified, which defaults to your module's root directory.

### mkdir

`omnibot.fs.mkdir(path: string, recursive = false): Promise<void>`

`mkdir` creates a directory at the path specified.
If recursive is set to true, it will behave like `mkdir -p` on unix-like systems,
creating as many directories as necessary to fulfill the path specified.

### rmdir

`omnibot.fs.rmdir(path: string): Promise<void>`

`rmdir` removes a directory at the path specified.

### rm

`omnibot.fs.rm(path: string): Promise<void>`

`rm` removes a specified file at the path specified.
