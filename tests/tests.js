const test = require('blue-tape')
const r = require('rethinkdb')
const testUtils = require('rethink-event-sourcing/tape-test-utils.js')
const crypto = require('crypto')

test('Interests service', t => {
  t.plan(5)

  let conn

  testUtils.connectToDatabase(t, r, (connection) => conn = connection)

  const admin = { roles: ["admin"] }

  const oldInterestData = {
    name: "test interest name",
    description: "test interest description"
  }

  const newInterestData = {
    name: "test interest name 2",
    description: "test interest description 2"
  }

  let interestId

  t.test('create interest', t => {
    t.plan(2)

    testUtils.runCommand(t, r, 'interests', {
      type: 'InterestCreate',
      client: admin,
      parameters: {
        ...oldInterestData
      }
    }, (cId) => { }).then(
      result => {
        interestId = result
      }
    )

    t.test('check if interest exists', t=> {
      t.plan(2)
      setTimeout(()=>{
        r.table('interests_Interest').get(interestId).run(conn).then(
          interestRow => {
            if(interestRow) t.pass('interest exists')
              else t.fail('interest not found')
            t.equals(interestRow.name, oldInterestData.name, 'interest display name match')
          }
        ).catch(t.fail)
      }, 450)
    })

  })

  t.test('update interest', t => {
    t.plan(2)

    testUtils.runCommand(t, r, 'interests', {
      type: 'InterestUpdate',
      client: admin,
      parameters: {
        interest: interestId,
        ...newInterestData
      }
    }, (cId) => { }).then(
      result => {
      }
    )

    t.test('check if interest name is changed', t => {
      t.plan(1)
      setTimeout( () => {
        r.table('interests_Interest').get(interestId).run(conn).then(
          interest => {
            t.equals(interest.name, newInterestData.name, 'interest display name match')
          }
        ).catch( t.fail )
      }, 250)
    })

  })

  t.test('remove interest', t => {
    t.plan(2)

    testUtils.runCommand(t, r, 'interests', {
      type: 'InterestDelete',
      parameters: {
        interest: interestId
      },
      client: admin
    }, (cId) => { }).then(
      result => {
      }
    )

    t.test('check if interest not exists', t=> {
      t.plan(1)
      setTimeout(()=>{
        r.table('interests_Interest').get(interestId).run(conn).then(
          interestRow => {
            if(!interestRow) t.pass('interest not exists')
              else t.fail('interest still exists')
          }
        ).catch(t.fail)
      }, 250)
    })

  })

  t.test('close connection', t => {
    conn.close(() => {
      t.pass('closed')
      t.end()
    })
  })

})