import { Events, MessageFlags } from 'discord.js';

export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isButton()) {
			if (interaction.customId === 'notifs_maj') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });

				if (interaction.member.roles.cache.some(role => role.id === '1387035551458267177')) {
					interaction.member.roles.remove('1387035551458267177');
					await interaction.editReply({ content: 'Rôle <@&1387035551458267177> enlevé avec succès.', flags: MessageFlags.Ephemeral });
					return;
				} else {
					interaction.member.roles.add('1387035551458267177');
					await interaction.editReply({ content: 'Rôle <@&1387035551458267177> ajouté avec succès.', flags: MessageFlags.Ephemeral });
					return;
				}
			}
		}

		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`Aucune commande au nom ${interaction.commandName} a été enregistrée.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: '# Oups!\n\nUne erreur est survenue de nôtre côté. Nous sommes désolé pour l\'inconvénience.', flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: '# Oups!\n\nUne erreur est survenue de nôtre côté. Nous sommes désolé pour l\'inconvénience.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};
