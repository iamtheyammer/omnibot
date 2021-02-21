import { Message } from "discord.js";

interface DiscordConfirmOptions {
  timeoutMs?: number;
  confirmEmoji?: string;
  cancelEmoji?: string;
}

export default async function discordConfirm(
  reactingUserId: string,
  initialMessage: Message,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
  cancelMessage: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
  timeoutMessage?: any,
  options: DiscordConfirmOptions = {
    timeoutMs: 30000,
    cancelEmoji: "❌",
    confirmEmoji: "✅",
  }
): Promise<boolean> {
  await Promise.all([
    initialMessage.react(options.cancelEmoji!),
    initialMessage.react(options.confirmEmoji!),
  ]);

  let reactions;
  try {
    reactions = await initialMessage.awaitReactions(
      (reaction, user) =>
        reactingUserId === user.id &&
        (reaction.emoji.name === options.cancelEmoji ||
          reaction.emoji.name === options.confirmEmoji),
      { time: options.timeoutMs, max: 1, errors: ["time"] }
    );
  } catch (e) {
    await initialMessage.reply(timeoutMessage || cancelMessage);
    return false;
  }

  const reaction = reactions.first();

  if (reaction && reaction.emoji.name === options.cancelEmoji) {
    await initialMessage.reply(cancelMessage);
    return false;
  }

  return true;
}
