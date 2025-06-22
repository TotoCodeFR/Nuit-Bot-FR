import { SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Donne la latence du bot.'),
	async execute(interaction) {
		await interaction.reply(`🏓 Pong!\nLatence: ${Date.now() - interaction.createdAt}ms`);
	},
};
