import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SUPER_ADMIN_PHONE = '+15550000001';
const STORE_OWNER_PHONE = '+15550000002';
const SELLER_PHONE = '+15550000003';
const PASSWORD = 'SuperAdmin@123';

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 10);

  const superAdmin = await prisma.user.upsert({
    where: { phone: SUPER_ADMIN_PHONE },
    update: { password: hashed, role: 'SUPER_ADMIN' },
    create: {
      phone: SUPER_ADMIN_PHONE,
      password: hashed,
      role: 'SUPER_ADMIN',
    },
  });

  const storeOwner = await prisma.user.upsert({
    where: { phone: STORE_OWNER_PHONE },
    update: { password: hashed, role: 'PARTNER_OWNER' },
    create: {
      phone: STORE_OWNER_PHONE,
      password: hashed,
      role: 'PARTNER_OWNER',
    },
  });

  let partner = await prisma.partner.findFirst({ where: { ownerId: storeOwner.id } });
  if (!partner) {
    partner = await prisma.partner.create({
      data: {
        businessName: 'Seed Cafe',
        industryType: 'F&B',
        ownerId: storeOwner.id,
      },
    });
  }

  let branch = await prisma.branch.findFirst({ where: { partnerId: partner.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        branchName: 'Main Branch',
        partnerId: partner.id,
        settings: { streakThreshold: 20, cooldownHours: 18 },
      },
    });
  }

  const staffHashed = await bcrypt.hash('Seller@123', 10);
  const seller = await prisma.staff.upsert({
    where: { branchId_phone: { branchId: branch.id, phone: SELLER_PHONE } },
    update: { password: staffHashed },
    create: {
      name: 'Seed Seller',
      phone: SELLER_PHONE,
      password: staffHashed,
      branchId: branch.id,
    },
  });

  console.log('Seeded:');
  console.log('  Super Admin:', SUPER_ADMIN_PHONE, '(OTP 1111 in dev)');
  console.log('  Store Owner:', STORE_OWNER_PHONE, '(OTP 1111 in dev)');
  console.log('  Seller (Staff):', SELLER_PHONE, '(OTP 1111 in dev)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
