import { SlashCommandBuilder } from 'discord.js';
import { loadConfig, writeToConfig } from '../../utility/server_config.js';

export default {
	data: new SlashCommandBuilder()
		.setName('warn')
		.setDescription('Avertis un utilisateur.')
        .addUserOption(option => option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à avertir')
            .setRequired(true))
        .addStringOption(option => option
            .setName('raison')
            .setDescription('La raison de l\'avertissement')
            .setRequired(false)
        ),
	async execute(interaction) {
        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
        
        try {
            const currentConfig = loadConfig(interaction.guild.id);
            if (!currentConfig.users.hasOwnProperty(user.id)) {
                currentConfig.users[user.id] = { warnings: {} };
            }

            const warningId = Date.now().toString(); // Unique ID for the warning
            currentConfig.users[user.id].warnings[warningId] = {
                reason: reason,
                timestamp: new Date().toISOString(),
                moderator: interaction.user.id
            };

            writeToConfig(interaction.guild.id, currentConfig);

            await user.send(`Vous avez été averti dans le serveur ${interaction.guild.name} pour la raison suivante : ${reason}`);
            await interaction.reply({ content: `Avertissement envoyé à ${user.username} pour la raison : ${reason}`, ephemeral: true });
            console.log(`Avertissement envoyé à ${user.username} dans le serveur ${interaction.guild.name} pour la raison : ${reason}`);
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message privé :', error);
            await interaction.reply({ content: 'Impossible d\'envoyer un message privé à cet utilisateur.', ephemeral: true });
        }
	},
};
