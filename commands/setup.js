// commands/setup.js
const { SlashCommandBuilder } = require('discord.js');
const { Server } = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets the channel for music conversions.') // Translated
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the bot will listen for links.') // Translated
                .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        try {
            await Server.upsert({
                guildId: interaction.guild.id,
                channelId: channel.id,
            });

            // Translated
            await interaction.reply({ content: `The music channel has been set to ${channel}.`, ephemeral: true });
        } catch (error) {
            console.error('Error during setup:', error);
            // Translated
            await interaction.reply({ content: 'An error occurred during setup.', ephemeral: true });
        }
    },
};