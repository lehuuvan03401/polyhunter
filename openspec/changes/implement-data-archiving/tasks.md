# Tasks: Implement Data Archiving

- [x] **Specs & Design** <!-- id: 0 -->
    - [x] Create spec for Archiving Engine. <!-- id: 1 -->

- [x] **Implementation** <!-- id: 2 -->
    - [x] **Schema**: Add `CopyTradeArchive` and `CommissionLogArchive` to `schema.prisma`. <!-- id: 3 -->
    - [x] **Migration**: Run `prisma migrate dev --name add_archives`. <!-- id: 4 -->
    - [x] **Script**: Create `scripts/archive-data.ts` with batching logic. <!-- id: 5 -->
    - [x] **Package**: Add `npm run archive-data` to `package.json`. <!-- id: 6 -->

- [x] **Verification** <!-- id: 7 -->
    - [x] **Test Run**: Insert dummy old records and run script to verify they move to archive. <!-- id: 8 -->
