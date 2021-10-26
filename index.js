const app = require("@live-change/framework").app()

const definition = require('./definition.js')

require('./tag.js')
require('./selectedTags.js')

module.exports = definition

async function start() {
  if(!app.dao) {
    await require('@live-change/server').setupApp({})
    await require('@live-change/elasticsearch-plugin')(app)
  }

  app.processServiceDefinition(definition, [ ...app.defaultProcessors ])
  await app.updateService(definition)//, { force: true })
  const service = await app.startService(definition,
      { runCommands: true, handleEvents: true, indexSearch: true })

  /*require("../config/metricsWriter.js")(definition.name, () => ({

  }))*/
}

if (require.main === module) start().catch( error => { console.error(error); process.exit(1) })

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
})
