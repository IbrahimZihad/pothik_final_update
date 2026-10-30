'use strict';

const { z } = require('zod');
const { isValidDate } = require('../utils/dates');

const id = z.coerce.number().int().positive();
const idParam = z.object({ id });
const slugParam = z.object({ slug: z.string().min(1).max(200) });

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(12),
  sort: z.string().max(60).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(120).optional(),
});

const dateString = z
  .string()
  .refine((value) => isValidDate(value), { message: 'Date must be in YYYY-MM-DD format' });

const phone = z
  .string()
  .trim()
  .regex(/^(\+?880|0)1[3-9]\d{8}$/, 'Enter a valid Bangladeshi mobile number');

const email = z.string().trim().toLowerCase().email().max(190);

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const money = z.coerce.number().finite().nonnegative().max(100000000);

const statusEnum = (values) => z.enum(values);

module.exports = { id, idParam, slugParam, paginationQuery, dateString, phone, email, password, money, statusEnum };
