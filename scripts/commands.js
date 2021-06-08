const Discord = require("discord.js");
const main = require("../index.js");
const config = require("../config.json");
const fs = require("fs");
const bot = require("../index.js");
const Canvas = require('canvas');
const merge = require("merge-images")
const cmdList = require("../command_list.json");

const walks = require('../data/walks.json')
const petList = require('../data/pets.json')
const backgroundList = require('../data/backgrounds.json')
const frameList = require('../data/frames.json')

const SQLite3 = require('better-sqlite3');
const { table } = require("console");
const sql = new SQLite3('./db/player_data.sqlite');

const Random = async (min, max) => {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is exclusive and the minimum is inclusive
}

const getData = async id => {
	const table = await sql.prepare("SELECT * FROM player_data WHERE id = ?").get(id);

	let stats = await JSON.parse(decodeURI(table.stats));

	if (!stats.daily) {
		let pair = { daily: 0 }
		stats = { ...stats, ...pair }
	}

	let response = {
		id: table.id,
		coins: table.coins,
		stats: stats
	}

	return response;
}

const setData = async (data) => {
	data.coins = encodeURI(JSON.stringify(data.coins));
	data.stats = encodeURI(JSON.stringify(data.stats));

	let table = {
		id: data.id,
		coins: data.coins,
		stats: data.stats
	}

	sql.prepare("INSERT OR REPLACE INTO player_data (id, coins, stats) VALUES (@id, @coins, @stats);").run(table)

	return true;
}

const feed = async (m, id, amount = 1) => {
	const table = await getData(id);

	if (table.stats.hunger > 0) {
		table.stats.hunger -= await Random(10, 20);

		if (table.stats.hunger < 0) table.stats.hunger = 0;
	}

	if (table.stats.dirty > 100) {
		table.stats.dirty += await Random(0, 15);

		if (table.stats.dirty > 100)
			table.stats.dirty = 100;
	}

	table.stats.growth += await Random(0, 11);
	if (table.stats.growth > 100) table.stats.growth = 100;

	table.coins -= 5;

	m.channel.send(`You feed your pet, it now is ${await table.stats.hunger}% hungry.`)

	await setData(table)
}

const clean = async (m, id, amount = 1) => {
	const table = await getData(id);

	if (table.stats.dirty > 0) {
		table.stats.dirty -= await Random(10, 30);

		if (table.stats.dirty < 0) table.stats.dirty = 0;
	}

	table.coins -= 10;

	m.channel.send(`You clean your pet, it now is ${await table.stats.dirty}% dirty.`)

	await setData(table);
}

const walk = async (m, id) => {
	const table = await getData(id);

	const canvas = Canvas.createCanvas(430, 320)
	const context = canvas.getContext('2d')
	const bg = await Canvas.loadImage(`./img/paseo.png`)
	const pet = await Canvas.loadImage(`./img/pet/${table.stats.pet}.png`)
	context.drawImage(bg, 0, 0, canvas.width, canvas.height);
	context.drawImage(pet, canvas.width / 2 - (canvas.height / 2) / 2, canvas.height / 3, canvas.height / 2, canvas.height / 2)
	const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'paseo.png');

	let roll = await Random(0, walks.length - 1);
	const walk = walks[roll];

	table.stats.dirty += await Random(1, 20);
	if (table.stats.dirty > 100) table.stats.dirty = 100;

	table.stats.hunger += await Random(1, 20);
	if (table.stats.hunger > 100) table.stats.hunger = 100;

	table.stats.growth += await Random(1, 10);
	if (table.stats.growth > 100) table.stats.growth = 100;

	let mult = table.stats.fun / 10;
	let G = await Random(1, 11 - mult > 0 ? 11 - mult : 1);
	table.coins += G;

	table.stats.age++;

	await setData(table);

	embed = new Discord.MessageEmbed()
		.setTitle(`${walk.description}`)
		.setDescription(`You found ${G}G on the ground!`)
		.attachFiles(attachment)
		.setImage('attachment://paseo.png');

	m.channel.send(embed);
}

const stats = async (m, id) => {
	const table = await getData(id);

	table.stats.fun = table.stats.hunger / 2 + table.stats.dirty / 2;

	const embed = new Discord.MessageEmbed()
		.setTitle(`${m.author.username}'s pet stats`)
		.addFields(
			{ name: `Wallet`, value: `${table.coins}G`, inline: true },
			{ name: `Age`, value: `${table.stats.age}`, inline: false },
			{ name: `Hunger`, value: `${table.stats.hunger}%`, inline: true },
			{ name: `Cleanliness`, value: `${table.stats.dirty}%`, inline: false },
			{ name: `Growth`, value: `${table.stats.growth}%`, inline: true },
			{ name: `Unhappiness`, value: `${table.stats.fun}%`, inline: false }
		)

	m.channel.send(`**${m.author.username}'s pet stats**`, { embed: embed })
}

const evolve = async (m, id) => {
	const table = await getData(id);

	if (table.stats.pet === 0) {
		table.stats.pet = await Random(1, petList.length)
	}

	table.stats.growth = 0;

	await setData(table);
}

const previousFrame = async id => {
	const table = await getData(id);

	if (table.stats.frame > 0) {
		table.stats.frame--;
	}

	await setData(table);
}

const nextFrame = async id => {
	const table = await getData(id);

	if (table.stats.frame < frameList.length - 1) {
		table.stats.frame++;
	}

	await setData(table);
}

const previousBg = async id => {
	const table = await getData(id);

	if (table.stats.background > 0) {
		table.stats.background--;
	}

	await setData(table);
}

const nextBg = async id => {
	const table = await getData(id);

	if (table.stats.background < backgroundList.length - 1) {
		table.stats.background++;
	}

	await setData(table);
}

module.exports = {

	help: async m => {
		const embed = new Discord.MessageEmbed()
			.setTitle("Command List")

		let base = []
		for (let i = 0; i < cmdList.length; i++) {
			let cmd = '`' + `${cmdList[i].name} / ${cmdList[i].short} : ${cmdList[i].description}` + '`';
			switch (cmdList[i].category) {
				case 'common':
					base += base.length > 0 ? `\n${cmd}` : `${cmd}`;
					break;
			}
		}

		embed.addField(`Basic Commands`, base, false)

		m.channel.send(embed);
	},

	view: async m => {
		let table = await getData(m.author.id);

		const canvas = Canvas.createCanvas(430, 320)
		const context = canvas.getContext('2d')

		const frame = await Canvas.loadImage(`./img/frame/${table.stats.frame}.png`)
		const bg = await Canvas.loadImage(`./img/background/${table.stats.background}.png`)
		const pet = await Canvas.loadImage(`./img/pet/${table.stats.pet}.png`)

		context.drawImage(frame, 0, 0, canvas.width, canvas.height);
		context.drawImage(bg, 32, 24, canvas.width - 64, canvas.height - 48)
		context.drawImage(pet, canvas.width / 2 - (canvas.height / 2) / 2, canvas.height / 3, canvas.height / 2, canvas.height / 2)

		const attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'gotchi.png');

		let _feed = new bot.disbut.MessageButton()
			.setLabel("Feed for 5G")
			.setID(`feed_${await Random(0, 9999999)}`)

		if (table.coins < 5)
			_feed.setLabel("Not enough G to feed")
		else
			_feed.setLabel("Feed for 5G")

		if (table.stats.hunger > 50)
			_feed.setStyle("red")
		else if (table.stats.hunger > 20)
			_feed.setStyle("green")
		else
			_feed.setStyle("gray")

		let _clean = new bot.disbut.MessageButton()
			.setLabel("Clean for 10G")
			.setID(`clean_${await Random(0, 9999999)}`)

		if (table.coins < 10)
			_clean.setLabel("Not enough G to clean")
		else
			_clean.setLabel("Clean for 10G")

		if (table.stats.dirty > 50)
			_clean.setStyle("red")
		else if (table.stats.dirty > 20)
			_clean.setStyle("green")
		else
			_clean.setStyle("gray")

		let _walk = new bot.disbut.MessageButton()
			.setLabel("Walk")
			.setStyle("blurple")
			.setID(`walk_${await Random(0, 9999999)}`)

		let _stats = new bot.disbut.MessageButton()
			.setLabel("Stats")
			.setStyle("blurple")
			.setID(`stats_${await Random(0, 9999999)}`)

		let _evolve = new bot.disbut.MessageButton()
			.setLabel("Evolve")
			.setStyle("green")
			.setID(`evolve_${await Random(0, 9999999)}`)

		let buttonRow = new bot.disbut.MessageActionRow()
			.addComponent(_feed)
			.addComponent(_clean)
			.addComponent(_walk)
			.addComponent(_stats)

		if (table.stats.growth === 100) {
			buttonRow.addComponent(_evolve)
		}

		const embed = new Discord.MessageEmbed()
			.setTitle(`${m.author.username}'s Pet`)
			.setDescription(`Your pet is ${table.stats.age} walks old.`)
			.attachFiles(attachment)
			.setImage('attachment://gotchi.png')

		let message = await m.channel.send(`**${m.author.username}'s Pet**`, { component: buttonRow, embed: embed });

		const filter = (button) => button.clicker.user.id === m.author.id;
		const collector = message.createButtonCollector(filter, { time: 10 * 1000 });

		let willFeed = false;
		let willClean = false;

		collector.on('collect', b => {
			b.defer();

			if (b.clicker.user.id === m.author.id) {
				if (b.id.includes('feed')) {
					if (table.coins >= 5) {
						feed(m, m.author.id)
					}
					else {
						m.channel.send(`${m.author.username} you don't have enough G to feed your pet.`)
					}
				}
				else if (b.id.includes('clean')) {
					if (table.coins >= 10) {
						clean(m, m.author.id)
					}
					else {
						m.channel.send(`${m.author.username} you don't have enough G to clean your pet.`)
					}
				}
				else if (b.id.includes('walk')) {
					walk(m, m.author.id);
				}
				else if (b.id.includes('stats')) {
					stats(m, m.author.id);
				}
				else if (b.id.includes('evolve')) {
					evolve(m, m.author.id);
				}
			}

			collector.stop();
		});

		collector.on('end', _ => {
			message.edit(`**${m.author.username}'s Pet**`)
		});
	},

	frame: async m => {
		let table = await getData(m.author.id);

		let canvas = Canvas.createCanvas(430, 320)
		let context = canvas.getContext('2d')

		let frame = await Canvas.loadImage(`./img/frame/${table.stats.frame}.png`)
		let bg = await Canvas.loadImage(`./img/background/${table.stats.background}.png`)
		context.drawImage(frame, 0, 0, canvas.width, canvas.height);
		context.drawImage(bg, 32, 24, canvas.width - 64, canvas.height - 48)

		let attachment = new Discord.MessageAttachment(canvas.toBuffer(), 'gotchi.png');

		let _framePrevious = new bot.disbut.MessageButton()
			.setLabel("Previous Frame")
			.setStyle("blurple")
			.setID(`framepre_${await Random(0, 9999999)}`)

		let _frameNext = new bot.disbut.MessageButton()
			.setLabel("Next Frame")
			.setStyle("blurple")
			.setID(`framenext_${await Random(0, 9999999)}`)

		let _bgPrevious = new bot.disbut.MessageButton()
			.setLabel("Previous Background")
			.setStyle("blurple")
			.setID(`bgpre_${await Random(0, 9999999)}`)

		let _bgNext = new bot.disbut.MessageButton()
			.setLabel("Next Background")
			.setStyle("blurple")
			.setID(`bgnext_${await Random(0, 9999999)}`)

		let buttonRow = new bot.disbut.MessageActionRow()
			.addComponent(_framePrevious)
			.addComponent(_frameNext)
			.addComponent(_bgPrevious)
			.addComponent(_bgNext)

		let message = await m.channel.send(`**${m.author.username}'s Gotchi**`, { component: buttonRow, files: [attachment] });

		const filter = (button) => button.clicker.user.id === m.author.id;
		const collector = message.createButtonCollector(filter, { time: 5 * 1000 });

		collector.on('collect', b => {
			b.defer();

			if (b.clicker.user.id === m.author.id) {
				if (b.id.includes('framepre')) {
					previousFrame(m.author.id);
				}
				else if (b.id.includes('framenext')) {
					nextFrame(m.author.id);
				}
				else if (b.id.includes('bgpre')) {
					previousBg(m.author.id);
				}
				else if (b.id.includes('bgnext')) {
					nextBg(m.author.id);
				}
			}

			collector.stop();
		});

		collector.on('end', _ => {
			message.edit(`**${m.author.username}, please type _g f_ again to see your new Gotchi**`)
		});
	},

	reset: async m => {
		const table = await getData(m.author.id);

		if (table.stats.pet == 0) {
			m.channel.send(`${m.author.username} you can't reset if your pet hasn't hatched yet!`)
			return;
		}

		table.stats.pet = 0;
		table.stats.hunger = 0;
		table.stats.dirt = 0;
		table.coins += table.stats.age * 3;

		m.channel.send(`${m.author.username} your pet has been reset.`)

		setData(table);
	},

	leaderboard: async (m, arg) => {
		arg[0] = arg[0] != null ? arg[0].toLowerCase() : null;
		let tables = sql.prepare('SELECT * FROM player_data')
		tables = tables.all();

		if (arg.length !== 0 && arg[0] == '')
			return

		let lb = [];
		let v = []
		const embed = new Discord.MessageEmbed()

		if (arg[0] === 'g') {
			for (let i = 0; i < tables.length; i++) {
				lb.push({
					name: (await bot.client.users.fetch(tables[i].id)).username,
					g: tables[i].coins
				})
			}

			embed.setTitle(`G Leaderboard`)

			lb.sort((a, b) => (a.g > b.g) ? -1 : 1);

			for (let i = 0; i < 5; i++) {
				if (lb[i]) {
					v.push({ name: `#${i + 1} ${lb[i].name}`, value: `${lb[i].g}G`, inline: false })
				}
			}
		}
		else if (arg[0] === 'age') {

			for (let i = 0; i < tables.length; i++) {
				let stats = await JSON.parse(decodeURI(tables[i].stats));
				lb.push({
					name: (await bot.client.users.fetch(tables[i].id)).username,
					age: stats.age
				})
			}

			embed.setTitle(`Age Leaderboard`)

			lb.sort((a, b) => (a.age > b.age) ? -1 : 1);

			console.log[lb[0]]

			for (let i = 0; i < 5; i++) {
				if (lb[i]) {
					v.push({ name: `#${i + 1} ${lb[i].name}`, value: `${lb[i].age} walks`, inline: false })
				}
			}
		}

		embed.addFields(v);

		m.channel.send({ embed: embed })
	},

	daily: async msg => {
		const table = await getData(msg.author.id);

		if (!table) { return; }

		let fecha = new Date();
		fecha = `${fecha.getDate()}`

		if (table.stats.daily == fecha) {
			msg.channel.send(`${msg.author.username}, you've already cashed in your check for today.`);
			return;
		}

		let g = await Random(50, 150);
		table.coins += g;
		table.stats.daily = `${fecha}`;

		setData(table);

		msg.channel.send(`${msg.author.username} claimed his daily check for ${g}G`)
	}
}