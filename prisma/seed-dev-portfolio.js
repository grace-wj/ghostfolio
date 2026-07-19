/**
 * Development-only sample portfolio seed (idempotent).
 *
 * Creates a dedicated user with a fully valued, reproducible portfolio using
 * `MANUAL` symbols plus fixed `MarketData` fixtures, so the Overview renders
 * real holdings and a non-flat performance chart WITHOUT any live market data
 * (Yahoo / Alpha Vantage). Safe to re-run.
 *
 * Log in via the security token printed at the end (Sign in -> Security Token).
 */
const crypto = require('crypto');
const { AccountType, DataSource, Provider, Role, Type } = require('@prisma/client');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ACCOUNT_ID = '00000000-0000-4000-8000-0000000000a1';
// Fixed raw security token used to sign in as the sample user.
const RAW_ACCESS_TOKEN =
  'b3207d3f9e0a4a3e8f7c1d2b5a6e9f0c1234567890abcdef';

// dataSource is MANUAL so prices come only from the MarketData table below.
const SYMBOLS = [
  {
    id: '00000000-0000-4000-8000-0000000000b1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'EQUITY',
    assetSubClass: 'STOCK',
    countries: [{ code: 'US', weight: 1 }],
    sectors: [{ name: 'Technology', weight: 1 }],
    startPrice: 150,
    endPrice: 230
  },
  {
    id: '00000000-0000-4000-8000-0000000000b2',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    assetClass: 'EQUITY',
    assetSubClass: 'STOCK',
    countries: [{ code: 'US', weight: 1 }],
    sectors: [{ name: 'Technology', weight: 1 }],
    startPrice: 250,
    endPrice: 450
  },
  {
    id: '00000000-0000-4000-8000-0000000000b3',
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    assetClass: 'EQUITY',
    assetSubClass: 'ETF',
    countries: [{ code: 'US', weight: 1 }],
    sectors: [{ name: 'Technology', weight: 0.3 }],
    startPrice: 350,
    endPrice: 500
  }
];

const ORDERS = [
  {
    id: '00000000-0000-4000-8000-0000000000c1',
    symbol: 'AAPL',
    date: Date.UTC(2022, 0, 3),
    quantity: 20,
    unitPrice: 150,
    fee: 4.95
  },
  {
    id: '00000000-0000-4000-8000-0000000000c2',
    symbol: 'MSFT',
    date: Date.UTC(2022, 1, 1),
    quantity: 15,
    unitPrice: 250,
    fee: 4.95
  },
  {
    id: '00000000-0000-4000-8000-0000000000c3',
    symbol: 'VOO',
    date: Date.UTC(2022, 2, 1),
    quantity: 12,
    unitPrice: 350,
    fee: 4.95
  },
  {
    id: '00000000-0000-4000-8000-0000000000c4',
    symbol: 'AAPL',
    date: Date.UTC(2023, 5, 1),
    quantity: 10,
    unitPrice: 180,
    fee: 4.95
  }
];

const HISTORY_START = Date.UTC(2022, 0, 1);
// Hardcoded end of the fixture window so the seeded portfolio is fully
// reproducible regardless of when the seed runs (do NOT use new Date()).
const HISTORY_END = Date.UTC(2024, 11, 2);

function buildMarketData() {
  const rows = [];
  const end = HISTORY_END;
  const span = end - HISTORY_START;

  for (const { symbol, startPrice, endPrice } of SYMBOLS) {
    const dates = [];

    // Monthly data points from the history start to the current month.
    let year = 2022;
    let month = 0;
    while (Date.UTC(year, month, 1) <= end) {
      dates.push(Date.UTC(year, month, 1));
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    // Ensure there is a data point at the fixed end date for the current quote.
    if (dates[dates.length - 1] !== end) {
      dates.push(end);
    }

    for (const dateMs of dates) {
      const fraction = span === 0 ? 1 : (dateMs - HISTORY_START) / span;
      const trend = startPrice + (endPrice - startPrice) * fraction;
      // Deterministic wiggle so the chart is not a straight line.
      const wiggle = startPrice * 0.06 * Math.sin(fraction * 4 * Math.PI);
      const marketPrice = Math.round((trend + wiggle) * 100) / 100;

      rows.push({
        dataSource: DataSource.MANUAL,
        date: new Date(dateMs),
        marketPrice,
        symbol
      });
    }
  }

  return rows;
}

async function main() {
  const salt = process.env.ACCESS_TOKEN_SALT;

  if (!salt) {
    throw new Error('ACCESS_TOKEN_SALT is not set');
  }

  const hashedAccessToken = crypto
    .createHmac('sha512', salt)
    .update(RAW_ACCESS_TOKEN)
    .digest('hex');

  await prisma.user.upsert({
    create: {
      accessToken: hashedAccessToken,
      id: USER_ID,
      provider: Provider.ANONYMOUS,
      role: Role.USER
    },
    update: { accessToken: hashedAccessToken },
    where: { id: USER_ID }
  });

  await prisma.account.upsert({
    create: {
      accountType: AccountType.SECURITIES,
      balance: 0,
      currency: 'USD',
      id: ACCOUNT_ID,
      isDefault: true,
      name: 'Sample Brokerage',
      userId: USER_ID
    },
    update: {},
    where: { id_userId: { id: ACCOUNT_ID, userId: USER_ID } }
  });

  for (const s of SYMBOLS) {
    await prisma.symbolProfile.upsert({
      create: {
        assetClass: s.assetClass,
        assetSubClass: s.assetSubClass,
        countries: s.countries,
        currency: 'USD',
        dataSource: DataSource.MANUAL,
        id: s.id,
        name: s.name,
        sectors: s.sectors,
        symbol: s.symbol
      },
      update: { name: s.name },
      where: { dataSource_symbol: { dataSource: DataSource.MANUAL, symbol: s.symbol } }
    });
  }

  await prisma.marketData.createMany({
    data: buildMarketData(),
    skipDuplicates: true
  });

  const symbolProfileIdBySymbol = Object.fromEntries(
    SYMBOLS.map((s) => [s.symbol, s.id])
  );

  await prisma.order.createMany({
    data: ORDERS.map((o) => ({
      accountId: ACCOUNT_ID,
      accountUserId: USER_ID,
      date: new Date(o.date),
      fee: o.fee,
      id: o.id,
      quantity: o.quantity,
      symbolProfileId: symbolProfileIdBySymbol[o.symbol],
      type: Type.BUY,
      unitPrice: o.unitPrice,
      userId: USER_ID
    })),
    skipDuplicates: true
  });

  console.log('Sample portfolio seeded.');
  console.log(`User id: ${USER_ID}`);
  console.log(`Security token (Sign in -> Security Token): ${RAW_ACCESS_TOKEN}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
