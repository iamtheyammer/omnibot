import axios from "axios";
import { createHash } from "crypto";
import { normalize } from "path";
import { access, mkdir, writeFile, rm } from "fs/promises";
import { createReadStream, constants as fsConstants } from "fs";
import Logger from "../logger";

export interface RemoteModuleConfig {
  schema_version: number;
  name: string;
  code_url: string;
  checksum: {
    sha256: string;
  };
  dependencies: string[];
}

class InvalidRemoteModuleConfigurationError extends Error {
  constructor(e: string) {
    super(e);
    this.name = "InvalidRemoteModuleConfigurationError";
  }
}

class InvalidRemoteModuleChecksumError extends Error {
  constructor(e: string) {
    super(e);
    this.name = "InvalidRemoteModuleChecksumError";
  }
}

const remoteModulesWarning = `DO NOT EDIT ANYTHING IN THIS FOLDER!

You will CORRUPT and BREAK your Omnibot configuration.

AGAIN, DO NOT EDIT ANYTHING IN THIS FOLDER!

THAT MEANS:
- DO NOT RENAME ANYTHING
- DO NOT EDIT ANY FILES
- FOLLOW THESE INSTRUCTIONS, PLEASE!

If you did not follow these very clear instructions, please delete ALL files in this folder. (EVERYTHING!)`;

export default async function fetchRemoteModule(
  configUrl: string,
  logger: Logger
): Promise<{ remoteModuleConfig: RemoteModuleConfig; codePath: string }> {
  if (
    !configUrl.startsWith("https://") &&
    !configUrl.startsWith("http://localhost")
  ) {
    throw new InvalidRemoteModuleConfigurationError(
      "Remote config files MUST start with either https:// or http://localhost."
    );
  }

  // fetch from config url
  logger.info(`Downloading remote module config from ${configUrl}`);
  const configReq = await axios({
    method: "get",
    url: configUrl,
    headers: {
      Accept: "application/json",
    },
  });

  if (
    !configReq.headers["content-type"] ||
    configReq.headers["content-type"] !== "application/json"
  ) {
    logger.warn(
      `The Content-Type header from the remote module config request was NOT application/json.`
    );
  }

  logger.debug("Parsing remote module config...");
  let config: RemoteModuleConfig;
  if (typeof configReq.data === "object") {
    config = configReq.data as RemoteModuleConfig;
  } else {
    try {
      config = JSON.parse(configReq.data) as RemoteModuleConfig;
    } catch (e) {
      throw new InvalidRemoteModuleConfigurationError(
        `Unable to deserialize remote module response: ${e}`
      );
    }
  }

  if (config.schema_version !== 1) {
    throw new InvalidRemoteModuleConfigurationError("Invalid schema version");
  }

  if (!config.name) {
    throw new InvalidRemoteModuleConfigurationError("No name specified");
  }

  if (!config.code_url) {
    throw new InvalidRemoteModuleConfigurationError("No code_url specified");
  }

  if (!config.checksum || !config.checksum.sha256) {
    throw new InvalidRemoteModuleConfigurationError(
      "No SHA256 checksum specified"
    );
  }

  if (config.dependencies && !Array.isArray(config.dependencies)) {
    throw new InvalidRemoteModuleConfigurationError(
      "Specified dependencies is not an array"
    );
  }

  if (
    !config.code_url.startsWith("https://") &&
    !config.code_url.startsWith("http://localhost")
  ) {
    throw new InvalidRemoteModuleConfigurationError(
      "Remote code URLs MUST start with either https:// or http://localhost."
    );
  }

  // fetch module code
  logger.info("Fetching remote module code...");
  const moduleCodeReq = await axios({
    method: "get",
    url: config.code_url,
    headers: {
      Accept: "application/javascript",
    },
  });

  if (
    !configReq.headers["content-type"] &&
    (configReq.headers["content-type"] === "text/javascript" ||
      configReq.headers["content-type"] === "application/javascript")
  ) {
    logger.warn(
      `The Content-Type header from the remote module's code was NOT text/javascript or application/javascript.`
    );
  }

  // check checksum
  logger.debug("Checking module checksum");
  const computedChecksum = createHash("sha256")
    .update(moduleCodeReq.data)
    .digest("hex");

  if (config.checksum.sha256 !== computedChecksum) {
    throw new InvalidRemoteModuleChecksumError(
      `The checksum of the remote module does not match the checksum stated in the configuration. 
Please contact the author of the remote module and let them know that the "checksum doesn't match". 

In the meantime, DO NOT LOAD THIS MODULE! It may have been tampered with and could be unsafe.

Checksum from config: ${config.checksum.sha256}
Checksum of downloaded code: ${computedChecksum}`
    );
  }

  logger.debug("Checksums match");

  const checksum = config.checksum.sha256;

  // save as file with timestamp (remote_modules/checksum.js)

  // make remote_modules directory if it doesn't exist
  logger.debug("Creating remote_modules folder if it doesn't exist");
  try {
    await mkdir(normalize("./remote_modules"));

    logger.debug("Folder did not exist, writing warning file");
    await writeFile(
      normalize(`./remote_modules/DO_NOT_EDIT_ANYTHING_IN_THIS_FOLDER.txt`),
      remoteModulesWarning
    );
  } catch (e) {
    // it's ok if the remote_modules directory already exists
    if (e.code !== "EEXIST") {
      throw e;
    }
  }

  // save module as file
  const filename = normalize(`./remote_modules/${checksum}.js`);

  let saveCode = false;
  try {
    await access(filename, fsConstants.R_OK);
  } catch (e) {
    saveCode = true;
  }

  if (!saveCode) {
    logger.info(
      `Module already downloaded, checking checksum of existing file`
    );
    const currentFileChecksum = await getFileChecksum(filename);

    if (currentFileChecksum !== checksum) {
      logger.warn(
        `Remote module code with at ${filename} does NOT match its checksum from remote config. Remember to NEVER modify files in the remote_modules folder! Deleting and re-downloading file!`
      );

      logger.debug(`Deleting ${filename}`);
      // no try catch: if this fails we want to throw
      await rm(filename);

      // redownload code
      logger.debug("Deleted corrupted code, will re-download");
      saveCode = true;
    }
  }

  if (saveCode) {
    logger.info(`Writing module code to ${filename}`);
    await writeFile(filename, moduleCodeReq.data);

    logger.debug("Checking written file's checksum");
    const writtenChecksumMatches =
      checksum === (await getFileChecksum(filename));

    if (!writtenChecksumMatches) {
      throw new InvalidRemoteModuleChecksumError(
        `Checksum of written file (${filename}) does not match the checksum when it was downloaded. Is another program modifying files?`
      );
    }
  }

  // return absolute path to file
  return {
    remoteModuleConfig: config,
    codePath: filename,
  };
}

function getFileChecksum(path: string): Promise<string> {
  return new Promise((res, rej) => {
    const stream = createReadStream(path);
    const hash = createHash("sha256");

    stream.on("error", rej);

    stream.on("data", (chunk) => hash.update(chunk));

    stream.on("close", () => res(hash.digest("hex")));
  });
}
