const app = require('./app.js')

const { tagsTypes } = require("../config/tags.js")

const definition = require("./definition.js")
const { Interest } = require("./tag.js")

const Session = definition.foreignModel('session', 'Session')
const User = definition.foreignModel('users', 'User')

const SelectedTags = definition.model({
  name: 'SelectedTags',
  properties: {
    user: {
      type: User,
      index: true
    },
    session: {
      type: Session,
      index: true
    },
    tagsType: {
      type: String,
      defaultValue: "tag"
    },
    tags: {
      type: Array,
      of: {
        type: Interest
      }
    }
  },
  crud: {
    deleteTrigger: true,
    writeOptions: {
      access: (params, {client, service, visibilityTest}) => {
        if(visibilityTest) return true // visible in api
        if(client.roles.includes('admin')) return true
        const [t, id] = params.selectedTags.split("_")
        if(t == "user") return id == client.user
        else if(t == "session") return id == client.sessionId
        else return false
      }
    }
  }
})

async function waitForTags(id, user, session, tagsType) {
  let exists = await SelectedTags.get(id)
  while(!exists) {
    await SelectedTags.create({ id, tags: [], session, user, tagsType })
    exists = await SelectedTags.get(id)
    console.log("WAIT FOR TAGS", id, exists)
  }
}

definition.view({
  name: "MySelectedTags",
  properties: {
    tagsType: {
      type: String,
      defaultValue: "tag"
    }
  },
  returns: {
    type: null
  },
  rawRead: true,
  async daoPath({ tagsType }, { client }, method) {
    const id = client.user ? "user_"+tagsType+"_"+client.user : "session_"+tagsType+"_"+client.sessionId
    const session = client.sessionId
    const user = client.user || null

    console.log("MY SELECTED TAGS?!?!", id)
    await waitForTags(id, client.sessionId, client.user, tagsType)

    return SelectedTags.path(id)
  }
})

definition.view({
  name: "UserSelectedTags",
  properties: {
    user: {
      type: User
    },
    tagsType: {
      type: String,
      defaultValue: "tag"
    }
  },
  returns: {
    type: null
  },
  rawRead: true,
  async daoPath({ tagsType, user }, { client }, method) {
    const id = "user_"+tagsType+"_"+user
    const session = client.sessionId

    console.log("USER SELECTED TAGS?!?!", id)
    await waitForTags(id, client.sessionId, client.user, tagsType)

    return SelectedTags.path(id)
  }
})

definition.event({
  name: "tagSelected",
  async execute({ tag, tagsType, ident, user, session }) {
    await waitForTags(id, user, session, tagsType)
    SelectedTags.update(ident, [
      { op: 'addToSet', property:'tags', value: tag }
    ])
  }
})

definition.event({
  name: "tagDeselected",
  async execute({ tag, ident }) {
    await SelectedTags.update(ident, [
      { op: 'deleteFromSet', property:'tags', value: tag }
    ])
  }
})

definition.event({
  name: "tagsUpdated",
  async execute({ tags, tagsType, user, session, ident }) {
    await SelectedTags.update(ident, {id: ident, user, session, tagsType, tags : tags})
  }
})

definition.event({
  name: "tagsRemoved",
  async execute({ ident }) {
    await SelectedTags.delete(ident)
  }
})


definition.action({
  name: "SelectTag",
  properties: {
    tagType: {
      type: String,
      defaultValue: "tag"
    },
    tag : {
      type: Interest
    }
  },
  async execute({ tag, tagType }, { client }, emit) {
    const id = client.user ? "user_"+tagType+"_"+client.user : "session_"+tagType+"_"+client.sessionId
    emit({
      type: "tagSelected",
      tagsType: tagType,
      user: client.user || null,
      session: client.sessionId || null,
      ident: id,
      tag: tag
    })
    return null
  }
})

definition.action({
  name: "DeselectTag",
  properties: {
    tagType: {
      type: String,
      defaultValue: "tag"
    },
    tag : {
      type: Interest
    }
  },
  async execute({ tag, tagType }, { client }, emit) {
    const id = client.user ? "user_"+tagType+"_"+client.user : "session_"+tagType+"_"+client.sessionId
    emit({
      type: "tagDeselected",
      tagsType: tagType,
      user: client.user || null,
      session: client.sessionId || null,
      ident: id,
      tag: tag
    })
    return null
  }
})

definition.trigger({
  name: "OnLogin",
  properties: {
    user: {
      type: User
    },
    session: {
      type: Session
    }
  },
  async execute({ user, session }, context, emit) {
    for(let tagsType of tagsTypes) {
      const userId = "user_"+tagsType+"_"+user
      const sessionId = "session_"+tagsType+"_"+session
      const [userTags, sessionTags] = await Promise.all([
        SelectedTags.get(userId), SelectedTags.get(sessionId)
      ])
      const previousTags = userTags ? userTags.tags || [] : []
      const moreTags = (sessionTags ? sessionTags.tags || [] : [])
          .filter(tag => !previousTags.find(i => i == tag)) // remove duplicates

      const allTags = previousTags.concat(moreTags)

      emit([{
        type: "tagsUpdated",
        ident: userId,
        user, session,
        tagsType,
        tags: allTags
      }, {
        type: "tagsRemoved",
        ident: sessionId
      }])
    }
  }
})

definition.trigger({
  name: "OnRegisterStart",
  properties: {
    user: {
      type: User
    },
    session: {
      type: Session
    }
  },
  async execute({ user, session }, context, emit) {
    for(let tagsType of tagsTypes) {
      const userId = "user_"+tagsType+"_"+user
      const sessionId = "session_"+tagsType+"_"+session
      const [userTags, sessionTags] = await Promise.all([
        SelectedTags.get(userId), SelectedTags.get(sessionId)
      ])
      const previousTags = userTags ? userTags.tags || [] : []
      const moreTags = (sessionTags ? sessionTags.tags || [] : [])
          .filter(tag => !previousTags.find(i => i == tag)) // remove duplicates

      const allTags = previousTags.concat(moreTags)

      emit([{
        type: "tagsUpdated",
        ident: userId,
        user, session,
        tagsType,
        tags: allTags
      }, {
        type: "tagsRemoved",
        ident: sessionId
      }])
    }
  }
})