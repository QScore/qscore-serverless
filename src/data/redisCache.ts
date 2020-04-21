import { Redis as RedisInterface } from "ioredis";
import { Event, EventType } from './model/Types';

const leaderboard24Key = "leaderboard24"
const leaderboardAllTimeKey = "leaderboardAllTime"

export interface LeaderboardScoreRedis {
    userId: string,
    score: number,
    rank: number
}

export interface LatestEventRedis {
    userId: string,
    eventType: EventType,
    timestamp: string, //ISO formatted
    scoreUpdatedTs: string
}

export class RedisCache {
    private redis: RedisInterface

    constructor(redis: RedisInterface) {
        this.redis = redis
    }

    async saveAllTimeScore(userId: string, score: number): Promise<void> {
        await this.redis.set(`USER:${userId}:lastScoreCalc`, Date.now())
        await this.redis.zadd(leaderboardAllTimeKey, score.toString(), `USER:${userId}`)
    }

    async getTopLeaderboardScores(limit: number): Promise<LeaderboardScoreRedis[]> {
        //Get scores from redis
        const result = await this.redis.zrevrange(leaderboard24Key, 0, limit - 1, 'WITHSCORES')

        //Separate user ids and scores
        const userIds = result
            .filter((_, index) => { return index % 2 === 0; })
            .map((key) => { return key.split(":")[1] })
        const scores = result
            .filter((_, index) => { return index % 2 != 0; })

        return userIds.map((userId, index) => {
            return {
                userId: userId,
                score: parseInt(scores[index]),
                rank: index + 1
            }
        })
    }

    async setLatestEvent(event: Event): Promise<string> {
        const key = this.getLatestEventKey(event.userId)
        const timestampMillis = new Date(event.timestamp).getTime()
        return this.redis.set(key, `${event.eventType}:${timestampMillis}:-1`)
    }

    async getLatestEvent(userId: string): Promise<LatestEventRedis | null> {
        //Example: HOME:100:-1
        const key = this.getLatestEventKey(userId)
        const result = await this.redis.get(key)
        if (!result) {
            return null
        }
        const [eventType, timestamp, scoreUpdatedTimestamp] = result.split(":")
        return {
            userId: userId,
            eventType: <EventType>eventType,
            timestamp: new Date(parseInt(timestamp)).toISOString(),
            scoreUpdatedTs: scoreUpdatedTimestamp
        }
    }

    async saveLeaderboard24Score(userId: string, score: number): Promise<void> {
        await this.redis.zadd(leaderboard24Key, score.toString(), `USER:${userId}`)
    }

    async getLastScoreCalcTs(userId: string): Promise<string | undefined> {
        const latestEvent = await this.getLatestEvent(userId)
        return latestEvent?.scoreUpdatedTs ?? undefined
    }

    private getLatestEventKey(userId: string) {
        return `USER:${userId}:latestEvent`
    }


}