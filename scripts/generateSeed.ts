/**
 * USAGE: npx ts-node ./scripts/generateSeed.ts
 */

import { UserDynamo, EventDynamo, EventType, FollowDynamo, SearchDynamo } from '../src/data/model/Types';
import faker from 'faker'
import fs from 'fs';

faker.seed(123);
const numUsers = 8
const maxEventsPerUser = 5

const users: UserDynamo[] = []
const events: EventDynamo[] = []
const searches: SearchDynamo[] = []
const userIds: string[] = []
for (let i = 0; i < numUsers; i++) {
    //Add users
    const userId = faker.random.uuid()
    userIds.push(userId)
    const username = faker.internet.userName(faker.name.firstName(i), faker.name.lastName(i))
    const allTimeScore = faker.random.number(100000)
    const userDynamo: UserDynamo = {
        PK: `USER#${userId}`,
        SK: `EVENT#9999`,
        GS1PK: `SCORE#ALL_TIME`,
        GS1SK: allTimeScore.toString(),
        itemType: `User`,
        userId: userId,
        username: username,
        followerCount: faker.random.number(10000),
        followingCount: faker.random.number(10000),
        allTimeScore: allTimeScore
    }
    users.push(userDynamo)

    //Add searches
    const searchDynamo: SearchDynamo = {
        PK: `SEARCH`,
        SK: username.toLowerCase(),
        username: username,
        userId: userId
    }
    searches.push(searchDynamo)

    //Add events for each user
    const twoDays = 2 * 24 * 60 * 60 * 1000
    const maxEvents = faker.random.number(maxEventsPerUser)
    for (let i = 0; i < maxEvents; i++) {
        let atHome: EventType
        if (faker.random.number(1) % 2 == 0) {
            atHome = "HOME"
        } else {
            atHome = "AWAY"
        }
        const timestampUnix = faker.random.number(twoDays)
        const timestampIso = new Date(timestampUnix).toISOString()
        events.push({
            PK: `USER#${userId}`,
            SK: `EVENT#${timestampIso}`,
            eventType: atHome,
            timestamp: timestampIso,
            itemType: 'Event',
            userId: userId
        })
    }
}

//Add followers / following for each user
const follows: FollowDynamo[] = []
users.forEach((user) => {
    const numFollowing = faker.random.number(5)
    const followingUserIds = [user.userId]
    for (let i = 0; i < numFollowing; i++) {
        const randomUserIdToFollow = userIds[faker.random.number(userIds.length - 1)]
        if (!followingUserIds.includes(randomUserIdToFollow)) {
            followingUserIds.push(randomUserIdToFollow)
            const followingItem: FollowDynamo = {
                PK: `USER#${user.userId}`,
                SK: `FOLLOWING#${randomUserIdToFollow}`,
                GS1PK: `USER#${randomUserIdToFollow}`,
                GS1SK: `FOLLOWER#${user.userId}`,
                itemType: 'Follow',
                followingUserId: randomUserIdToFollow,
                userId: user.userId
            }
            follows.push(followingItem)
        }
    }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allItems: any = []
allItems.push(users)
allItems.push(searches)
allItems.push(events)
// allItems.push(follows)
const result = [].concat(...allItems)
const fileName = 'test/seed/usersV2.json'
fs.writeFileSync(fileName, JSON.stringify(result))
console.log(`Wrote ${result.length} items to ${fileName}`)