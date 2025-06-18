// events/interactionCreate.js
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Aucune commande correspondant à ${interaction.commandName} n'a été trouvée.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Une erreur s\'est produite lors de l\'exécution de cette commande !', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Une erreur s\'est produite lors de l\'exécution de cette commande !', ephemeral: true });
            }
        }
    },
};