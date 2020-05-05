import {Redis as RedisInterface} from "ioredis";
import {Event, EventType} from './model/types';

const leaderboardAllTimeKey = "leaderboardAllTime"
const lastUpdatedPartialKey = "LASTUPDATED"

export interface LeaderboardScoreRedis {
    readonly userId: string
    readonly score: number
    readonly rank: number
}

export interface LatestEventRedis {
    readonly userId: string
    readonly eventType: EventType
    readonly timestamp: string //ISO formatted
}

export class RedisCache {
    private redis: RedisInterface

    constructor(redis: RedisInterface) {
        this.redis = redis
    }

    private getLastUpdatedKey(userId: String) {
        return `${lastUpdatedPartialKey}:${userId}`
    }


    async getAllTimeScore(userId: string): Promise<number> {
        const result = await this.redis.zscore(leaderboardAllTimeKey, `USER:${userId}`) ?? "0"
        return parseInt(result)
    }

    async getLeaderboardRank(userId: string): Promise<number> {
        const rank = await this.redis.zrevrank(leaderboardAllTimeKey, `USER:${userId}`) ?? -1
        return rank
    }

    async getLastUpdatedTime(userId: string): Promise<number | undefined> {
        const lastUpdatedStr = await this.redis.get(this.getLastUpdatedKey(userId)) ?? undefined
        if (lastUpdatedStr) {
            return parseInt(lastUpdatedStr)
        }
        return undefined
    }

    async saveScoreToLeaderboard(userId: string, score: number): Promise<void> {
        await this.redis.zadd(leaderboardAllTimeKey, score.toString(), `USER:${userId}`)
    }

    async getLeaderboardScoreRange(min: number, max: number): Promise<LeaderboardScoreRedis[]> {
        //Get scores from redis
        const result = await this.redis.zrevrange(leaderboardAllTimeKey, min, max, 'WITHSCORES')

        //Separate user ids and scores
        const userIds = result
            .filter((_, index) => {
                return index % 2 === 0;
            })
            .map((key) => {
                return key.split(":")[1]
            })
        const scores = result
            .filter((_, index) => {
                return index % 2 != 0;
            })

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
        const key = this.getLatestEventKey(userId)
        const result = await this.redis.get(key)
        if (!result) {
            return null
        }
        const [eventType, timestamp] = result.split(":")
        return {
            userId: userId,
            eventType: eventType as EventType,
            timestamp: new Date(parseInt(timestamp)).toISOString(),
        }
    }

    private getLatestEventKey(userId: string): string {
        return `USER:${userId}:latestEvent`
    }

    async updateLastUpdatedTime(userId: string) {
        await this.redis.set(this.getLastUpdatedKey(userId), Date.now().toString())
    }
}