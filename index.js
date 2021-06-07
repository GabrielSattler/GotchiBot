const Discord = require("discord.js");
const bot = new Discord.Client();
const config = require("./config.json");

const SQLite3 = require('better-sqlite3');
const sql = new SQLite3('./db/player_data.sqlite')

const commands = require("./scripts/commands.js");
const cmdList = require("./command_list.json");

const disbut = require('discord-buttons');
disbut(bot)

const recentlyCalled = new Set();

bot.login(config.token);

bot.on("ready", () => {
  bot.user.setPresence({
    status: 'online',
    activity: {
      name: 'g help',
      type: "STREAMING",
      url: "https://theuselessweb.com/"
    }
  })

  const userTable = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'player_data';").get();

  if (!userTable['count(*)']) {
    sql.prepare("CREATE TABLE player_data (id TEXT PRIMARY KEY, coins INT, stats TEXT, unlocks TEXT);").run();
    sql.prepare("CREATE UNIQUE INDEX idx_scores_id ON player_data (id);").run();
    sql.pragma("synchronous = 1"); sql.pragma("journal_mode = wal");
  }

  bot.getData = sql.prepare("SELECT * FROM player_data WHERE id = ?");
  bot.setData = sql.prepare("INSERT OR REPLACE INTO player_data (id, coins, stats, unlocks) VALUES (@id, @coins, @stats, @unlocks);");

  console.log((`Gotchi up & running!`));
});

bot.on("message", async message => {
  if (message.author.bot || !message.guild || message.content.toLowerCase().indexOf(config.prefix) !== 0) return;

  if (message.guild) {
    table = bot.getData.get(message.author.id);

    if (!table) {
      table = {
        id: `${message.author.id}`,
        coins: 0,
        stats: encodeURI(JSON.stringify({
          name: 'Pet',
          hunger: 0,
          dirty: 0,
          fun: 0,
          growth: 0,
          frame: 0,
          background: 0,
          pet: 0
        })),
        unlocks: encodeURI(JSON.stringify({
          frames: [0, 1, 2],
          backgrounds: [0],
          pets: [0]
        }))
      }
    }

    if (table.mxp === 0) { table.mxp = 10 }

    bot.setData.run(table)
  }

  let args = message.content.slice(config.prefix.length).trim().split(/ (?=(?:(?:[^"']*"){2})*[^"']*$)/);
  let cmd = args.shift();

  let d = new Date();
  console.log(`[${d.getDay()}/${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}] User ${message.author.tag} sent a request for "${cmd}" with "${args}" arguments.`);

  if (cmd != null) {
    checkCommand(cmd, message, args);
  }
  else {
    console.log("Problema con comando");
  }
});

const checkCommand = async (cmd, msg, args = "") => {
  try {
    let command = cmdList.find(cm => cm.name === cmd) != null ? cmdList.find(cm => cm.name === cmd) : cmdList.find(cm => cm.short === cmd);
    if (command === undefined) { msg.channel.send('Ese comando no existe.'); return }

    if (!recentlyCalled.has(`${msg.author.id}:${command.name}:${command.short}`)) {
      recentlyCalled.add(`${msg.author.id}:${command.name}:${command.short}`);
      let response = await commands[command.name](msg, args);
    } else {
      let cd = command.cooldown / 1000;
      msg.channel.send(`Tenes que esperar ${cd}s antes de usar ese comando de nuevo.`)
    }
    setTimeout(() => {
      recentlyCalled.delete(`${msg.author.id}:${command.name}:${command.short}`);
    }, command.cooldown);
    return true;
  }
  catch (err) { console.log(err); }
}

exports.client = bot;
exports.disbut = disbut;
