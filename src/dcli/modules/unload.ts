import { Message } from "discord.js";
import { Args } from "../index";
import { errorEmbed, infoEmbed, successEmbed } from "../embeds";
import { dependencyManager, moduleManager } from "../../index";
import discordConfirm from "../discord_confirm";

export default async function unload(msg: Message, args: Args) {
  if (!args.args.length) {
    await msg.reply(
      errorEmbed()
        .setTitle("Missing module ID")
        .setDescription(
          "List module ids by running `modules`, and run this command like `modules unload my-module`"
        )
    );
    return;
  }

  const toUnload = args.args[0];

  if (!moduleManager.getLoadedModules().find((m) => m.id === toUnload)) {
    await msg.reply(
      errorEmbed()
        .setTitle(`Can't find ${toUnload}`)
        .setDescription(
          `Either \`${toUnload}\` isn't loaded or you've never set up a module with id \`${toUnload}\`.`
        )
    );
    return;
  }

  const toUnloadDeps = dependencyManager.moduleHasModuleDependents(toUnload);

  if (toUnloadDeps) {
    const confirmMsg = await msg.reply(
      infoEmbed()
        .setTitle(`Careful: this module has dependents`)
        .setDescription(
          `\`${toUnload}\` has dependents, meaning that any modules that depend on this module 
may have limited functionality or just fail.
Be careful! If you still want to unload it, react with the check emoji.`
        )
    );
    const confirmation = await discordConfirm(
      msg.author.id,
      confirmMsg,
      errorEmbed()
        .setTitle("Module unload canceled")
        .setDescription(`\`${toUnload}\` is still loaded.`)
    );

    if (!confirmation) {
      return;
    }
  }

  const statusMsg = await msg.reply(
    infoEmbed().setTitle("Unloading...").setDescription(
      `Omnibot is currently unloading \`${toUnload}\`. It shouldn't take longer than a minute. If so, check the logging channel.
This message will update when it's done.`
    )
  );

  await moduleManager.unloadModule(toUnload);

  await statusMsg.edit(
    successEmbed()
      .setTitle("Unload successful")
      .setDescription(`\`${toUnload}\` has been unloaded.`)
  );
}
