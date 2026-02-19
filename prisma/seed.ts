import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPER_ADMIN_PHONE = '+15550000001';
const STORE_OWNER_PHONE = '+15550000002';
const SELLER_PHONE = '+15550000003';

async function main() {
  // Super Admin — login via OTP only
  await prisma.user.upsert({
    where: { phone: SUPER_ADMIN_PHONE },
    update: { role: 'SUPER_ADMIN' },
    create: { phone: SUPER_ADMIN_PHONE, role: 'SUPER_ADMIN' },
  });

  // Store Owner — created by super admin, login via OTP only
  const storeOwner = await prisma.user.upsert({
    where: { phone: STORE_OWNER_PHONE },
    update: { role: 'PARTNER_OWNER' },
    create: { phone: STORE_OWNER_PHONE, role: 'PARTNER_OWNER' },
  });

  let partner = await prisma.partner.findFirst({ where: { ownerId: storeOwner.id } });
  if (!partner) {
    partner = await prisma.partner.create({
      data: { businessName: 'Seed Cafe', industryType: 'F&B', ownerId: storeOwner.id },
    });
  }

  let branch = await prisma.branch.findFirst({ where: { partnerId: partner.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        branchName: 'Main Branch',
        partnerId: partner.id,
        settings: { streakThreshold: 20, cooldownHours: 3 },
      },
    });
  }

  // Seller — login via OTP only, no password
  await prisma.staff.upsert({
    where: { branchId_phone: { branchId: branch.id, phone: SELLER_PHONE } },
    update: {},
    create: { name: 'Seed Seller', phone: SELLER_PHONE, branchId: branch.id },
  });

  console.log('Seeded:');
  console.log('  Super Admin :', SUPER_ADMIN_PHONE, '→ OTP login (dev OTP: 1111)');
  console.log('  Store Owner :', STORE_OWNER_PHONE, '→ OTP login (dev OTP: 1111)');
  console.log('    Store     :', partner.businessName, `(id: ${partner.id})`);
  console.log('    Branch    :', branch.branchName, `(id: ${branch.id})`);
  console.log('  Seller      :', SELLER_PHONE, '→ OTP login (dev OTP: 1111)');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
