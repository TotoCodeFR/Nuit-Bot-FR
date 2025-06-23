import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { log } from '../../utility/log.js';

export default {
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Permet de bannir un utilisateur.')
        .addUserOption(option => option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à bannir')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('durée')
            .setDescription('La durée du bannissement (ex: 1j, 2h, 30m)')
            .setRequired(false)
        )
        .addStringOption(option => option
            .setName('raison')
            .setDescription('La raison du bannissement')
            .setRequired(false)
        ),
	async execute(interaction) {
		await interaction.deferReply();

        if (!interaction.member.permissions.has('BanMembers')) {
            return interaction.editReply({ content: '⚠️ Vous n\'avez pas la permission de bannir des membres.', flags: MessageFlags.Ephemeral });
        }

        const user = interaction.options.getUser('utilisateur');
        const duration = interaction.options.getString('durée');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return interaction.editReply({ content: '⚠️ L\'utilisateur ne se trouve pas sur le serveur.', flags: MessageFlags.Ephemeral });
        }

        if (!member.bannable) {
            return interaction.editReply({ content: '⚠️ Je ne peux pas bannir cet utilisateur.', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setColor('#ff6464')
            .setTitle('Confirmation · Bannir un utilisateur')
            .setDescription(`Êtes-vous sûr de vouloir bannir ${user.tag} ?`)
            .addFields(
                { name: 'Raison', value: reason },
                { name: 'Durée', value: duration || 'Permanent' }
            )
            .setTimestamp()
            .setFooter({ text: `${interaction.user.username} contrôle cette action.`, iconURL: interaction.user.displayAvatarURL() });
        
        const confirm = new ButtonBuilder()
            .setCustomId('confirm')
            .setLabel('Confirmer')
            .setStyle('Danger');
        
        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Annuler')
            .setStyle('Secondary');
        
        const row = new ActionRowBuilder()
            .addComponents(confirm, cancel);

        const response = await interaction.editReply({ embeds: [embed], components: [row] });

        let filter = i => (i.customId === 'confirm' || i.customId === 'cancel') && i.user.id === interaction.user.id;

        try {
            const confirmation = await interaction.channel.awaitMessageComponent({ filter: filter, time: 60000 });

            if (confirmation.customId === 'confirm') {
                await interaction.guild.members.ban(member, { reason: reason });

                // Gestion du bannissement temporaire
                const ms = parseDuration(duration);
                if (ms) {
                    setTimeout(async () => {
                        try {
                            await interaction.guild.members.unban(user.id, 'Fin du bannissement temporaire');
                        } catch (e) {
                            // L'utilisateur est peut-être déjà débanni
                        }
                    }, ms);
                }

                const completedEmbed = new EmbedBuilder()
                    .setColor('#64ff64')
                    .setTitle('Bannir un utilisateur')
                    .setDescription(`${user.tag} a été banni.`)
                    .addFields(
                        { name: 'Raison', value: reason },
                        { name: 'Durée', value: duration || 'Permanent' }
                    )
                    .setTimestamp()
                    .setFooter({ text: `${interaction.user.username} a exécuté cette action.`, iconURL: interaction.user.displayAvatarURL() });
                await confirmation.update({ components: [], embeds: [ completedEmbed ] });
                log({
                    title: 'Bannissement',
                    description: `${user.tag} a été banni par ${interaction.user.tag}.`,
                    color: '#ff6464'
                }, interaction.guild);
            } else if (confirmation.customId === 'cancel') {
                await confirmation.update({ content: '❌ La demande a été annulé.', components: [], embeds: [] });
            }
        } catch (error) {
            console.error('Erreur lors de la confirmation du bannissement:', error);
            return interaction.editReply({ content: '⏰ Temps écoulé pour la confirmation.', flags: MessageFlags.Ephemeral, components: [], embeds: [] });
        }
	},
};

function parseDuration(str) {
    if (!str) return null;
    str = str.toLowerCase().replace(/\s/g, '');
    const regex = /(\d+)\s*(j|jour|jours|h|heure|heures|m|min|minute|minutes|s|sec|seconde|secondes)/g;
    let match, ms = 0;
    while ((match = regex.exec(str)) !== null) {
        const value = parseInt(match[1]);
        switch (match[2]) {
            case 'j':
            case 'jour':
            case 'jours':
                ms += value * 24 * 60 * 60 * 1000;
                break;
            case 'h':
            case 'heure':
            case 'heures':
                ms += value * 60 * 60 * 1000;
                break;
            case 'm':
            case 'min':
            case 'minute':
            case 'minutes':
                ms += value * 60 * 1000;
                break;
            case 's':
            case 'sec':
            case 'seconde':
            case 'secondes':
                ms += value * 1000;
                break;
        }
    }
    return ms || null;
}