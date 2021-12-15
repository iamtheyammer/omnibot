import { normalize, join, resolve, relative } from "path";
import { readFile, writeFile, readdir, mkdir, rmdir, rm } from "fs/promises";

class CoreDependencyFileManagerNoDependencyError extends Error {
  constructor() {
    super();
    this.name = "CoreDependencyFileManagerNoDependencyError";
  }
}

class CoreDependencyFileManagerIllegalAccessError extends Error {
  constructor() {
    super();
    this.name = "CoreDependencyFileManagerIllegalAccessError";
  }
}

class CoreDependencyFileManager {
  private readonly allowFs: boolean;
  private readonly basePath: string;

  public static getModuleFilesDirectory(moduleId: string): string {
    return resolve(`./module_files/${moduleId}`);
  }

  constructor(moduleId: string, allowFs: boolean) {
    this.allowFs = allowFs;
    this.basePath = CoreDependencyFileManager.getModuleFilesDirectory(moduleId);
  }

  private getFullPath(moduleRelativePath: string) {
    const fullPath = join(this.basePath, moduleRelativePath);

    // compute relative path from base to requested file/directory
    // if it requires going backwards (..), access is illegal
    if (relative(this.basePath, fullPath).includes("..")) {
      throw new CoreDependencyFileManagerIllegalAccessError();
    }

    return fullPath;
  }

  async readFile(path: string): Promise<string> {
    if (!this.allowFs) {
      throw new CoreDependencyFileManagerNoDependencyError();
    }

    return await readFile(this.getFullPath(path), { encoding: "utf8" });
  }

  async writeFile(path: string, contents: string | Buffer): Promise<void> {
    if (!this.allowFs) {
      throw new CoreDependencyFileManagerNoDependencyError();
    }

    return await writeFile(this.getFullPath(path), contents, {
      encoding: "utf8",
    });
  }

  async readdir(path = "/"): Promise<string[]> {
    if (!this.allowFs) {
      throw new CoreDependencyFileManagerNoDependencyError();
    }

    return await readdir(this.getFullPath(path));
  }

  async mkdir(path: string, recursive = false): Promise<void> {
    if (!this.allowFs) {
      throw new CoreDependencyFileManagerNoDependencyError();
    }

    await mkdir(this.getFullPath(path), { recursive });
    return;
  }

  async rmdir(path: string): Promise<void> {
    if (!this.allowFs) {
      throw new CoreDependencyFileManagerNoDependencyError();
    }

    return await rmdir(this.getFullPath(path));
  }

  async rm(path: string): Promise<void> {
    if (!this.allowFs) {
      throw new CoreDependencyFileManagerNoDependencyError();
    }

    return await rm(this.getFullPath(path));
  }
}

export default CoreDependencyFileManager;
