import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { log } from '../../utility/log.js';

export default {
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Permet d\'expulser un utilisateur.')
        .addUserOption(option => option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à expulser')
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('raison')
            .setDescription('La raison de l\'expulsion')
            .setRequired(false)
        ),
	async execute(interaction) {
		await interaction.deferReply();

        if (!interaction.member.permissions.has('KickMembers')) {
            return interaction.editReply({ content: '⚠️ Vous n\'avez pas la permission d\'expulser des membres.', flags: MessageFlags.Ephemeral });
        }

        const user = interaction.options.getUser('utilisateur');
        const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            return interaction.editReply({ content: '⚠️ L\'utilisateur ne se trouve pas sur le serveur.', flags: MessageFlags.Ephemeral });
        }

        if (!member.kickable) {
            return interaction.editReply({ content: '⚠️ Je ne peux pas expulser cet utilisateur.', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setColor('#ff6464')
            .setTitle('Confirmation · Expulser un utilisateur')
            .setDescription(`Êtes-vous sûr de vouloir expulser ${user.tag} ?`)
            .addFields(
                { name: 'Raison', value: reason }
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
                await interaction.guild.members.kick(member, { reason: reason });
                const completedEmbed = new EmbedBuilder()
                    .setColor('#64ff64')
                    .setTitle('Expulser un utilisateur')
                    .setDescription(`${user.tag} a été expulsé.`)
                    .addFields(
                        { name: 'Raison', value: reason }
                    )
                    .setTimestamp()
                    .setFooter({ text: `${interaction.user.username} a exécuté cette action.`, iconURL: interaction.user.displayAvatarURL() });
                await confirmation.update({ components: [], embeds: [ completedEmbed ] });
                log({
                    title: 'Expulsion',
                    description: `${user.tag} a été expulsé par ${interaction.user.tag}.`,
                    color: '#ff6464'
                }, interaction.guild);
            } else if (confirmation.customId === 'cancel') {
                await confirmation.update({ content: '❌ La demande a été annulé.', components: [], embeds: [] });
            }
        } catch (error) {
            console.error('Erreur lors de la confirmation de l\'expulsion:', error);
            return interaction.editReply({ content: '⏰ Temps écoulé pour la confirmation.', flags: MessageFlags.Ephemeral, components: [], embeds: [] });
        }
	},
};