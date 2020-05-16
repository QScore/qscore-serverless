import * as seeder from 'serverless-dynamodb-local/src/seeder'
import { localDocumentClient } from '../../src/data/testInjector';

export async function seedDatabase(): Promise<void> {
    const source = {
        table: 'events',
        sources: ['./test/seed/usersV2.json']
    };

    const seeds = await seeder.locateSeeds(source.sources)
    await seeder.writeSeeds(localDocumentClient.batchWrite.bind(localDocumentClient), source.table, seeds)
}
