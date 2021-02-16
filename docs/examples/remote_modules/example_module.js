module.exports.init = function (omnibot) {
  omnibot.on("discord:message", (msg) => {
    omnibot.logger.log(`${msg.author} said: ${msg.content}`);
  });
};
