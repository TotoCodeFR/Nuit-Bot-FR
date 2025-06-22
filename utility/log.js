import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmbedBuilder } from 'discord.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(data, guild) {
	const channel = guild.channels.fetch(config.salonLog)

	const embed = new EmbedBuilder()
		.setColor(data.color || '#0099ff')
		.setTitle(data.title || 'Log')
		.setDescription(data.description || '')
		.setTimestamp();

	channel.then(c => {
		c.send({ embeds: [ embed ] })
	})
}

export { log };