// commands/reset.js
const { SlashCommandBuilder } = require('discord.js');
const { Server } = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('The channel configuration has been reset..'),
    async execute(interaction) {
        try {
            const server = await Server.findOne({ where: { guildId: interaction.guild.id } });

            if (server) {
                await server.update({ channelId: null });
                await interaction.reply({ content: 'The channel configuration has been reset.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'No configuration to reset for this server', ephemeral: true });
            }
        } catch (error) {
            console.error('Error during reset:', error);
            await interaction.reply({ content: 'An error occurred during reset.', ephemeral: true });
        }
    },
};