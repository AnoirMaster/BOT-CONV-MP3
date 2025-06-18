// db/database.js
const { Sequelize, DataTypes } = require('sequelize');

// Initialiser la connexion à la base de données SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'db/database.sqlite',
    logging: false,
});

// Définir le modèle pour les serveurs
const Server = sequelize.define('Server', {
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    channelId: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

// Synchroniser la base de données
sequelize.sync();

module.exports = { Server };