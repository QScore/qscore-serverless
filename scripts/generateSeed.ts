/**
 * USAGE: npx ts-node ./scripts/generateSeed.ts
 */

import { UserDynamo, EventDynamo, EventType, FollowingDynamo, FollowerDynamo } from "../src/data/model/Types"
import * as faker from 'faker'
import { v4 as uuid } from 'uuid'
import * as fs from 'fs';

const numUsers = 8
const maxEventsPerUser = 5

let users: UserDynamo[] = []
let events: EventDynamo[] = []
let userIds: string[] = []
for (let i = 0; i < numUsers; i++) {
    //Add users
    const userId = uuid()
    userIds.push(userId)
    const username = faker.internet.userName(faker.name.firstName(i), faker.name.lastName(i))
    users.push({
        PK: `USER#${userId}`,
        SK: `EVENT#9999`,
        type: `User`,
        userId: userId,
        username: username,
        usernameLowercase: username.toLowerCase(),
        followerCount: faker.random.number(10000),
        followingCount: faker.random.number(10000)
    })

    //Add events for each user
    const oneDay = 24 * 60 * 60 * 1000
    const maxEvents = faker.random.number(maxEventsPerUser)
    for (let i = 0; i < maxEvents; i++) {
        let atHome: EventType
        if (faker.random.number(1) % 2 == 0) {
            atHome = "HOME"
        } else {
            atHome = "AWAY"
        }
        const timestampUnix = faker.random.number(oneDay)
        const timestampIso = new Date(timestampUnix).toISOString()
        events.push({
            PK: `USER#${userId}`,
            SK: `EVENT#${timestampIso}`,
            eventType: atHome,
            timestamp: timestampIso,
            type: 'Event',
            userId: userId
        })
    }
}

//Add followers / following for each user
let following: FollowingDynamo[] = []
let followers: FollowerDynamo[] = []
users.forEach((user) => {
    const numFollowing = faker.random.number(5)
    const numFollowers = faker.random.number(5)
    const followingUserIds = [user.userId]
    const followerUserIds = [user.userId]
    for (let i = 0; i < numFollowing; i++) {
        const randomUserIdToFollow = userIds[faker.random.number(userIds.length - 1)]
        if (!followingUserIds.includes(randomUserIdToFollow)) {
            followingUserIds.push(randomUserIdToFollow)
            following.push({
                PK: `USER#${user.userId}`,
                SK: `FOLLOWING#${randomUserIdToFollow}`,
                type: 'Following',
                followingUserId: randomUserIdToFollow,
                userId: user.userId
            })
        }
    }

    for (let i = 0; i < numFollowers; i++) {
        const randomUserIdFollower = userIds[faker.random.number(userIds.length - 1)]
        if (!followerUserIds.includes(randomUserIdFollower)) {
            followerUserIds.push(randomUserIdFollower)
            followers.push({
                PK: `USER#${user.userId}`,
                SK: `FOLLOWER#${randomUserIdFollower}`,
                type: 'Follower',
                followerUserId: randomUserIdFollower,
                userId: user.userId
            })
        }
    }
})

const allItems = []
allItems.push(users)
allItems.push(events)
allItems.push(following)
allItems.push(followers)
const result = [].concat.apply([], allItems)
const fileName = 'test/seed/usersV2.json'
fs.writeFileSync(fileName, JSON.stringify(result))
console.log(`Wrote ${result.length} items to ${fileName}`)