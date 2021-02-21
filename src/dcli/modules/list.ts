import { Message } from "discord.js";
import { Args } from "../index";
import { moduleManager } from "../../index";
import { infoEmbed } from "../embeds";

export default async function listModules(msg: Message, args: Args) {
  const loadedModules = moduleManager.getLoadedModules();

  if (!loadedModules.length) {
    await msg.reply(infoEmbed().setTitle("0 modules are running"));
    return;
  }

  await msg.reply(
    infoEmbed()
      .setTitle(`${loadedModules.length} modules are running`)
      .setDescription(
        `The following modules are loaded: ${loadedModules
          .map((m) => `**${m.id}**${m.id !== m.name ? ` (${m.name})` : ""}`)
          .join(", ")}`
      )
      .addFields({
        name: "To get info on a module:",
        value: `Run \`module info <module id>\`, like \`module info ${loadedModules[0].id}\``,
      })
  );
}
