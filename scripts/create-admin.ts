import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("==================================================");
  console.log("Grand Horizon HMS — Create System Administrator");
  console.log("==================================================");

  let email = process.argv[2];
  let fullName = process.argv[3];
  let password = process.argv[4];

  if (!email) {
    email = await prompt("Enter Administrator Email: ");
  }
  if (!fullName) {
    fullName = await prompt("Enter Administrator Full Name: ");
  }
  if (!password) {
    password = await prompt("Enter Secure Password (min 8 characters): ");
  }

  if (!email || !email.includes("@")) {
    console.error("Error: Valid email address is required.");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email,
      fullName: fullName || "System Administrator",
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log("--------------------------------------------------");
  console.log(`✓ System Administrator account successfully created/updated!`);
  console.log(`  User ID: ${admin.id}`);
  console.log(`  Email:   ${admin.email}`);
  console.log(`  Role:    ${admin.role}`);
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("Failed to create admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
