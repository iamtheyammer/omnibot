import { Message } from "discord.js";
import { Args } from "../index";
import { errorEmbed, infoEmbed } from "../embeds";
import { config, moduleManager } from "../../index";
import { code } from "../styles";

export default async function info(msg: Message, args: Args) {
  const moduleId = args.args[0] || "";

  if (!moduleId) {
    await msg.reply(
      errorEmbed()
        .setTitle("Missing module ID")
        .setDescription(`Use ${code("module info <module id>")}`)
    );
    return;
  }

  const module = config.modules.find((m) => m.id === moduleId);

  if (!module) {
    await msg.reply(
      errorEmbed()
        .setTitle("Unknown module")
        .setDescription(`Couldn't find a module with id ${code(moduleId)}.`)
    );
    return;
  }

  const moduleIsLoaded = moduleManager
    .getLoadedModules()
    .some((m) => m.id === moduleId);

  const fields = [
    {
      name: "ID",
      value: code(module.id),
      inline: true,
    },
    {
      name: "Name",
      value: code(module.name),
      inline: true,
    },
    {
      name: "Source",
      value: module.source.source,
      inline: true,
    },
    {
      name: !module.source.url ? "Local path" : "Config file URL",
      value: !module.source.url ? module.source.local_path : module.source.url,
    },
    {
      name: "Dependencies",
      value: `- ${Array.from(module.dependencies.dependencies)
        .map((d) => code(d))
        .join("\n- ")}`,
    },
    {
      name: "Loaded",
      value: moduleIsLoaded ? "✅" : "❌",
      inline: true,
    },
  ];

  await msg.reply(infoEmbed().setTitle(`Module ${moduleId}`).addFields(fields));
}
