import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const hotelId = randomUUID();
  const otherHotelId = randomUUID();
  const userId = randomUUID();
  const journalId = randomUUID();
  const debitAccountId = randomUUID();
  const creditAccountId = randomUUID();
  const foreignAccountId = randomUUID();

  await client.query(
    `INSERT INTO "Hotel" (id,code,name,"updatedAt") VALUES
      ($1,$2,'Accounting Verification Hotel',now()),
      ($3,$4,'Foreign Verification Hotel',now())`,
    [
      hotelId,
      `AV-${hotelId.slice(0, 8).toUpperCase()}`,
      otherHotelId,
      `FV-${otherHotelId.slice(0, 8).toUpperCase()}`,
    ],
  );
  await client.query(
    `INSERT INTO "User" (id,"hotelId",email,username,"passwordHash","fullName","updatedAt")
     VALUES ($1,$2,$3,$4,'not-used','Accounting Verifier',now())`,
    [userId, hotelId, `${userId}@example.test`, `verify-${userId}`],
  );
  await client.query(
    `INSERT INTO "AccountingJournal" (id,"hotelId",code,name,type,"updatedAt")
     VALUES ($1,$2,'VERIFY','Verification','GENERAL',now())`,
    [journalId, hotelId],
  );
  await client.query(
    `INSERT INTO "Account" (id,"hotelId",code,name,type,"normalBalance",currency,"updatedAt") VALUES
      ($1,$2,'V100','Verification Debit','ASSET','DEBIT','USD',now()),
      ($3,$2,'V300','Verification Credit','EQUITY','CREDIT','USD',now()),
      ($4,$5,'F100','Foreign Account','ASSET','DEBIT','USD',now())`,
    [debitAccountId, hotelId, creditAccountId, foreignAccountId, otherHotelId],
  );

  const balancedEntryId = randomUUID();
  await insertDraft(balancedEntryId, 'JE-VERIFY-000001');
  await insertLine(balancedEntryId, debitAccountId, '100.0000', '0');
  await insertLine(balancedEntryId, creditAccountId, '0', '100.0000');
  await client.query(
    `UPDATE "JournalEntry" SET status='POSTED',"postedById"=$1,"postedAt"=now(),"updatedAt"=now() WHERE id=$2`,
    [userId, balancedEntryId],
  );
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');

  await client.query('SAVEPOINT immutable_check');
  await expectDatabaseCode(
    () =>
      client.query(`UPDATE "JournalLine" SET debit=99 WHERE "journalEntryId"=$1 AND debit>0`, [
        balancedEntryId,
      ]),
    '55000',
  );
  await client.query('ROLLBACK TO SAVEPOINT immutable_check');

  await client.query('SET CONSTRAINTS ALL DEFERRED');
  const reversalEntryId = randomUUID();
  await client.query(
    `INSERT INTO "JournalEntry"
      (id,"hotelId","journalId","entryNumber","businessDate","postingDate","sourceType","sourceId",description,"createdById","reversedEntryId","updatedAt")
     VALUES ($1,$2,$3,'JE-VERIFY-REV',current_date,now(),'REVERSAL',$4,'Verification reversal',$5,$4,now())`,
    [reversalEntryId, hotelId, journalId, balancedEntryId, userId],
  );
  await insertLine(reversalEntryId, debitAccountId, '0', '100');
  await insertLine(reversalEntryId, creditAccountId, '100', '0');
  await client.query(
    `UPDATE "JournalEntry" SET status='POSTED',"postedById"=$1,"postedAt"=now(),"updatedAt"=now() WHERE id=$2`,
    [userId, reversalEntryId],
  );
  await client.query(
    `UPDATE "JournalEntry" SET status='REVERSED',"reversalEntryId"=$1,"reversalReason"='Verification reversal',"reversedById"=$2,"reversedAt"=now(),"updatedAt"=now() WHERE id=$3`,
    [reversalEntryId, userId, balancedEntryId],
  );
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');

  await client.query('SAVEPOINT unbalanced_check');
  const unbalancedEntryId = randomUUID();
  await insertDraft(unbalancedEntryId, 'JE-VERIFY-000002');
  await insertLine(unbalancedEntryId, debitAccountId, '10', '0');
  await insertLine(unbalancedEntryId, creditAccountId, '0', '9');
  await expectDatabaseCode(
    () =>
      client.query(
        `UPDATE "JournalEntry" SET status='POSTED',"postedById"=$1,"postedAt"=now(),"updatedAt"=now() WHERE id=$2`,
        [userId, unbalancedEntryId],
      ),
    '23514',
  );
  await client.query('ROLLBACK TO SAVEPOINT unbalanced_check');

  await client.query('SAVEPOINT tenant_check');
  const tenantEntryId = randomUUID();
  await insertDraft(tenantEntryId, 'JE-VERIFY-000003');
  await expectDatabaseCode(() => insertLine(tenantEntryId, foreignAccountId, '1', '0'), '23514');
  await client.query('ROLLBACK TO SAVEPOINT tenant_check');

  process.stdout.write(
    'Accounting database verification passed: balance, immutability, and tenant constraints.\n',
  );

  async function insertDraft(id, entryNumber) {
    await client.query(
      `INSERT INTO "JournalEntry"
        (id,"hotelId","journalId","entryNumber","businessDate","postingDate","sourceType",description,"createdById","updatedAt")
       VALUES ($1,$2,$3,$4,current_date,now(),'VERIFY','Constraint verification',$5,now())`,
      [id, hotelId, journalId, entryNumber, userId],
    );
  }

  async function insertLine(entryId, accountId, debit, credit) {
    await client.query(
      `INSERT INTO "JournalLine" (id,"journalEntryId","accountId",debit,credit,currency)
       VALUES ($1,$2,$3,$4,$5,'USD')`,
      [randomUUID(), entryId, accountId, debit, credit],
    );
  }
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}

async function expectDatabaseCode(operation, expectedCode) {
  let thrown;
  try {
    await operation();
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown?.code, expectedCode, `Expected PostgreSQL error ${expectedCode}`);
}
