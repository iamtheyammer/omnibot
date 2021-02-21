import { Message } from "discord.js";
import { Args } from "../index";
import { errorEmbed, infoEmbed, successEmbed } from "../embeds";
import { bold, code } from "../styles";
import { config, dependencyManager, moduleManager } from "../../index";
import { URL } from "url";
import fetchRemoteModule, {
  fetchRemoteModuleConfigFile,
  RemoteModuleConfig,
} from "../../config/fetch_remote_module";
import discordConfirm from "../discord_confirm";
import { OmnibotModule } from "../../config/parse_config_file";
import ModuleDependencyManager from "../../dependency_manager/module_dependency_manager";

const helpEmbed = errorEmbed()
  .setTitle("Loading modules")
  .setDescription(
    `${code(
      "module load"
    )} lets you load modules. If the module isn't in your config file, it will not be
reloaded when the bot restarts.`
  )
  .addFields(
    {
      name: "Loading from config file",
      value:
        "If a module is in your config file, just enter its ID to load it. For example, " +
        "if `module1` is in your config file, just run `module load module1`.",
    },
    {
      name: "Loading a remote module",
      value:
        "Just run `module load remote <new module id> <config file url>`, like `module load remote mymodule https://example.com/mymoduleconfig.json`.",
    }
    //     {
    //       name: "Loading from local path",
    //       value: `${code("module load local <new module id> <path>")}
    // If a module is stored locally, enter a path, either absolute or relative, to the file's location.
    // If you enter a relative path, it must be relative to the Omnibot JS file. For example, if Omnibot is running at \`/home/user/omnibot/omnibot.bundle.js\` and your module is at \`/home/user/omnibot/modules/mymodule.js\`, you'd run \`module load local ./mymodule.js\`.
    // Of course, you could also run \`module load local /home/user/omnibot/modules/mymodule.js\`.`,
    //     }
  );

export default async function load(msg: Message, args: Args) {
  let module: OmnibotModule | undefined;

  if (args.args.length === 1) {
    // local module in config file
    args.logger.debug("Detected load as module in config file");

    const moduleId = args.args[0];
    const mod = config.modules.find((m) => m.id === moduleId);

    if (!mod) {
      args.logger.debug(`Couldn't find module ${moduleId} in config file`);
      await msg.reply(
        errorEmbed()
          .setTitle("Module not found")
          .setDescription(
            `Couldn't find a module with ID ${code(
              moduleId
            )} in your config file.`
          )
      );
      return;
    }

    module = mod;
  }

  if (!module && args.args.length < 3) {
    await msg.reply(helpEmbed);
    return;
  }

  if (args.args[0] === "remote") {
    const [, newModuleId, configUrl] = args.args;

    if (config.modules.some((m) => m.id === newModuleId)) {
      await msg.reply(
        errorEmbed()
          .setTitle("Duplicate module ID")
          .setDescription(
            `${code(
              newModuleId
            )} is already in use by another module. Module IDs must be unique.`
          )
      );
      return;
    }

    if (
      config.modules.some(
        (m) => m.source.source === "remote" && m.source.url === configUrl
      )
    ) {
      await msg.reply(
        errorEmbed()
          .setTitle("Module config URL already in use")
          .setDescription("Each config file URL can only load one module.")
      );
      return;
    }

    try {
      new URL(configUrl);
    } catch (e) {
      await msg.reply(
        errorEmbed()
          .setTitle("Invalid remote module config URL")
          .setDescription(`${configUrl} is not a valid URL: ${e}`)
      );
      return;
    }

    let remoteModuleConfig: RemoteModuleConfig;
    try {
      remoteModuleConfig = await fetchRemoteModuleConfigFile(configUrl);
    } catch (e) {
      await msg.reply(
        errorEmbed()
          .setTitle("Error fetching remote module config file")
          .setDescription(`${e}`)
      );
      return;
    }

    const duplicateModule = moduleManager
      .getLoadedModules()
      .find(
        (m) =>
          m.remoteModuleConfig &&
          m.remoteModuleConfig.checksum.sha256 ===
            remoteModuleConfig.checksum.sha256
      );
    if (duplicateModule) {
      await msg.reply(
        errorEmbed()
          .setTitle("Module already loaded")
          .setDescription(
            `Module ${code(
              duplicateModule.id
            )} has the exact same code and is already running.`
          )
      );
      return;
    }

    const confirmMsg = await msg.reply(
      infoEmbed()
        .setTitle(`Are you sure you want to load "${remoteModuleConfig.name}"?`)
        .setDescription(
          `${bold(
            "WARNING: Malicious developers can do anything from reading your Discord bot token to editing files on your computer."
          )} Make sure you trust the developer before loading the module.
If you react with the check emoji, the module will be loaded and its dependencies installed.`
        )
        .addFields(
          {
            name: "Module name",
            value: remoteModuleConfig.name,
            inline: true,
          },
          {
            name: "Code URL",
            value: remoteModuleConfig.code_url,
            inline: true,
          },
          {
            name: "Dependencies",
            value: remoteModuleConfig.dependencies
              ? `- ${remoteModuleConfig.dependencies
                  .map((d) => code(d))
                  .join("\n- ")}`
              : "No dependencies",
          }
        )
    );

    const confirmation = await discordConfirm(
      msg.author.id,
      confirmMsg,
      errorEmbed()
        .setTitle("Load canceled")
        .setDescription("The module was not loaded.")
    );
    if (!confirmation) {
      return;
    }

    const remoteModule = await fetchRemoteModule(
      configUrl,
      args.logger.createChildLogger("fetch_remote_module")
    );

    module = {
      id: newModuleId,
      name: remoteModuleConfig.name,
      source: {
        source: "remote",
        local_path: remoteModule.codePath,
        url: configUrl,
      },
      remoteModuleConfig: remoteModuleConfig,
      dependencies: new ModuleDependencyManager(
        newModuleId,
        remoteModuleConfig.dependencies
      ),
      config: {},
    };

    config.modules.push(module);
  }

  if (!module) {
    await msg.reply(helpEmbed);
    return;
  }

  const statusMsg = await msg.reply(
    infoEmbed()
      .setTitle("Loading...")
      .setDescription(
        `Loading module ${code(module.id)}. This may take a minute!`
      )
  );

  try {
    args.logger.debug("Adding module to dependency manager");
    dependencyManager.addModule(
      module,
      config.modules.map((m) => m.id)
    );

    args.logger.debug("Resolving dependencies");
    await dependencyManager.resolveDependencies();

    args.logger.debug("Loading module");
    await moduleManager.loadModule(module);
  } catch (e) {
    if (module.remoteModuleConfig) {
      config.modules = config.modules.filter(
        (m) =>
          m.remoteModuleConfig &&
          m.remoteModuleConfig.checksum.sha256 ===
            // @ts-ignore
            module.remoteModuleConfig.checksum.sha256
      );
    }

    await statusMsg.edit(
      errorEmbed()
        .setTitle("Error loading module")
        .setDescription(
          `There was an error loading module ${code(module.id)}: ${e}`
        )
    );
    return;
  }

  await statusMsg.edit(
    successEmbed()
      .setTitle(`Successfully loaded ${code(module.name)}!`)
      .setDescription(
        `It's up and running! Run ${code(
          `module info ${module.id}`
        )} for more info.`
      )
  );
}
