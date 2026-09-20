import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;

// Unlike Mongoose, you don't call connect().
// Prisma connects automatically when you make your first query.