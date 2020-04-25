import * as chai from 'chai';
import chaiHttp = require('chai-http');
import { assert } from 'chai';
import { User, Event } from '../../src/data/model/Types';
import { FollowUserPayloadGql, UpdateUserInfoPayloadGql } from '../../src/graphql/types/userInterfaces';
import { seedDatabase } from '../util/seeder';

chai.use(chaiHttp)

const lonnieId = "bb463b8b-b76c-4f6a-9726-65ab5730b69b"

describe('Graphql API requests', () => {
  it('Test search users request', async () => {
    const sendBody = {
      query: `{
                searchUsers(input:{
                  searchQuery: "lonnie"
                }) {
                  users {
                    userId,
                    username,
                    score,
                    allTimeScore,
                    isCurrentUserFollowing,
                    followingCount,
                    followerCount
                  }
                }
              }`
    }

    const result = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody)
    const json = JSON.parse(result.text)

    const usersArray = json.data.searchUsers.users
    assert.equal(usersArray[0].username, "Lonnie.Deckow")
  })

  it('Test get current user request', async () => {
    const sendBody = {
      query: `query GetCurrentUser {
                  currentUser {
                    user {
                      userId,
                      username,
                      score
                    }
                  }
                }`
    }

    const result = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody)

    const json = JSON.parse(result.text)
    const currentUser: User = json.data.currentUser.user
    assert.equal(currentUser.username, "Lonnie.Deckow")
  })

  it('Test create geofence event', async () => {
    const sendBody = {
      query: `
                  mutation CreateGeofenceEvent{
                    createGeofenceEvent(input: {
                      eventType: HOME
                    }) {
                      geofenceEvent {
                        userId
                        timestamp
                        eventType
                      }
                    }
                  }
                `

    }

    const result = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody)

    const json = JSON.parse(result.text)
    const event: Event = json.data.createGeofenceEvent.geofenceEvent
    assert.equal(event.userId, "bb463b8b-b76c-4f6a-9726-65ab5730b69b")
  })

  it('Test follow user', async () => {
    const userIdtoFollow = "b95b65a5-5334-4fac-9c60-6272614e6ceb"
    const sendBody = {
      query: `
              mutation FollowUser {
                followUser(input: {
                  userId: "${userIdtoFollow}"
                }) {
                  userId
                }
              }
                `
    }

    const result = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody)

    const payload: FollowUserPayloadGql = JSON.parse(result.text).data.followUser
    assert.equal(payload.userId, userIdtoFollow)
  })

  it('Test unfollow user', async () => {
    const userIdToUnfollow = "b95b65a5-5334-4fac-9c60-6272614e6ceb"
    const sendBody = {
      query: `
              mutation UnfollowUser {
                unfollowUser(input: {
                  userId: "${userIdToUnfollow}"
                }) {
                  userId
                }
              }
                `
    }

    const result = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody)

    const payload: FollowUserPayloadGql = JSON.parse(result.text).data.unfollowUser
    assert.equal(payload.userId, userIdToUnfollow)
  })

  it('Test update user info', async () => {
    const sendBody = {
      query: `
              mutation UpdateUserInfo{
                updateUserInfo(input:{
                  username:"ZZZ"
                }) {
                  id,
                  username
                }
              }
                `
    }

    const result = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody)

    const payload: UpdateUserInfoPayloadGql = JSON.parse(result.text).data.updateUserInfo
    assert.equal(payload.id, lonnieId)
    assert.equal(payload.username, "ZZZ")

    const sendBody2 = {
      query: `
              mutation UpdateUserInfo{
                updateUserInfo(input:{
                  username:"Lonnie.Deckow"
                }) {
                  id,
                  username
                }
              }
                `
    }

    const result2 = await chai
      .request("http://localhost:3000")
      .post('/dev/graphql')
      .send(sendBody2)

    const payload2: UpdateUserInfoPayloadGql = JSON.parse(result2.text).data.updateUserInfo
    assert.equal(payload2.id, lonnieId)
    assert.equal(payload2.username, "Lonnie.Deckow")
  })
})