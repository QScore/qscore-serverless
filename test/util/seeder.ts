import * as seeder from 'serverless-dynamodb-local/src/seeder'
import { testDocumentClient } from '../../src/data/testInjector';

export async function seedDatabase(): Promise<void> {
    const source = {
        table: 'events',
        sources: ['./test/seed/usersV2.json']
    };

    const seeds = await seeder.locateSeeds(source.sources)
    console.log(">>SEEDING")
    await seeder.writeSeeds(testDocumentClient.batchWrite.bind(testDocumentClient), source.table, seeds)
}
