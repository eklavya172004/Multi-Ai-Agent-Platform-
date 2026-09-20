import prisma from "../../../shared/config/db.js"

async function connectToDB(){
  try {
    await prisma.$connect();
    console.log("Connected to Neon PostgreSQL");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
}

export default connectToDB;