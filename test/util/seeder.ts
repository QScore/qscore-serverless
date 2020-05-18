import * as seeder from 'serverless-dynamodb-local/src/seeder'
import {testInjector} from "../../src/data/testInjector";

export async function seedDatabase(): Promise<void> {
    const source = {
        table: 'events',
        sources: ['./test/seed/usersV2.json']
    };

    const seeds = await seeder.locateSeeds(source.sources)
    await seeder.writeSeeds(testInjector.localDocumentClient.batchWrite.bind(testInjector.localDocumentClient), source.table, seeds)
}
