const app = require("./app.js")
const definition = require("./definition.js")
const i18n = require("../../i18n")

const translationProperties = {}
for(let lang in i18n.languages) {
  translationProperties[lang] = {
    type: Object,
    properties: {
      name: {
        type: String
      },
      description: {
        type: String,
        editor: 'textarea'
      }
    }
  }
}


const tagFields = {
  tagType: {
    type: String,
    defaultValue: "tag",
    search: {
      type: "keyword"
    }
  },
  name: {
    type: String,
    validation: ['nonEmpty']
  },
  description: {
    type: String,
    //validation: ['nonEmpty'],
    editor: 'textarea'
  },
  published: {
    type: Boolean,
    defaultValue: true
  },
  translations: {
    type: Object,
    properties: translationProperties
  },
  slug: {
    type: String
  }
}

const Tag = definition.model({
  name: "Tag",
  properties: {
    ...tagFields
  },
  display: ['name', 'country'],
  crud: {
    deleteTrigger: true,
    writeOptions: {
      access: (params, {client, service}) => {
        return client.roles && client.roles.includes('admin')
      }
    }
  },
  search: true
})


definition.action({
  name: "TagCreate",
  properties: {
    ...tagFields
  },
  access: (params, { client }) => {
    return client.roles && client.roles.includes('admin')
  },
  async execute (params, { client, service }, emit) {
    const tag = app.generateUid()
    let data = { }
    for(let key in tagFields) {
      data[key] = params[key]
    }

    if(!data.slug) {
      data.slug = await service.triggerService('slugs', {
        type: "CreateSlug",
        group: "tag_"+data.tagType,
        title: params.name,
        to: tag
      })
    } else {
      try {
        await service.triggerService('slugs', {
          type: "TakeSlug",
          group: "tag_"+data.tagType,
          path: data.slug,
          to: tag
        })
      } catch(e) {
        throw { properties: { slug: 'taken' } }
      }
    }

    emit({
      type: 'TagCreated',
      tag,
      data: data
    })

    return tag
  }
})

definition.action({
  name: "TagUpdate",
  properties: {
    tag: {
      type: String
    },
    ...tagFields
  },
  access: (params, { client }) => {
    return client.roles && client.roles.includes('admin')
  },
  async execute (params, { client, service }, emit) {
    let data = { }
    for(let key in tagFields) {
      data[key] = params[key]
    }

    const tag = params.tag

    let current = await Tag.get(tag)

    if(current.slug != data.slug) {
      await service.triggerService('slugs', {
        type: "ReleaseSlug",
        group: "tag_"+current.tagType,
        path: current.slug,
        to: tag
      })
      if (!data.slug) {
        data.slug = await service.triggerService('slugs', {
          type: "CreateSlug",
          group: "tag_"+data.tagType,
          title: params.name,
          to: tag
        })
      } else {
        try {
          await service.triggerService('slugs', {
            type: "TakeSlug",
            group: "tag_"+data.tagType,
            path: data.slug,
            to: tag
          })
        } catch (e) {
          throw {properties: {slug: 'taken'}}
        }
      }
    }

    emit({
      type: 'TagUpdated',
      tag,
      data: data
    })

    return tag
  }
})

definition.action({
  name: "TagDelete",
  properties: {
    tag: {
      type: String
    }
  },
  access: (params, { client }) => {
    return client.roles && client.roles.includes('admin')
  },
  async execute ({ tag }, { client, service }, emit) {
    let current = await Tag.get(tag)

    await service.triggerService('slugs', {
      type: "ReleaseSlug",
      group: "tag_"+current.tagType,
      path: current.slug,
      to: tag
    })
    await service.trigger({
      type: "TagDeleted",
      tag
    })
    emit({
      type: 'TagDeleted',
      tag
    })
  }
})

definition.view({
  name: "findTags",
  properties: {
    query: {
      type: String,
      validation: ['nonEmpty']
    },
    tagsType: {
      type: String,
      defaultValue: "tag"
    }
  },
  returns: {
    type: Array,
    of: {
      type: Tag
    }
  },
  async fetch({ query, tagsType }, { client, service }) {
    const search = await app.connectToSearch()
    const searchQuery = {
      index: Tag.searchIndex,
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query.toString(),
                  fields: ["name", "description", "*.name", "*.description"], /// TODO: translation by parameter
                  fuzziness: Math.min(query.length / 3, 3) | 0,
                }
              },
              {
                multi_match: {
                  query: query.toString(),
                  fields: ["name", "description", "*.name", "*.description"], /// TODO: translation by parameter
                  type: "phrase_prefix"
                }
              }
            ],
            filter: [
              {
                terms: {
                  tagType: [ tagsType || "tag"]
                }
              }
            ]
          }
        }
      }
    }
    console.log("Tags query", JSON.stringify(searchQuery, null, "  "))
    const result = await search.search(searchQuery)
    console.dir(result.body)
    return result.body.hits.hits.map(hit => hit._source)
  }
})


definition.view({
  name: "getBlogTags",
  properties: {
  },
  returns: {
    type: Array,
    of: {
      type: Tag
    }
  },
  rawRead: true,
  async fetch({ tags }, {client, service}) {
    const search = await app.connectToSearch()
    let should = {};
    let must = {
      match: {
        tagType: 'tag'
      }
    }

    const searchQuery = {
      index: Tag.searchIndex,
      body: {
        query: {
          bool: {
            must: must
          }
        }
      }
    }
    console.log("Tags query", JSON.stringify(searchQuery, null, "  "))
    const result = await search.search(searchQuery)
    console.dir(result.body)
    return result.body.hits.hits.map(hit => hit._source)
  }
})



definition.action({
  name: "proposeTag",
  properties: {
    name: {
      type: String,
      validation: ['nonEmpty']
    },
    tagType: {
      type: String,
      defaultValue: "tag"
    },
    language: {
      type: String
    }
  },
  async execute({ name, tagType, language }, { client, service }, emit) {
    let tag = app.generateUid()
    let translations = {}
    translations[language] = { name }
    const slug = await service.triggerService('slugs', {
      type: "CreateSlug",
      group: "tag_"+tagType,
      title: name,
      to: tag
    })
    emit([{
      type: "TagCreated",
      tag,
      data: {
        name,
        tagType,
        translations,
        slug,
        published: !!(client.roles && client.roles.includes('admin'))
      }
    }])
    return tag
  }
})

module.exports = { Tag }
