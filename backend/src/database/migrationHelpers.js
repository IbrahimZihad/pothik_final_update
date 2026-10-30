'use strict';

/**
 * Shared column helpers so migrations stay declarative and portable between
 * MySQL (production) and SQLite (local tests).
 */
function helpers(Sequelize, sequelize) {
  const { DataTypes } = Sequelize;
  const mysql = sequelize.getDialect() === 'mysql';

  const tableOptions = mysql ? { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' } : {};

  const id = {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  };

  const intId = {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  };

  const timestamps = {
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  };

  const money = (allowNull = false, defaultValue) => ({
    type: DataTypes.DECIMAL(12, 2),
    allowNull,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  });

  const decimal = (precision, scale, allowNull = true) => ({
    type: DataTypes.DECIMAL(precision, scale),
    allowNull,
  });

  const fkBig = (table, { allowNull = false, onDelete = 'RESTRICT' } = {}) => ({
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull,
    references: { model: table, key: 'id' },
    onDelete,
    onUpdate: 'CASCADE',
  });

  const fkInt = (table, { allowNull = false, onDelete = 'RESTRICT' } = {}) => ({
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull,
    references: { model: table, key: 'id' },
    onDelete,
    onUpdate: 'CASCADE',
  });

  return { DataTypes, id, intId, timestamps, money, decimal, fkBig, fkInt, tableOptions };
}

module.exports = { helpers };
